import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { canAccessResource, accessActionForRequest } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { authRateLimiter } from '../middleware/rateLimit';
import {
  signProjectAuthToken,
  verifyProjectAuthToken,
  hashPassword,
  verifyPassword,
  createMagicLink,
  consumeMagicLink,
  findOrCreateVerifiedUser,
} from '../lib/projectAuthService';
import { OAUTH_PROVIDERS, OAuthProviderName } from '../lib/oauthProviders';
import { storeState, consumeState } from '../lib/redis';

export const projectAuthRouter = Router();

// ── End-user-facing auth endpoints — no platform auth required, these are ──
// ── called by the *project's own app*, not the ShanuTechX dashboard.      ──

const emailPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

projectAuthRouter.post('/projects/:id/auth/signup', authRateLimiter, async (req, res) => {
  const parsed = emailPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.projectAuthUser.findUnique({
    where: { projectId_email: { projectId: project.id, email } },
  });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.projectAuthUser.create({
    data: { projectId: project.id, email, passwordHash, lastLoginAt: new Date() },
  });

  const token = signProjectAuthToken({ sub: user.id, projectId: project.id, email });
  res.status(201).json({ token, user: { id: user.id, email: user.email, emailVerified: user.emailVerified } });
});

projectAuthRouter.post('/projects/:id/auth/login', authRateLimiter, async (req, res) => {
  const parsed = emailPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.projectAuthUser.findUnique({
    where: { projectId_email: { projectId: req.params.id, email } },
  });

  // Same error for "no such user" and "wrong password" — don't leak which one.
  if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await prisma.projectAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signProjectAuthToken({ sub: user.id, projectId: req.params.id, email });
  res.json({ token, user: { id: user.id, email: user.email, emailVerified: user.emailVerified } });
});

/**
 * Validates that a target redirectUrl is safe:
 * - Must be valid HTTP or HTTPS URL
 * - Must have origin matching one of the project's configured OAuth redirectUri origins (if configured)
 */
async function validateProjectRedirectUrl(
  projectId: string,
  redirectUrlStr: string,
  providerConfig?: { redirectUri: string } | null
): Promise<boolean> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redirectUrlStr);
  } catch {
    return false;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return false;
  }

  if (providerConfig?.redirectUri) {
    try {
      const allowedOrigin = new URL(providerConfig.redirectUri).origin;
      if (parsedUrl.origin === allowedOrigin) return true;
    } catch (_) {}
  }

  const oauthConfigs = await prisma.projectOAuthConfig.findMany({
    where: { projectId },
    select: { redirectUri: true },
  });

  const allowedOrigins = new Set<string>();
  for (const c of oauthConfigs) {
    try {
      allowedOrigins.add(new URL(c.redirectUri).origin);
    } catch (_) {}
  }

  if (allowedOrigins.has(parsedUrl.origin)) {
    return true;
  }

  // Check if redirect matches any deployments owned by the project's user
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (project?.userId) {
    const userDeployments = await prisma.deployment.findMany({
      where: { userId: project.userId },
      select: { subdomain: true, customDomain: true },
    });

    const rootDomain = env.rootDomain || 'shanutechx.com';
    for (const d of userDeployments) {
      if (d.subdomain && parsedUrl.hostname === `${d.subdomain}.${rootDomain}`) {
        return true;
      }
      if (d.customDomain && parsedUrl.hostname === d.customDomain) {
        return true;
      }
    }
  }

  return false;
}

const magicLinkRequestSchema = z.object({ email: z.string().email(), redirectUrl: z.string().url() });

/**
 * Sends a magic sign-in link to the given email. `redirectUrl` is the
 * project's own app page that should receive the token (e.g.
 * https://myapp.example.com/auth/callback) — this endpoint appends
 * `?token=...` to it and emails that full URL.
 */
