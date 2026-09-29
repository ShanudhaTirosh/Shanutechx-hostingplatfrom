import { prisma } from './prisma';
import { logger } from './logger';
import { encryptSecret, decryptSecret } from './secretsVault';
import { env } from '../env';

/**
 * Unified Discord Webhook Dispatcher
 * Delivers all platform events (payments, deployments, tickets, orders, VPS)
 * to a single unified Discord Webhook URL, or falls back to per-event DB configs.
 */
export type NotificationEvent =
  | 'new_payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'new_order'
  | 'new_ticket'
  | 'deployment_failed'
  | 'deployment_recovered'
  | 'vps_assigned'
  | 'cluster_offline';

const EVENT_COLOR: Record<NotificationEvent, number> = {
  new_payment_submitted: 0xf5a623, // amber
  payment_approved: 0x2ecc71, // green
  payment_rejected: 0xe74c3c, // red
  new_order: 0x3498db, // blue
  new_ticket: 0x9b59b6, // purple
  deployment_failed: 0xe74c3c, // red
  deployment_recovered: 0x2ecc71, // green
  vps_assigned: 0x2ecc71, // green
  cluster_offline: 0xe74c3c, // red
};

const EVENT_TITLE: Record<NotificationEvent, string> = {
  new_payment_submitted: 'New Payment Proof Submitted',
  payment_approved: 'Payment Approved & Auto-Provisioned',
  payment_rejected: 'Payment Rejected',
  new_order: 'New Order Created',
  new_ticket: 'New Support Ticket Opened',
  deployment_failed: 'Deployment Failed',
  deployment_recovered: 'Deployment Recovered',
  vps_assigned: 'VPS Instance Assigned',
  cluster_offline: '🚨 CLUSTER OFFLINE ALERT',
};

function buildEmbed(event: NotificationEvent, payload: Record<string, unknown>) {
  const fields = Object.entries(payload).map(([name, value]) => ({
    name: name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
    value: String(value ?? '—'),
    inline: true,
  }));

  return {
    title: EVENT_TITLE[event],
    color: EVENT_COLOR[event],
    fields,
    footer: { text: 'ShanuTechX Cloud Engine' },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Delivers platform events to the unified Discord Webhook endpoint.
 */
export async function notifyDiscordChannel(
  event: NotificationEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const targetUrls: string[] = [];

    // 1. Unified fallback environment variable (DISCORD_WEBHOOK_URL)
    const unifiedUrl = process.env.DISCORD_WEBHOOK_URL;
    if (unifiedUrl && unifiedUrl.startsWith('http')) {
      targetUrls.push(unifiedUrl);
    }

    // 2. Per-event DB configs
    const configs = await prisma.discordWebhookConfig.findMany({
      where: { event: event as any, isActive: true },
    });

    for (const c of configs) {
      try {
        const url = decryptSecret(c.webhookUrl, env.secretsEncryptionKey);
        if (url && !targetUrls.includes(url)) {
          targetUrls.push(url);
        }
      } catch (err) {
        logger.warn({ event, configId: c.id, err }, 'Failed to decrypt Discord webhook URL');
      }
    }

    if (targetUrls.length === 0) return;

    const embed = buildEmbed(event, payload);

    await Promise.all(
      targetUrls.map(async (url) => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
          });
          if (!res.ok) {
            logger.warn({ event, status: res.status }, 'Discord webhook returned non-2xx');
          }
        } catch (err) {
          logger.warn({ event, err }, 'Discord webhook delivery failed');
        }
      })
    );
  } catch (err) {
    logger.warn({ event, err }, 'notifyDiscordChannel failed');
  }
}

export function encryptWebhookUrl(rawUrl: string): string {
  return encryptSecret(rawUrl, env.secretsEncryptionKey);
}

export async function sendTestDiscordWebhook(webhookUrl: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: '🔔 Test Notification from ShanuTechX Platform',
            description: 'The unified Discord Webhook integration is working correctly!',
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
