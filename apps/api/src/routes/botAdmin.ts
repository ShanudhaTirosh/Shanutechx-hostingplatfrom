import { Router, Response } from 'express';
import { env } from '../env';
import { requireAuth, requireStaff, AuthedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

import { useForOwnRoutes } from '../lib/routerGuard';
export const botAdminRouter = Router();

useForOwnRoutes(botAdminRouter, requireAuth, requireStaff);

async function postInternalBot(url: string, secret: string, body?: object): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    logger.warn({ url, err: err.message }, 'Internal bot gateway request failed');
    return { ok: false, status: 503, data: { error: 'Bot gateway unreachable or offline', detail: err.message } };
  }
}

/** WhatsApp Bot Telemetry & QR Status */
botAdminRouter.get('/admin/bots/whatsapp/status', async (_req: AuthedRequest, res: Response) => {
  const result = await postInternalBot(`${env.whatsappBotUrl}/internal/status`, env.whatsappInternalSecret);
  res.status(result.status).json(result.data);
});

/** Request 8-digit phone pairing code for WhatsApp */
botAdminRouter.post('/admin/bots/whatsapp/pairing-code', async (req: AuthedRequest, res: Response) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

  const result = await postInternalBot(
    `${env.whatsappBotUrl}/internal/pairing-code`,
    env.whatsappInternalSecret,
    { phoneNumber }
  );
  res.status(result.status).json(result.data);
});

/** Reset & clear WhatsApp session auth state */
botAdminRouter.post('/admin/bots/whatsapp/reset-session', async (_req: AuthedRequest, res: Response) => {
  const result = await postInternalBot(
    `${env.whatsappBotUrl}/internal/reset-session`,
    env.whatsappInternalSecret,
    {}
  );
  res.status(result.status).json(result.data);
});

/** Reconnect WhatsApp bot socket */
botAdminRouter.post('/admin/bots/whatsapp/reconnect', async (_req: AuthedRequest, res: Response) => {
  const result = await postInternalBot(
    `${env.whatsappBotUrl}/internal/reconnect`,
    env.whatsappInternalSecret,
    {}
  );
  res.status(result.status).json(result.data);
});

/** Send test WhatsApp message from Admin Console */
botAdminRouter.post('/admin/bots/whatsapp/send-test', async (req: AuthedRequest, res: Response) => {
  const { phoneNumber, message } = req.body || {};
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'phoneNumber and message are required' });
  }

  const result = await postInternalBot(
    `${env.whatsappBotUrl}/internal/send`,
    env.whatsappInternalSecret,
    { phoneNumber, message }
  );
  res.status(result.status).json(result.data);
});

/** Discord Bot Telemetry & Status */
botAdminRouter.get('/admin/bots/discord/status', async (_req: AuthedRequest, res: Response) => {
  const result = await postInternalBot(`${env.discordBotUrl}/internal/status`, env.discordInternalSecret);
  res.status(result.status).json(result.data);
});

/** Send test Discord message (Channel or DM) */
botAdminRouter.post('/admin/bots/discord/send-test', async (req: AuthedRequest, res: Response) => {
  const { channelId, discordUserId, message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  if (discordUserId) {
    const result = await postInternalBot(
      `${env.discordBotUrl}/internal/send-dm`,
      env.discordInternalSecret,
      { discordUserId, message }
    );
    return res.status(result.status).json(result.data);
  }

  const result = await postInternalBot(
    `${env.discordBotUrl}/internal/send-channel`,
    env.discordInternalSecret,
    { channelId, message }
  );
  res.status(result.status).json(result.data);
});
