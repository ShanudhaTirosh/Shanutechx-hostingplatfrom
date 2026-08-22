import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Real push delivery to the mobile admin app (apps/mobile-admin), using
 * Expo's push service via expo-server-sdk — the same SDK Expo's own docs
 * recommend, not a custom FCM/APNs integration.
 *
 * UNTESTED AGAINST A LIVE DEVICE. Built without a physical device, an
 * emulator, or a real Expo project/push credentials in the sandbox that
 * wrote this. What's real: the SDK, the token validation, the batching
 * (Expo caps messages at 100 per request), the error-code handling
 * (specifically auto-removing tokens Expo reports as DeviceNotRegistered,
 * which is the documented way to keep a token table clean over time), and
 * the two-step ticket→receipt flow Expo's own docs describe as required
 * for reliably knowing whether a push actually got delivered. What's
 * unverified: whether it actually arrives on a phone. Verify with a real
 * device before relying on it operationally.
 */

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a push to every token registered for the given user IDs. Invalid/
 * unregistered tokens are removed from the database as part of this call
 * (per Expo's own recommended pattern), so callers never need to manage
 * token cleanup themselves.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = [];
  const invalidTokenIds: string[] = [];

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token.expoToken)) {
      // Not a real Expo push token (e.g. corrupted/tampered client data) —
      // drop it rather than let it poison the batch below.
      invalidTokenIds.push(token.id);
      continue;
    }
    messages.push({
      to: token.expoToken,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }

  if (invalidTokenIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: invalidTokenIds } } });
  }

  if (messages.length === 0) return;

  // Expo caps each push request at 100 messages — chunk accordingly. This
  // is exactly the batching pattern Expo's own docs show.
  // Track which expoToken each message was sent to, in the same order
  // sendPushNotificationsAsync returns tickets, so a DeviceNotRegistered
  // receipt can be traced back to the specific token to delete.
  const chunks = expo.chunkPushNotifications(messages);
  const ticketToToken = new Map<string, string>(); // ticket.id -> expoToken

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      ticketChunk.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          ticketToToken.set(ticket.id, chunk[i].to as string);
        } else {
          logger.warn({ ticket, token: chunk[i].to }, 'Expo push ticket reported an immediate error');
        }
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send a push notification chunk');
    }
  }

  await checkReceiptsAndCleanup(ticketToToken);
}

/**
 * Expo's push API is two-step: sendPushNotificationsAsync returns
 * "tickets" immediately (accepted-for-delivery, not delivered), and a
 * separate receipt check confirms actual delivery or reports errors like
 * DeviceNotRegistered. This does the receipt check inline after a short
 * delay rather than requiring a separate cron job — simpler operationally,
 * at the cost of not catching failures that only show up after the
 * process this ran in has exited (Expo's docs recommend checking receipts
 * up to ~30 min later for full reliability; this checks after 2s, which
 * catches immediate rejections but may miss later-surfacing ones — a
 * proper background job would be the improvement, deliberately not
 * built here without a way to test it against real receipts).
 */
async function checkReceiptsAndCleanup(ticketToToken: Map<string, string>): Promise<void> {
  const receiptIds = Array.from(ticketToToken.keys());
  if (receiptIds.length === 0) return;

  // Give Expo a moment before asking for receipts — checking immediately
  // is a documented anti-pattern (receipts usually aren't ready yet).
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const deadTokens: string[] = [];
  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const receiptId in receipts) {
        const receipt = receipts[receiptId];
        if (receipt.status === 'error') {
          logger.warn({ receiptId, receipt }, 'Push notification delivery error');
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const deadToken = ticketToToken.get(receiptId);
            if (deadToken) deadTokens.push(deadToken);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch push notification receipts');
    }
  }

  if (deadTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { expoToken: { in: deadTokens } } });
    logger.info({ count: deadTokens.length }, 'Removed push tokens Expo reported as no longer registered');
  }
}

/** Convenience wrapper: push to every admin/dev/support staff account at once — the mobile app's primary audience. */
export async function sendPushToAllStaff(payload: PushPayload): Promise<void> {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['admin', 'dev', 'support'] } },
    select: { id: true },
  });
  await sendPushToUsers(staff.map((u: { id: string }) => u.id), payload);
}
