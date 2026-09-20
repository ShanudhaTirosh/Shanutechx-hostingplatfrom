import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { env } from '../env';

import { authRateLimiter } from '../middleware/rateLimit';

export const settingsRouter = Router();

// All settings routes require authentication
settingsRouter.use(requireAuth);

const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password or PIN is required'),
});

/**
 * Verify settings password or PIN.
 *
 * The new behavior fails closed: if the user hasn't set a PIN yet
 * (User.settingsPinHash is null), verification always fails and the
 * response tells the caller to set one via POST /settings/change-pin
 * first. There is no master/bypass value of any kind.
 */
settingsRouter.post('/verify-password', requireAdminOrDev, authRateLimiter, async (req: AuthedRequest, res) => {
  const parsed = verifyPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Password or PIN is required' });
  }

  const inputPass = parsed.data.password.trim();
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settingsPinHash: true } });

  if (!user?.settingsPinHash) {
    return res.status(412).json({
      error: 'No settings PIN has been configured yet. Set one first.',
      pinConfigured: false,
    });
  }

  const isValid = await bcrypt.compare(inputPass, user.settingsPinHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password or PIN. Please try again.' });
  }

  return res.json({
    ok: true,
    unlocked: true,
    expiresInSeconds: 1800, // 30 minutes unlock session
    message: 'Settings unlocked successfully.',
  });
});

const changePinSchema = z.object({
  // Optional: absent/omitted only when the user has never set a PIN
  // before (first-time setup). Once a PIN exists, this is required and
  // must match it -- there is no master-override value that bypasses it.
  currentPin: z.string().min(1).optional(),
  newPin: z.string().min(4, 'PIN/Password must be at least 4 characters long'),
});

/**
 * Set / change the settings security PIN.
 */
settingsRouter.post('/change-pin', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = changePinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { currentPin, newPin } = parsed.data;
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settingsPinHash: true } });

  if (user?.settingsPinHash) {
    if (!currentPin) {
      return res.status(400).json({ error: 'Current PIN/Password is required.' });
    }
    const matches = await bcrypt.compare(currentPin, user.settingsPinHash);
    if (!matches) {
      return res.status(401).json({ error: 'Current PIN/Password is incorrect.' });
    }
  }
  // else: no PIN configured yet -- this is first-time setup, currentPin not required.

  const newHash = await bcrypt.hash(newPin, 12);
  await prisma.user.update({ where: { id: userId }, data: { settingsPinHash: newHash } });

  await prisma.auditLog.create({
    data: {
      adminId: userId,
      action: 'settings.change_pin',
      target: `Updated settings security PIN for ${req.user!.email}`,
    },
  });

  return res.json({
    ok: true,
    message: 'Settings security PIN updated successfully.',
  });
});

/**
 * Get consolidated system configuration status overview.
 */
settingsRouter.get('/configs', requireAdminOrDev, async (req: AuthedRequest, res) => {
  try {
    const [webhookCount, backupHistory] = await Promise.all([
      prisma.discordWebhookConfig.count().catch(() => 0),
      prisma.backupRun.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }).catch(() => []),
    ]);

    const smtpConfigured = !!(process.env.SMTP_HOST || process.env.SMTP_USER || process.env.POSTAL_API_KEY);
    const r2Configured = !!(process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_BUCKET);
    const discordConfigured = webhookCount > 0 || !!process.env.DISCORD_WEBHOOK_URL || !!process.env.DISCORD_BOT_TOKEN;

    const githubBackupConfigured = !!(process.env.BACKUP_GITHUB_TOKEN || env.backupGithubToken);

    return res.json({
      configs: {
        discordWebhooks: {
          configured: discordConfigured,
          count: webhookCount > 0 ? webhookCount : (discordConfigured ? 1 : 0),
        },
        backups: {
          configured: r2Configured || githubBackupConfigured,
          lastBackup: backupHistory[0] || null,
          totalRuns: backupHistory.length,
        },
        smtpServer: {
          configured: smtpConfigured,
        },
        r2Storage: {
          configured: r2Configured,
        },
        githubBackup: {
          configured: githubBackupConfigured,
          org: env.backupGithubOrg || process.env.BACKUP_GITHUB_ORG || '',
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch settings configs' });
  }
});

const githubBackupSchema = z.object({
  token: z.string().trim().min(1, 'GitHub Token is required'),
  org: z.string().trim().optional(),
});

/**
 * Get GitHub Backup credentials overview (masked).
 */
settingsRouter.get('/github-backup', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const token = env.backupGithubToken || process.env.BACKUP_GITHUB_TOKEN || '';
  const org = env.backupGithubOrg || process.env.BACKUP_GITHUB_ORG || '';

  const maskedToken = token
    ? `${token.slice(0, 4)}...${token.slice(-4)}`
    : '';

  return res.json({
    configured: !!token,
    org: org,
    maskedToken: maskedToken,
  });
});

/**
 * Update GitHub System API Token and Backup Organization.
 */
settingsRouter.post('/github-backup', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = githubBackupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { token, org } = parsed.data;

  process.env.BACKUP_GITHUB_TOKEN = token;
  env.backupGithubToken = token;
  if (org !== undefined) {
    process.env.BACKUP_GITHUB_ORG = org;
    env.backupGithubOrg = org;
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'settings.github_backup_update',
      target: `Updated platform GitHub system token & backup org (${org || 'personal account'})`,
    },
  });

  return res.json({
    ok: true,
    message: 'Platform GitHub System credentials updated successfully.',
    configured: true,
    org: env.backupGithubOrg,
  });
});

/**
 * Test GitHub API Token connection and verify user/org access & scopes.
 */
settingsRouter.post('/github-backup/test', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const testToken = req.body?.token?.trim() || env.backupGithubToken || process.env.BACKUP_GITHUB_TOKEN || '';
  const testOrg = req.body?.org?.trim() ?? (env.backupGithubOrg || process.env.BACKUP_GITHUB_ORG || '');

  if (!testToken) {
    return res.status(400).json({ error: 'No GitHub API token provided or configured.' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${testToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ShanuTechX-Platform',
      },
    });

    if (!userRes.ok) {
      const errText = await userRes.text().catch(() => '');
      return res.status(400).json({
        ok: false,
        error: `GitHub API authentication failed (HTTP ${userRes.status}): ${errText || 'Invalid token'}`,
      });
    }

    const userData: any = await userRes.json();
    const scopes = userRes.headers.get('x-oauth-scopes') || 'repo, workflow';

    let orgDetails: any = null;
    if (testOrg) {
      const orgRes = await fetch(`https://api.github.com/orgs/${testOrg}`, {
        headers: {
          Authorization: `Bearer ${testToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ShanuTechX-Platform',
        },
      });

      if (orgRes.ok) {
        const orgData: any = await orgRes.json();
        orgDetails = {
          login: orgData.login,
          name: orgData.name,
          publicRepos: orgData.public_repos,
          totalPrivateRepos: orgData.total_private_repos || orgData.owned_private_repos || 0,
        };
      }
    }

    return res.json({
      ok: true,
      user: {
        login: userData.login,
        name: userData.name,
        publicRepos: userData.public_repos,
        totalPrivateRepos: userData.total_private_repos || 0,
        avatarUrl: userData.avatar_url,
      },
      scopes: scopes,
      org: orgDetails,
      message: `Successfully connected to GitHub as @${userData.login}${orgDetails ? ` with organization @${orgDetails.login}` : ''}!`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Network error connecting to GitHub API' });
  }
});

