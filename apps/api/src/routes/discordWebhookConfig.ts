import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireDev, AuthedRequest } from '../middleware/auth';
import { encryptWebhookUrl, sendTestDiscordWebhook } from '../lib/discordWebhooks';

/**
 * Dev-only management of the platform's Discord channel alerts
 * (Dev Dashboard -> Webhooks). This is distinct from routes/webhooks.ts,
 * which lets a customer register their own outbound webhook for their own
 * integrations — this route configures where *your team* gets pinged
 * (new payment, approved/rejected, new ticket, deployment failed, etc.).
 *
 * Per the product requirement, only the single dev/owner account can see or
 * change this — admin/support never touch infra notification routing.
 */
export const discordWebhookConfigRouter = Router();

discordWebhookConfigRouter.use(requireAuth, requireDev);

const NOTIFICATION_EVENTS = [
  'new_payment_submitted',
  'payment_approved',
  'payment_rejected',
  'new_order',
  'new_ticket',
  'deployment_failed',
  'vps_assigned',
  'new_ai_subscription_request',
] as const;

const createSchema = z.object({
  event: z.enum(NOTIFICATION_EVENTS),
  webhookUrl: z.string().url(),
});

discordWebhookConfigRouter.get('/discord-webhooks', async (_req: AuthedRequest, res) => {
  const configs = await prisma.discordWebhookConfig.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, event: true, isActive: true, createdAt: true, updatedAt: true },
    // webhookUrl deliberately omitted — never send the encrypted blob or a
    // decrypted URL back to the client after creation; only a "configured"
    // flag is needed for the list view.
  });
  res.json({ configs });
});

discordWebhookConfigRouter.post('/discord-webhooks', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = await prisma.discordWebhookConfig.create({
    data: {
      event: parsed.data.event,
      webhookUrl: encryptWebhookUrl(parsed.data.webhookUrl),
      isActive: true,
    },
    select: { id: true, event: true, isActive: true, createdAt: true },
  });

  res.status(201).json({ config });
});

const toggleSchema = z.object({ isActive: z.boolean() });

discordWebhookConfigRouter.patch('/discord-webhooks/:id', async (req: AuthedRequest, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = await prisma.discordWebhookConfig
    .update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, event: true, isActive: true },
    })
    .catch(() => null);

  if (!config) return res.status(404).json({ error: 'Webhook config not found' });
  res.json({ config });
});

discordWebhookConfigRouter.delete('/discord-webhooks/:id', async (req: AuthedRequest, res) => {
  await prisma.discordWebhookConfig.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).send();
});

const testSchema = z.object({ webhookUrl: z.string().url() });

/** Fires a sample embed at a URL the admin/dev just typed, before saving it. */
discordWebhookConfigRouter.post('/discord-webhooks/test', async (req: AuthedRequest, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await sendTestDiscordWebhook(parsed.data.webhookUrl);
  res.json(result);
});