projectAuthRouter.post('/projects/:id/auth/magic-link', authRateLimiter, async (req, res) => {
  const parsed = magicLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isValidRedirect = await validateProjectRedirectUrl(project.id, parsed.data.redirectUrl);
  if (!isValidRedirect) {
    return res.status(400).json({ error: 'Invalid or unauthorized redirectUrl' });
  }

  const rawToken = await createMagicLink(project.id, parsed.data.email);
  const link = `${parsed.data.redirectUrl}${parsed.data.redirectUrl.includes('?') ? '&' : '?'}token=${rawToken}`;

  let mailError: string | undefined;
  try {
    const smtpHost = process.env.SMTP_HOST || 'mail.shanutechx.com';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      await sendSmtpEmail(
        {
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          user: smtpUser,
          pass: smtpPass,
        },
        {
          from: `"${project.name}" <${env.wildduckFromAddress}>`,
          to: parsed.data.email,
          subject: `Sign in to ${project.name}`,
          html: `<p>Click below to sign in. This link expires in 15 minutes and can only be used once.</p><p><a href="${link}">${link}</a></p>`,
          text: `Sign in to ${project.name}: ${link} (expires in 15 minutes, single use)`,
        }
      );
    }
  } catch (err: any) {
    mailError = err.message;
  }

  res.status(202).json({
    sent: !mailError,
    mailError,
  });
});

const magicLinkVerifySchema = z.object({ token: z.string().min(1) });

projectAuthRouter.post('/projects/:id/auth/magic-link/verify', async (req, res) => {
  const parsed = magicLinkVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = await consumeMagicLink(req.params.id, parsed.data.token);
  if (!email) return res.status(401).json({ error: 'Invalid or expired link' });

  const user = await findOrCreateVerifiedUser(req.params.id, email);
  const token = signProjectAuthToken({ sub: user.id, projectId: req.params.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, emailVerified: user.emailVerified } });
});

/** Verifies a bearer token issued by any of the flows above — for the project's own backend to check a request is authenticated. */
projectAuthRouter.get('/projects/:id/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    const payload = verifyProjectAuthToken(token);
    if (payload.projectId !== req.params.id) return res.status(401).json({ error: 'Token is for a different project' });
    res.json({ userId: payload.sub, email: payload.email });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── OAuth (Google / GitHub / Discord) ───────────────────────────────────────

const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

interface OAuthStateData {
  projectId: string;
  provider: OAuthProviderName;
  redirectUrl: string;
  expiresAt: number;
}

projectAuthRouter.get('/projects/:id/auth/oauth/:provider/start', async (req, res) => {
  const provider = req.params.provider as OAuthProviderName;
  const providerDef = OAUTH_PROVIDERS[provider];
  if (!providerDef) return res.status(400).json({ error: 'Unknown provider' });

  const redirectUrl = typeof req.query.redirectUrl === 'string' ? req.query.redirectUrl : null;
  if (!redirectUrl) return res.status(400).json({ error: 'redirectUrl query param is required' });

  const config = await prisma.projectOAuthConfig.findUnique({
    where: { projectId_provider: { projectId: req.params.id, provider } },
  });
  if (!config) return res.status(404).json({ error: `${provider} is not configured for this project` });

  const isValidRedirect = await validateProjectRedirectUrl(req.params.id, redirectUrl, config);
  if (!isValidRedirect) {
    return res.status(400).json({ error: 'Invalid or unauthorized redirectUrl' });
  }

  const state = crypto.randomUUID();
  const stateData: OAuthStateData = {
    projectId: req.params.id,
    provider,
    redirectUrl,
    expiresAt: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000,
  };
  await storeState('oauth_state', state, stateData, OAUTH_STATE_TTL_SECONDS);

  const url = new URL(providerDef.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', providerDef.scope);
  url.searchParams.set('state', state);

  res.redirect(url.toString());
});

projectAuthRouter.get('/projects/:id/auth/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider as OAuthProviderName;
  const providerDef = OAUTH_PROVIDERS[provider];
  if (!providerDef) return res.status(400).json({ error: 'Unknown provider' });

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  const stateEntry = await consumeState<OAuthStateData>('oauth_state', state);
  if (!stateEntry || stateEntry.projectId !== req.params.id || stateEntry.provider !== provider || stateEntry.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired OAuth state' });
  }

  const config = await prisma.projectOAuthConfig.findUnique({
    where: { projectId_provider: { projectId: req.params.id, provider } },
  });
  if (!config) return res.status(404).json({ error: `${provider} is not configured for this project` });

  try {
    const tokenRes = await fetch(providerDef.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: decryptSecret(config.clientSecret, env.secretsEncryptionKey),
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(502).json({ error: 'OAuth provider did not return an access token', detail: tokenData });
    }

    const profileRes = await fetch(providerDef.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileRes.json();
    let { providerUserId, email } = providerDef.extractProfile(profile);

    // GitHub commonly omits email from /user unless it's public — fetch
    // /user/emails and take the primary, verified one as a fallback.
    if (!email && provider === 'github') {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'ShanuTechX-Platform',
        },
      });
      const emails: any[] = (await emailsRes.json().catch(() => [])) as any[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }

    if (!email) {
      return res.status(400).json({ error: `Could not obtain a verified email address from ${provider}` });
    }

    const existingAccount = await prisma.projectOAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { authUser: true },
    });

    const authUser = existingAccount?.authUser ?? (await findOrCreateVerifiedUser(req.params.id, email));

    if (!existingAccount) {
      await prisma.projectOAuthAccount.create({
        data: { authUserId: authUser.id, provider, providerUserId },
      });
    }

    const jwtToken = signProjectAuthToken({ sub: authUser.id, projectId: req.params.id, email: authUser.email });
    const finalUrl = new URL(stateEntry.redirectUrl);
    finalUrl.hash = `token=${jwtToken}`;
    res.redirect(finalUrl.toString());
  } catch (err: any) {
    res.status(502).json({ error: `OAuth exchange with ${provider} failed: ${err.message}` });
  }
});

