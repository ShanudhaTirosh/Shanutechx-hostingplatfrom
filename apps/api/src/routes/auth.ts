import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { generateApiKey, hashApiKey } from '../lib/apiKeys';
import { sendWelcomeNotification } from '../lib/notifications';
import { firebaseAuth } from '../lib/firebaseAdmin';
import { logger } from '../lib/logger';

export const authRouter = Router();

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Centralises the verification logic for login and register.
 */
async function verifyIdToken(idToken: string) {
  if (!firebaseAuth) {
    return { error: 'Firebase authentication service is not configured on server', status: 503 as const, decoded: null };
  }
  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    return { error: null, status: 200 as const, decoded };
  } catch (err: any) {
    return { error: `Invalid or expired Firebase ID token: ${err.code ?? err.message}`, status: 401 as const, decoded: null };
  }
}

/**
 * POST /api/auth/login
 *
 * Enforces Google, GitHub & Discord OAuth SSO policy.
 *
 * SECURITY: The Firebase ID token is cryptographically verified via
 * firebaseAuth.verifyIdToken(). Only the verified email from the decoded
 * token is used for user lookup — client-supplied email is ignored.
 */
authRouter.post('/auth/login', authRateLimiter, async (req, res) => {
  const { idToken, provider } = req.body || {};

  // Require a real Firebase ID token
  if (!idToken) {
    return res.status(400).json({
      error: 'Firebase ID token is required',
      message: 'ShanuTechX Cloud enforces Google, GitHub & Discord OAuth Single Sign-On (SSO). Please authenticate using Google, GitHub, or Discord.',
      allowedProviders: ['google', 'github', 'discord'],
    });
  }

  // ── Verify the token cryptographically ──
  const { error, status, decoded } = await verifyIdToken(idToken);
  if (!decoded) {
    return res.status(status).json({ error });
  }

  if (!decoded.email) {
    return res.status(401).json({ error: 'OAuth token does not contain an email claim. Please use an OAuth provider that shares your email.' });
  }

  // Enforce allowed OAuth SSO providers
  const signInProvider = decoded.firebase?.sign_in_provider;
  const allowedProviders = ['google.com', 'github.com', 'oidc.discord', 'custom', 'password'];
  if (signInProvider && !allowedProviders.includes(signInProvider)) {
    return res.status(403).json({
      error: 'Unauthorized OAuth Provider',
      message: 'ShanuTechX Cloud enforces Google, GitHub, Discord, and Email/Password authentication.',
    });
  }

  // Use ONLY the verified email — never the client-supplied one
  const emailClean = decoded.email.toLowerCase().trim();

  // Look up user by firebaseUid first (canonical), then by verified email
  let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });

  if (!user) {
    // Fall back to email lookup, but only if the email is verified by Firebase
    if (decoded.email_verified) {
      user = await prisma.user.findUnique({ where: { email: emailClean } });
      if (user) {
        // Link the existing account to this Firebase UID
        user = await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: decoded.uid },
        });
      }
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please register first via Google, GitHub, or Discord.' });
  }

  if (user.isBanned) {
    return res.status(403).json({ error: 'Account Banned', message: user.banReason || 'Policy Violation' });
  }

  // Sync display name from OAuth provider if changed
  const oauthName = decoded.name || null;
  if (oauthName && oauthName !== user.displayName) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { displayName: oauthName },
    });
  }

  // Sync email if Firebase reports a change (e.g. user changed primary email)
  if (emailClean !== user.email) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email: emailClean },
    });
  }

  // Revoke previous OAuth session tokens for this user to prevent token accumulation
  await prisma.apiKey.updateMany({
    where: {
      userId: user.id,
      label: { startsWith: 'OAuth Session Token' },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  }).catch(() => null);

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label: `OAuth Session Token (${new Date().toISOString().slice(0, 10)})`,
      keyHash,
      keyPrefix,
    },
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  logger.info({ msg: 'User logged in via verified OAuth', userId: user.id, provider: provider || decoded.firebase?.sign_in_provider });

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
 *
 * Register a new user from a verified Google, GitHub, or Discord OAuth identity.
 *
 * SECURITY: The Firebase ID token is cryptographically verified.
 * If an account already exists with a *different* firebaseUid, the request
 * is rejected with 409 to prevent identity hijacking.
 */
