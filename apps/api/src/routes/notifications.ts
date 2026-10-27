import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

import { useForOwnRoutes } from '../lib/routerGuard';
export const notificationsRouter = Router();
useForOwnRoutes(notificationsRouter, requireAuth);

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['discord', 'whatsapp', 'email', 'webhook']),
  configJson: z.record(z.any()),
  isEnabled: z.boolean().optional().default(true),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  configJson: z.record(z.any()).optional(),
  isEnabled: z.boolean().optional(),
});

/** GET /api/notifications/channels — List user's notification channels */
notificationsRouter.get('/notifications/channels', async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const channels = await prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ channels });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list notification channels');
    res.status(500).json({ error: 'Failed to retrieve notification channels' });
  }
});

/** POST /api/notifications/channels — Create a new notification channel */
notificationsRouter.post('/notifications/channels', async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = createChannelSchema.parse(req.body);

    const channel = await prisma.notificationChannel.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        configJson: data.configJson,
        isEnabled: data.isEnabled,
      },
    });

    res.status(201).json({ channel });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, 'Failed to create notification channel');
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

/** PATCH /api/notifications/channels/:id — Update a notification channel */
notificationsRouter.patch('/notifications/channels/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = updateChannelSchema.parse(req.body);

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, userId },
    });

    if (!channel) {
      res.status(404).json({ error: 'Notification channel not found' });
      return;
    }

    const updated = await prisma.notificationChannel.update({
      where: { id },
      data: updates,
    });

    res.json({ channel: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, 'Failed to update notification channel');
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
});

/** DELETE /api/notifications/channels/:id — Delete a notification channel */
notificationsRouter.delete('/notifications/channels/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, userId },
    });

    if (!channel) {
      res.status(404).json({ error: 'Notification channel not found' });
      return;
    }

    await prisma.notificationChannel.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete notification channel');
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

/** POST /api/notifications/channels/:id/test — Dispatch test notification */
notificationsRouter.post('/notifications/channels/:id/test', async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, userId },
    });

    if (!channel) {
      res.status(404).json({ error: 'Notification channel not found' });
      return;
    }

    const config = channel.configJson as Record<string, any>;
    let success = false;
    let detail = '';

    if (channel.type === 'discord' || channel.type === 'webhook') {
      const targetUrl = config.webhookUrl;
      if (!targetUrl) {
        res.status(400).json({ error: 'No webhookUrl configured for channel' });
        return;
      }

      const payload = channel.type === 'discord'
        ? { content: '**ShanuTechX Notification Test**: Channel integration test successfully verified!' }
        : { event: 'test_notification', message: 'ShanuTechX notification test event', timestamp: new Date().toISOString() };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      success = response.ok;
      detail = `HTTP Status ${response.status}`;
    } else {
      // whatsapp or email mock simulation
      success = true;
      detail = `Simulated dispatch for ${channel.type}`;
    }

    res.json({ success, detail, dispatchedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, 'Failed to dispatch test notification');
    res.status(500).json({ error: err.message || 'Failed to dispatch test notification' });
  }
});
