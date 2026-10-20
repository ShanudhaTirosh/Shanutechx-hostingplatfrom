import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { encryptSecret } from '../lib/secretsVault';
import { isSafeWebhookUrl } from '../lib/webhooks';

import { useForOwnRoutes } from '../lib/routerGuard';
export const webhooksRouter = Router();

useForOwnRoutes(webhooksRouter, requireAuth);

const createWebhookSchema = z.object({
  url: z.string().url(),
  event: z.enum(['deployment_status_changed', 'payment_status_changed', 'order_paid', 'ticket_updated']),
});

/** The HMAC secret is generated here and shown once — same pattern as API keys. */
webhooksRouter.post('/webhooks', async (req: AuthedRequest, res) => {
  const parsed = createWebhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const safeCheck = await isSafeWebhookUrl(parsed.data.url);
  if (!safeCheck.safe) {
    return res.status(400).json({ error: 'Invalid webhook URL', reason: safeCheck.reason });
  }

  const rawSecret = crypto.randomBytes(24).toString('hex');
  const encryptedSecret = encryptSecret(rawSecret, env.secretsEncryptionKey);

  const webhook = await prisma.webhook.create({
    data: { userId: req.user!.id, url: parsed.data.url, event: parsed.data.event, secret: encryptedSecret },
  });

  res.status(201).json({
    webhook: { id: webhook.id, url: webhook.url, event: webhook.event, isActive: webhook.isActive },
    secret: rawSecret,
  });
});

webhooksRouter.get('/webhooks', async (req: AuthedRequest, res) => {
  const webhooks = await prisma.webhook.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, event: true, isActive: true, createdAt: true },
  });
  res.json({ webhooks });
});

webhooksRouter.get('/webhooks/:id/deliveries', async (req: AuthedRequest, res) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook || webhook.userId !== req.user!.id) return res.status(404).json({ error: 'Not found' });

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: webhook.id },
    orderBy: { attemptedAt: 'desc' },
    take: 50,
  });
  res.json({ deliveries });
});

webhooksRouter.delete('/webhooks/:id', async (req: AuthedRequest, res) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook || webhook.userId !== req.user!.id) return res.status(404).json({ error: 'Not found' });

  await prisma.webhook.delete({ where: { id: webhook.id } });
  res.json({ ok: true });
});
