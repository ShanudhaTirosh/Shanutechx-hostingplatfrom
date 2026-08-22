import { prisma } from './prisma';
import { logger } from './logger';
import { encryptSecret, decryptSecret } from './secretsVault';
import { env } from '../env';

/**
 * Infra-level Discord channel alerts — distinct from notifications.ts,
 * which DMs a specific user. This posts to whatever webhook URL an admin/
 * dev has configured (per NotificationEvent) in the Dev Dashboard, e.g.
 * "post every new payment proof into #payments-review".
 *
 * Never throws — a missing/misconfigured webhook must never block the
 * business action (payment upload, order creation, etc.) that triggered it.
 */
export type NotificationEvent =
  | 'new_payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'new_order'
  | 'new_ticket'
  | 'deployment_failed'
  | 'vps_assigned'
  | 'new_ai_subscription_request';

const EVENT_COLOR: Record<NotificationEvent, number> = {
  new_payment_submitted: 0xf5a623, // amber — needs review
  payment_approved: 0x2ecc71, // green
  payment_rejected: 0xe74c3c, // red
  new_order: 0x3498db, // blue
  new_ticket: 0x9b59b6, // purple
  deployment_failed: 0xe74c3c,
  vps_assigned: 0x2ecc71,
  new_ai_subscription_request: 0x9b59b6,
};

const EVENT_TITLE: Record<NotificationEvent, string> = {
  new_payment_submitted: '💰 New payment proof submitted',
  payment_approved: '✅ Payment approved',
  payment_rejected: '❌ Payment rejected',
  new_order: '🛒 New order',
  new_ticket: '🎫 New ticket',
  deployment_failed: '🔥 Deployment failed',
  vps_assigned: '🖥️ VPS assigned',
  new_ai_subscription_request: '🤖 AI subscription activation requested',
};

function buildEmbed(event: NotificationEvent, payload: Record<string, unknown>) {
  const fields = Object.entries(payload).map(([name, value]) => ({
    name,
    value: String(value ?? '—'),
    inline: true,
  }));

  return {
    title: EVENT_TITLE[event],
    color: EVENT_COLOR[event],
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fires every active DiscordWebhookConfig row registered for `event`. Most
 * setups will have at most one webhook per event, but this supports several
 * (e.g. mirroring payment alerts to both #payments and a private mod-log).
 */
export async function notifyDiscordChannel(
  event: NotificationEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const configs = await prisma.discordWebhookConfig.findMany({
      where: { event, isActive: true },
    });

    if (configs.length === 0) return; // not configured — silent no-op, never throws

    await Promise.all(
      configs.map(async (config: { id: string; webhookUrl: string }) => {
        try {
          const url = decryptSecret(config.webhookUrl, env.secretsEncryptionKey);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [buildEmbed(event, payload)] }),
          });
          if (!res.ok) {
            logger.warn(
              { event, configId: config.id, status: res.status },
              'Discord webhook returned non-2xx'
            );
          }
        } catch (err) {
          logger.warn({ event, configId: config.id, err }, 'Discord webhook delivery failed');
        }
      })
    );
  } catch (err) {
    // Never let a notification failure block the caller's business logic.
    logger.warn({ event, err }, 'notifyDiscordChannel failed');
  }
}

/** Encrypts a raw webhook URL before it's stored — call this from the admin CRUD route. */
export function encryptWebhookUrl(rawUrl: string): string {
  return encryptSecret(rawUrl, env.secretsEncryptionKey);
}

/**
 * Sends a one-off test payload to a webhook URL that hasn't necessarily been
 * saved yet (used by the "Send test" button in Dev Dashboard → Webhooks
 * before the admin commits the config).
 */
export async function sendTestDiscordWebhook(webhookUrl: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: '🔔 Test notification from ShanuTechX',
            description: 'If you can see this, the webhook is configured correctly.',
            color: 0x3498db,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
