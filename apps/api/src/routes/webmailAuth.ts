import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { decryptSecret } from '../lib/secretsVault';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { logger } from '../lib/logger';
import { storeState, consumeState } from '../lib/redis';

import crypto from 'crypto';

export const webmailAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const ssoExchangeSchema = z.object({
  ssoToken: z.string().min(1),
});

const ssoTicketSchema = z.object({
  smtpAccountId: z.string().optional(),
});

function omitCredentialRef<T extends { credentialRef: string }>(account: T) {
  const { credentialRef, ...rest } = account;
  return rest;
}

/**
 * POST /api/webmail/auth/login
 * Direct authentication endpoint for standalone webmail users.
 * B-11 FIX: Protected by authRateLimiter and uses indexed DB queries.
 */
webmailAuthRouter.post('/webmail/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const inputClean = email.toLowerCase().trim();

  // Parse email parts if format is username@domain
  const atIdx = inputClean.lastIndexOf('@');
  const userPrefix = atIdx > -1 ? inputClean.substring(0, atIdx) : inputClean;
  const domainPart = atIdx > -1 ? inputClean.substring(atIdx + 1) : '';

  // B-11 FIX: Indexed lookup instead of loading all accounts into memory
  const account = await prisma.smtpAccount.findFirst({
    where: {
      OR: [
        { smtpUsername: inputClean },
        ...(domainPart ? [{ smtpUsername: userPrefix, customDomain: domainPart }] : []),
        { aliases: { has: inputClean } },
      ],
    },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });

  if (!account || !account.credentialRef) {
    return res.status(401).json({ error: 'Invalid email address or password' });
  }

  if (account.isSuspended) {
    return res.status(403).json({ error: 'Mailbox account is suspended. Please contact platform support.' });
  }

  try {
    const storedPass = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
    const passBuffer = Buffer.from(password);
    const storedBuffer = Buffer.from(storedPass);
    const passwordsMatch = passBuffer.length === storedBuffer.length && crypto.timingSafeEqual(passBuffer, storedBuffer);

    if (!passwordsMatch) {
      return res.status(401).json({ error: 'Invalid email address or password' });
    }

    const token = jwt.sign(
      {
        accountId: account.id,
        userId: account.userId,
        email: account.smtpUsername,
        customDomain: account.customDomain || env.rootDomain,
        type: 'webmail_session',
      },
      env.projectAuthJwtSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    logger.info({ accountId: account.id, email: inputClean }, 'Webmail direct authentication successful');
    res.json({
      ok: true,
      token,
      account: omitCredentialRef(account),
    });
  } catch (err: any) {
    logger.error({ err: err.message, accountId: account.id }, 'Webmail auth decryption error');
    res.status(500).json({ error: 'Authentication service error' });
  }
});

/**
 * POST /api/webmail/auth/sso-ticket
 * Mints a single-use SSO token for launching standalone webmail from customer dashboard.
 */
webmailAuthRouter.post('/webmail/auth/sso-ticket', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ssoTicketSchema.safeParse(req.body);
  const requestedAccountId = parsed.success ? parsed.data.smtpAccountId : undefined;
  const userId = req.user!.id;
  const role = req.user!.role;

  let account: any = null;
  if (requestedAccountId) {
    account = await prisma.smtpAccount.findUnique({ where: { id: requestedAccountId } });
  } else {
    // B-20 FIX: Default to caller's own mailbox or explicitly allowed mailboxes first.
    account = await prisma.smtpAccount.findFirst({
      where: { OR: [{ userId }, { allowedAdminIds: { has: userId } }] },
      orderBy: { createdAt: 'asc' },
    });

    // If caller is dev and has no assigned mailbox, permit fallback only if explicit
    if (!account && role === 'dev') {
      account = await prisma.smtpAccount.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }
  }

  if (!account) {
    return res.status(404).json({ error: 'No provisioned mailbox account found for current user' });
  }

  if (role !== 'dev' && account.userId !== userId && !account.allowedAdminIds?.includes(userId)) {
    return res.status(403).json({ error: 'Access denied to this mailbox account' });
  }

  const ticketId = crypto.randomUUID();
  const ssoToken = jwt.sign(
    {
      jti: ticketId,
      accountId: account.id,
      userId: account.userId,
      email: account.smtpUsername,
      type: 'sso_ticket',
    },
    env.projectAuthJwtSecret,
    { expiresIn: '60s', algorithm: 'HS256' }
  );

  await storeState('webmail_sso', ticketId, { accountId: account.id, userId: account.userId }, 60);

  res.json({ ssoToken, webmailUrl: `/webmail?ssoToken=${ssoToken}` });
});

/**
 * POST /api/webmail/auth/sso-exchange
 * Exchanges a single-use SSO ticket for a long-lived Webmail session token.
 */
webmailAuthRouter.post('/webmail/auth/sso-exchange', async (req: Request, res: Response) => {
  const parsed = ssoExchangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const payload = jwt.verify(parsed.data.ssoToken, env.projectAuthJwtSecret, { algorithms: ['HS256'] }) as any;
    if (payload.type !== 'sso_ticket' || !payload.accountId || !payload.jti) {
      return res.status(401).json({ error: 'Invalid or expired SSO token' });
    }

    const state = await consumeState<{ accountId: string; userId: string }>('webmail_sso', payload.jti);
    if (!state || state.accountId !== payload.accountId) {
      return res.status(401).json({ error: 'SSO ticket has already been used or expired' });
    }

    const account = await prisma.smtpAccount.findUnique({
      where: { id: payload.accountId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    if (!account || account.isSuspended) {
      return res.status(401).json({ error: 'Mailbox account not available or suspended' });
    }

    const token = jwt.sign(
      {
        accountId: account.id,
        userId: account.userId,
        email: account.smtpUsername,
        customDomain: account.customDomain || env.rootDomain,
        type: 'webmail_session',
      },
      env.projectAuthJwtSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.json({
      ok: true,
      token,
      account: omitCredentialRef(account),
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired SSO ticket' });
  }
});

/**
 * GET /api/webmail/auth/me
 * Retrieves active Webmail session metadata.
 */
webmailAuthRouter.get('/webmail/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || req.headers['x-webmail-token'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthenticated webmail session' });
  }

  try {
    const payload = jwt.verify(token, env.projectAuthJwtSecret, { algorithms: ['HS256'] }) as any;
    if (payload.type !== 'webmail_session' || !payload.accountId) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const account = await prisma.smtpAccount.findUnique({
      where: { id: payload.accountId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    if (!account) return res.status(404).json({ error: 'Mailbox account not found' });

    res.json({
      account: omitCredentialRef(account),
      session: payload,
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Expired or invalid webmail session' });
  }
});
