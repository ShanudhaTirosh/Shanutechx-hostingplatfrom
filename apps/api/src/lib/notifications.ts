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
/** A file to deliver with a notification (e.g. an invoice PDF), base64-encoded. */
export interface NotificationAttachment {
  fileName: string;
  mimetype: string;
  base64: string;
}

export async function notifyCustomer(
  user: NotifiableUser,
  message: string,
  customHtml?: string,
  customSubject?: string,
  attachment?: NotificationAttachment
): Promise<void> {
  const sends: Promise<unknown>[] = [];

  sends.push(sendEmailFallback(user.email, message, customHtml, customSubject, attachment));

  if (user.phoneNumber) {
    sends.push(
      postInternal(`${env.whatsappBotUrl}/internal/send`, env.whatsappInternalSecret, {
        phoneNumber: user.phoneNumber,
        message,
        ...(attachment ? { document: attachment } : {}),
      })
    );
  }

  if (user.discordUserId) {
    sends.push(
      postInternal(`${env.discordBotUrl}/internal/send-dm`, env.discordInternalSecret, {
        discordUserId: user.discordUserId,
        message,
        ...(attachment ? { document: attachment } : {}),
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
  renderPasswordResetEmail,
  renderInvoiceDeliveryEmail,
} from './emailTemplates';
import { sendSmtpEmail } from './smtpDispatcher';


async function sendEmailFallback(
  email: string,
  message: string,
  customHtml?: string,
  customSubject?: string,
  attachment?: NotificationAttachment
): Promise<void> {
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
          attachments: attachment
            ? [{ filename: attachment.fileName, contentType: attachment.mimetype, content: attachment.base64 }]
            : undefined,
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

export async function sendPasswordResetNotification(
  email: string,
  customerName: string,
  resetLink: string
): Promise<void> {
  const rendered = renderPasswordResetEmail({ customerName, resetLink });
  await sendEmailFallback(email, rendered.text, rendered.html, rendered.subject);
}

export async function sendInvoiceDeliveryNotification(
  user: NotifiableUser & { name?: string },
  orderId: string,
  totalLkr: number,
  items: Array<{ name: string; quantity: number; price: number }>,
  invoiceUrl?: string
): Promise<void> {
  const rendered = renderInvoiceDeliveryEmail({
    customerName: user.name || user.email.split('@')[0],
    orderId,
    totalLkr,
    items,
    invoiceUrl,
  });
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

/**
 * Dispatch rich Discord ticket embed with interactive buttons (Claim, Reply, Close)
 * to the support Discord channel, and send customer multi-channel notifications.
 */
export async function notifyTicketEmbed({
  ticketId,
  subject,
  userEmail,
  userDiscordId,
  userPhone,
  initialMessage,
  priority = 'medium',
  status = 'open',
  claimedBy,
}: {
  ticketId: string;
  subject: string;
  userEmail: string;
  userDiscordId?: string | null;
  userPhone?: string | null;
  initialMessage: string;
  priority?: string;
  status?: string;
  claimedBy?: string | null;
}): Promise<void> {
  const shortId = ticketId.slice(0, 8).toUpperCase();
  const discordUserMention = userDiscordId ? `<@${userDiscordId}>` : userEmail;

  const embed = {
    title: `[TICKET #${shortId}] ${subject}`,
    color: status === 'closed' ? 0x64748b : priority === 'high' || priority === 'urgent' ? 0xef4444 : 0x7c3aed,
    fields: [
      { name: 'Status', value: status.toUpperCase(), inline: true },
      { name: 'Priority', value: priority.toUpperCase(), inline: true },
      { name: 'Customer', value: discordUserMention, inline: true },
      { name: 'Claimed Staff', value: claimedBy ? claimedBy : 'Unassigned', inline: true },
      { name: 'Message', value: initialMessage.length > 500 ? initialMessage.slice(0, 500) + '...' : initialMessage, inline: false },
    ],
    footer: { text: `Ticket ID: ${ticketId} · ShanuTechX Support` },
    timestamp: new Date().toISOString(),
  };

  const actionRow = {
    type: 1, // ActionRow
    components: [
      {
        type: 2, // Button
        style: 1, // Primary (Blue/Blurple)
        custom_id: `claim_ticket:${ticketId}`,
        label: claimedBy ? `Claimed by ${claimedBy}` : 'Claim Ticket',
        disabled: Boolean(claimedBy),
      },
      {
        type: 2, // Button
        style: 2, // Secondary (Gray)
        custom_id: `reply_ticket:${ticketId}`,
        label: 'Reply',
      },
      {
        type: 2, // Button
        style: 4, // Danger (Red)
        custom_id: `close_ticket:${ticketId}`,
        label: 'Close Ticket',
      },
    ],
  };

  // Dispatch to Discord support channel & create dedicated ticket channel with role permissions
  void postInternal(`${env.discordBotUrl}/internal/send-ticket-embed`, env.discordInternalSecret, {
    embed,
    actionRow,
    ticketId,
  });

  void postInternal(`${env.discordBotUrl}/internal/create-ticket-channel`, env.discordInternalSecret, {
    ticketId,
    subject,
    customerEmail: userEmail,
    customerDiscordUserId: userDiscordId,
    embed,
    actionRow,
  });

  // Notify customer via WhatsApp & Discord DM if linked
  const customerMsg = `[Ticket #${shortId}] Update on "${subject}": Status is now ${status.toUpperCase()}.`;
  if (userPhone) {
    void postInternal(`${env.whatsappBotUrl}/internal/send`, env.whatsappInternalSecret, {
      phoneNumber: userPhone,
      message: customerMsg,
    });
  }
  if (userDiscordId) {
    void postInternal(`${env.discordBotUrl}/internal/send-dm`, env.discordInternalSecret, {
      discordUserId: userDiscordId,
      message: customerMsg,
    });
  }
}


