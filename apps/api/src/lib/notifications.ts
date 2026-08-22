import { env } from '../env';
import { sendViaPostal, PostalError } from './postal';
import { logger } from './logger';
import { sendPushToAllStaff } from './pushNotifications';

interface NotifiableUser {
  email: string;
  phoneNumber?: string | null;
  discordUserId?: string | null;
}

async function postInternal(url: string, secret: string, body: object): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    logger.warn({ url, err }, 'Notification request failed');
    return false;
  }
}

/**
 * Notifies a customer on every channel they've linked, PLUS always tries
 * email — that's the one channel every customer actually has (their
 * account email from sign-up), unlike WhatsApp/Discord which are opt-in.
 * Without this, a customer who hasn't linked either gets silently zero
 * notifications, which was a real gap: sendViaPostal() existed and worked,
 * it just was never called from here.
 *
 * Missing a channel isn't an error — most customers will only have one or
 * two of these, and that's fine; this never throws, so a notification
 * failure never blocks the actual business action (payment approval,
 * deployment, etc.) that triggered it.
 */
export async function notifyCustomer(user: NotifiableUser, message: string): Promise<void> {
  const sends: Promise<unknown>[] = [];

  sends.push(sendEmailFallback(user.email, message));

  if (user.phoneNumber) {
    sends.push(
      postInternal(`${env.whatsappBotUrl}/internal/send`, env.whatsappInternalSecret, {
        phoneNumber: user.phoneNumber,
        message,
      })
    );
  }

  if (user.discordUserId) {
    sends.push(
      postInternal(`${env.discordBotUrl}/internal/send-dm`, env.discordInternalSecret, {
        discordUserId: user.discordUserId,
        message,
      })
    );
  }

  await Promise.all(sends);
}

async function sendEmailFallback(email: string, message: string): Promise<void> {
  if (!env.postalApiUrl || !env.postalApiKey) return; // Postal not configured — skip silently, same as any other unlinked channel

  try {
    await sendViaPostal({
      to: [email],
      from: env.postalFromAddress,
      subject: 'SHANUTECHX notification',
      plainBody: message,
    });
  } catch (err) {
    if (!(err instanceof PostalError)) logger.error({ err }, 'Email notification failed');
  }
}

/**
 * Posts an operational alert to the admin Discord channel (new orders,
 * manual review, node issues) AND pushes it to every staff member's phone
 * via the mobile admin app, if they've registered a push token. Push
 * delivery never blocks or fails this function — same "never throws"
 * contract as every other channel in this file.
 */
export async function notifyAdmins(message: string): Promise<void> {
  await Promise.all([
    postInternal(`${env.discordBotUrl}/internal/send-channel`, env.discordInternalSecret, {
      message,
    }),
    sendPushToAllStaff({ title: 'ShanuTechX', body: message }).catch((err) => {
      logger.warn({ err }, 'Push notification to staff failed');
    }),
  ]);
}
