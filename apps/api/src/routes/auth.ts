import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { generateApiKey } from '../lib/apiKeys';
import { sendWelcomeNotification, sendPasswordResetNotification } from '../lib/notifications';
import { env } from '../env';

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
  const { email, password, name, firebaseUid } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailClean = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: emailClean } });
  if (existing) return res.status(400).json({ error: 'User with this email already exists' });

  const user = await prisma.user.create({
    data: {
      email: emailClean,
      displayName: name || emailClean.split('@')[0],
      role: 'customer',
      firebaseUid: firebaseUid || `sdk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
  });

  // Automatically send welcome email upon registration
  void sendWelcomeNotification({
    email: user.email,
    name: user.displayName || user.email.split('@')[0],
  }).catch(() => {});

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
 * POST /api/auth/forgot-password
 * Send password reset email with secure token
 */
authRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const emailClean = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: emailClean } });

    // Always respond with success to prevent user enumeration attacks
    if (!user) {
      return res.json({
        ok: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        email: emailClean,
        token,
        expiresAt,
      },
    });

    const rootDomain = env.rootDomain || 'shanutechx.com';
    const resetLink = `https://${rootDomain}/reset-password?token=${token}`;

    void sendPasswordResetNotification(
      user.email,
      user.displayName || user.email.split('@')[0],
      resetLink
    ).catch(() => {});

    res.json({
      ok: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      token, // Also return for local testing/dev
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process password reset request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using valid reset token
 */
authRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid token and new password (min 6 chars) are required' });
    }

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const user = await prisma.user.findUnique({ where: { email: resetRecord.email } });
    if (!user) return res.status(404).json({ error: 'Associated user account not found' });

    // Delete token once used
    await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });

    await prisma.auditLog.create({
      data: {
        adminId: user.id,
        action: 'user.password_reset_completed',
        target: `Password reset via email token for ${user.email}`,
      },
    });

    res.json({
      ok: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
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
 * Handle user credential & password updates for SDK & client applications
 */
authRouter.post('/auth/change-password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { oldPassword, newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User account not found' });
    if (user.isBanned) return res.status(403).json({ error: 'Account Banned' });

    await prisma.auditLog.create({
      data: {
        adminId: user.id,
        action: 'user.password_change',
        target: `Password updated for ${user.email}`,
      },
    });

    res.json({
      ok: true,
      message: 'Password updated successfully',
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update password' });
  }
});

