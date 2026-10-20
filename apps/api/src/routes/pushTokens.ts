import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

import { useForOwnRoutes } from '../lib/routerGuard';
/**
 * Real push-token storage — registered by the mobile admin app
 * (apps/mobile-admin/src/lib/pushRegistration.ts) after a user signs in
 * and grants notification permission. See lib/pushNotifications.ts for the
 * send side. UNTESTED AGAINST A LIVE DEVICE — see that file's header for
 * what's real vs. unverified here.
 */
export const pushTokensRouter = Router();

useForOwnRoutes(pushTokensRouter, requireAuth);

const registerSchema = z.object({
  expoToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

/** Idempotent: re-registering the same token (e.g. app reopened) just bumps lastSeenAt. */
pushTokensRouter.post('/push-tokens', async (req: AuthedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const token = await prisma.pushToken.upsert({
    where: { expoToken: parsed.data.expoToken },
    create: {
      userId: req.user!.id,
      expoToken: parsed.data.expoToken,
      platform: parsed.data.platform,
    },
    update: {
      // Re-assign ownership too — covers the case where the same physical
      // device previously belonged to a different signed-in staff member.
      userId: req.user!.id,
      lastSeenAt: new Date(),
    },
  });

  res.status(201).json({ token: { id: token.id, platform: token.platform } });
});

const unregisterSchema = z.object({ expoToken: z.string().min(1) });

/** Called on sign-out so a shared/reset device stops receiving pushes meant for the signed-out user. */
pushTokensRouter.delete('/push-tokens', async (req: AuthedRequest, res) => {
  const parsed = unregisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await prisma.pushToken.deleteMany({
    where: { expoToken: parsed.data.expoToken, userId: req.user!.id },
  });
  res.status(204).send();
});
