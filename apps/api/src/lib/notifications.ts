import { env } from '../env';
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
export async function notifyCustomer(
  user: NotifiableUser,
  message: string,
  customHtml?: string,
  customSubject?: string
): Promise<void> {
  const sends: Promise<unknown>[] = [];

  sends.push(sendEmailFallback(user.email, message, customHtml, customSubject));

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

import {
  renderNotificationEmail,
  renderTeamInviteEmail,
  renderWelcomeEmail,
  renderSubscriptionGracePeriodEmail,
  renderDeploymentStatusEmail,
} from './emailTemplates';
import { sendSmtpEmail } from './smtpDispatcher';

async function sendEmailFallback(email: string, message: string, customHtml?: string, customSubject?: string): Promise<void> {
  const rendered = customHtml
    ? { subject: customSubject || 'ShanuTechX Notification', html: customHtml, text: message }
    : renderNotificationEmail({ title: 'ShanuTechX Alert', message });

  // Try System Outbound SMTP / WildDuck mail delivery
  try {
    const smtpHost = process.env.SMTP_HOST || 'mail.shanutechx.com';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      await sendSmtpEmail(
        {
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          user: smtpUser,
          pass: smtpPass,
        },
        {
          from: `"${env.rootDomain} Platform" <${env.wildduckFromAddress}>`,
          to: email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }
      );
      return;
    }
  } catch (smtpErr) {
    logger.error({ smtpErr, email }, 'All email delivery mechanisms failed for customer notification');
  }
}

export async function sendTeamInviteNotification({
  email,
  teamName,
  inviterName,
  role,
  inviteLink,
}: {
  email: string;
  teamName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
}): Promise<void> {
  const rendered = renderTeamInviteEmail({ teamName, inviterName, role, inviteLink });
  await sendEmailFallback(email, rendered.text, rendered.html, rendered.subject);
}

export async function sendWelcomeNotification(user: NotifiableUser & { name: string }): Promise<void> {
  const rendered = renderWelcomeEmail({ customerName: user.name });
  await notifyCustomer(user, rendered.text, rendered.html, rendered.subject);
}

export async function sendGracePeriodNotification(
  user: NotifiableUser & { name: string },
  serviceName: string,
  gracePeriodEndsAt: string
): Promise<void> {
  const rendered = renderSubscriptionGracePeriodEmail({ serviceName, gracePeriodEndsAt });
  await notifyCustomer(user, rendered.text, rendered.html, rendered.subject);
}

export async function sendDeploymentStatusNotification(
  user: NotifiableUser,
  deploymentName: string,
  status: 'running' | 'failed' | 'stopped',
  subdomain?: string | null,
  errorMessage?: string
): Promise<void> {
  const rendered = renderDeploymentStatusEmail({ deploymentName, subdomain, status, errorMessage });
  await notifyCustomer(user, rendered.text, rendered.html, rendered.subject);
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