// ── Project owner (dev/admin) config + user management ─────────────────────

const oauthConfigSchema = z.object({
  provider: z.enum(['google', 'github', 'discord']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
});

async function resolveProjectAuthAccess(projectId: string, req: AuthedRequest) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (req.user?.role !== 'dev' && !(await canAccessResource(project.userId, req, undefined, undefined, accessActionForRequest(req)))) {
    return null;
  }
  return project;
}

projectAuthRouter.post('/projects/:id/auth/oauth-config', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  const project = await resolveProjectAuthAccess(req.params.id, req);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const parsed = oauthConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = await prisma.projectOAuthConfig.upsert({
    where: { projectId_provider: { projectId: req.params.id, provider: parsed.data.provider } },
    create: {
      projectId: req.params.id,
      provider: parsed.data.provider,
      clientId: parsed.data.clientId,
      clientSecret: encryptSecret(parsed.data.clientSecret, env.secretsEncryptionKey),
      redirectUri: parsed.data.redirectUri,
    },
    update: {
      clientId: parsed.data.clientId,
      clientSecret: encryptSecret(parsed.data.clientSecret, env.secretsEncryptionKey),
      redirectUri: parsed.data.redirectUri,
    },
    select: { id: true, provider: true, clientId: true, redirectUri: true },
  });

  res.status(201).json({ config });
});

projectAuthRouter.get('/projects/:id/auth/oauth-config', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  const project = await resolveProjectAuthAccess(req.params.id, req);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const configs = await prisma.projectOAuthConfig.findMany({
    where: { projectId: req.params.id },
    select: { id: true, provider: true, clientId: true, redirectUri: true },
  });
  res.json({ configs });
});

projectAuthRouter.get('/projects/:id/auth/users', requireAuth, requireAdminOrDev, async (req: AuthedRequest, res) => {
  const project = await resolveProjectAuthAccess(req.params.id, req);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const users = await prisma.projectAuthUser.findMany({
    where: { projectId: req.params.id },
    select: { id: true, email: true, emailVerified: true, createdAt: true, lastLoginAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});