authRouter.post('/auth/register', authRateLimiter, async (req, res) => {
  const { idToken, provider } = req.body || {};

  if (!idToken) {
    return res.status(400).json({
      error: 'Firebase ID token is required for registration',
      allowedProviders: ['google', 'github', 'discord'],
    });
  }

  // ── Verify the token cryptographically ──
  const { error, status, decoded } = await verifyIdToken(idToken);
  if (!decoded) {
    return res.status(status).json({ error });
  }

  if (!decoded.email) {
    return res.status(401).json({ error: 'OAuth token does not contain an email claim.' });
  }

  const emailClean = decoded.email.toLowerCase().trim();
  const firebaseUid = decoded.uid;
  const name = decoded.name || emailClean.split('@')[0];

  // Check if an account already exists
  let user = await prisma.user.findUnique({ where: { firebaseUid } });

  if (user) {
    // Already registered with this Firebase UID — return existing account
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: `OAuth Session Token (${new Date().toISOString().slice(0, 10)})`,
        keyHash,
        keyPrefix,
      },
    });

    return res.json({
      token: rawKey,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  }

  // Check if email is already taken by a DIFFERENT Firebase UID
  const existingByEmail = await prisma.user.findUnique({ where: { email: emailClean } });
  if (existingByEmail) {
    if (existingByEmail.firebaseUid && existingByEmail.firebaseUid !== firebaseUid) {
      // SECURITY: Reject — do NOT overwrite an existing user's firebaseUid.
      // This prevents identity hijacking where attacker registers with the
      // same email via a different provider and silently takes over the account.
      logger.warn({
        msg: 'Registration rejected: email already linked to different Firebase UID',
        email: emailClean,
        existingUid: existingByEmail.firebaseUid.slice(0, 8) + '...',
        attemptedUid: firebaseUid.slice(0, 8) + '...',
      });
      return res.status(409).json({
        error: 'An account with this email already exists and is linked to a different identity.',
        message: 'Please log in with the original provider you used to create your account.',
      });
    }

    // Account exists but has no firebaseUid — link it (only if email is verified)
    if (decoded.email_verified) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { firebaseUid, displayName: name || existingByEmail.displayName },
      });
    } else {
      return res.status(401).json({
        error: 'Email not verified by OAuth provider. Cannot link to existing account.',
      });
    }
  } else {
    // Brand new user
    user = await prisma.user.create({
      data: {
        email: emailClean,
        displayName: name,
        role: 'customer',
        firebaseUid,
      },
    });

    void sendWelcomeNotification({
      email: user.email,
      name: user.displayName || user.email.split('@')[0],
    }).catch(() => {});
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label: `OAuth Session Token (${new Date().toISOString().slice(0, 10)})`,
      keyHash,
      keyPrefix,
    },
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  logger.info({ msg: 'New user registered via verified OAuth', userId: user.id, provider: provider || decoded.firebase?.sign_in_provider });

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
 * POST /api/auth/reset-password
 * POST /api/auth/change-password
 *
 * REMOVED — ShanuTechX is an OAuth-only platform (Google, GitHub, Discord SSO).
 * There is no passwordHash field on the User model — these endpoints previously
 * accepted passwords but never persisted them, creating a false sense of security.
 * Password management is handled by the upstream OAuth provider.
 */
authRouter.post('/auth/forgot-password', (_req, res) => {
  res.status(410).json({
    error: 'Password management is not available',
    message: 'ShanuTechX uses OAuth SSO exclusively. To reset your password, visit your Google, GitHub, or Discord account settings.',
  });
});

authRouter.post('/auth/reset-password', (_req, res) => {
  res.status(410).json({
    error: 'Password management is not available',
    message: 'ShanuTechX uses OAuth SSO exclusively. To reset your password, visit your Google, GitHub, or Discord account settings.',
  });
});

authRouter.post('/auth/change-password', (_req, res) => {
  res.status(410).json({
    error: 'Password management is not available',
    message: 'ShanuTechX uses OAuth SSO exclusively. To change your password, visit your Google, GitHub, or Discord account settings.',
  });
});

/**
 * POST /api/auth/refresh
 * Refresh active SDK token session (requires existing valid auth)
 */
authRouter.post('/auth/refresh', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isBanned) return res.status(403).json({ error: 'Account Banned' });

  // Revoke current calling key if provided via x-api-key or bearer
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const header = req.headers.authorization;
  const currentToken = apiKeyHeader || (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);
  if (currentToken && currentToken.startsWith('shx_')) {
    const keyHash = hashApiKey(currentToken);
    await prisma.apiKey.updateMany({
      where: { keyHash, userId: user.id },
      data: { revokedAt: new Date() },
    }).catch(() => null);
  }

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


