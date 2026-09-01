import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { generateApiKey } from '../lib/apiKeys';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * SDK Auth endpoint for programmatic login
 */
authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailClean = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: emailClean } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.isBanned) return res.status(403).json({ error: 'Account Banned', message: user.banReason || 'Policy Violation' });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label: `SDK Session Token (${new Date().toISOString().slice(0, 10)})`,
      keyHash,
      keyPrefix,
    },
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  res.json({
    token: rawKey,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/register
 * SDK Auth endpoint for account registration
 */
authRouter.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailClean = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: emailClean } });
  if (existing) return res.status(400).json({ error: 'User with this email already exists' });

  const user = await prisma.user.create({
    data: {
      email: emailClean,
      displayName: name || emailClean.split('@')[0],
      role: 'customer',
      firebaseUid: `sdk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
  });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label: `SDK Session Token (${new Date().toISOString().slice(0, 10)})`,
      keyHash,
      keyPrefix,
    },
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  res.json({
    token: rawKey,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/refresh
 * Refresh active SDK token session
 */
authRouter.post('/auth/refresh', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isBanned) return res.status(403).json({ error: 'Account Banned' });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label: `SDK Refreshed Token (${new Date().toISOString().slice(0, 10)})`,
      keyHash,
      keyPrefix,
    },
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  res.json({
    token: rawKey,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/change-password
 * Change password stub for SDK compatibility
 */
authRouter.post('/auth/change-password', requireAuth, async (_req: AuthedRequest, res) => {
  res.json({ ok: true, message: 'Password change requested' });
});
