import { Expo } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { PushReceiptJob } from '../lib/queue';

const expo = new Expo();

export async function executePushReceiptJob(jobData: PushReceiptJob): Promise<{ processed: number; deadTokens: number }> {
  const { ticketToToken } = jobData;
  if (!ticketToToken || ticketToToken.length === 0) {
    return { processed: 0, deadTokens: 0 };
  }

  const receiptToToken = new Map<string, string>();
  for (const item of ticketToToken) {
    receiptToToken.set(item.ticketId, item.expoToken);
  }

  const receiptIds = Array.from(receiptToToken.keys());
  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  const deadTokens: string[] = [];
  let processed = 0;

  for (const chunk of receiptChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const receiptId in receipts) {
        processed++;
        const receipt = receipts[receiptId];
        if (receipt.status === 'error') {
          logger.warn({ receiptId, receipt }, 'Push notification delivery error in background worker');
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const deadToken = receiptToToken.get(receiptId);
            if (deadToken) deadTokens.push(deadToken);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch push notification receipts in background worker');
    }
  }

  if (deadTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { expoToken: { in: deadTokens } } });
    logger.info({ count: deadTokens.length }, 'Removed invalid push tokens identified by Expo receipt worker');
  }

  return { processed, deadTokens: deadTokens.length };
}
