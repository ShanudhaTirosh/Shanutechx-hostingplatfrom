import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getProvider, listProviders } from '../lib/gitProviders';
import { verifyState } from '../lib/gitProviders/state';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import jwt from 'jsonwebtoken';

/**
 * Git repository access — GitHub App + GitLab OAuth application.
 * No PATs/deploy tokens are requested from or stored for the user:
 *
 *  - GitHub: the user installs a GitHub App and picks which repos to
 *    grant on GitHub's own UI. We store only the installation ID;
 *    every API call mints a fresh ~1-hour installation access token.
 *  - GitLab: the user authorizes an OAuth application with the minimum
 *    scopes (read_user, read_repository). Access + refresh tokens are
 *    encrypted at rest and refreshed automatically, never re-prompting
 *    the user for routine use.
 *
 * Both providers implement the same GitProviderAdapter interface
 * (lib/gitProviders/types.ts), so this router is provider-agnostic and
 * adding a third provider means implementing that interface and
 * registering it in lib/gitProviders/index.ts — nothing here changes.
 */

export const gitConnectRouter = Router();

const providerParam = z.enum(['github', 'gitlab']);

/** GET /api/git/config — which providers are configured on this deployment, for the frontend to show/hide "Connect X" buttons. */
gitConnectRouter.get('/git/config', requireAuth, (_req: AuthedRequest, res: Response) => {
  res.json({
    providers: listProviders().map((p) => ({ provider: p.provider, configured: p.isConfigured() })),
  });
});

/** GET /api/git/accounts — every connected account across every provider. */
gitConnectRouter.get('/git/accounts', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const allAccounts = (
    await Promise.all(listProviders().map((p) => p.listConnectedAccounts(userId)))
  ).flat();
  res.json({ accounts: allAccounts });
});

/**
 * GET /api/git/connect/:provider/start
 * Returns the URL the frontend should redirect the browser to in order
 * to connect an account — GitHub's App installation page, or GitLab's
 * OAuth authorize page. The frontend should navigate the browser here
 * directly (window.location.href = url); it never sees or handles a
 * token as part of this flow.
 */
gitConnectRouter.get('/git/connect/:provider/start', requireAuth, (req: AuthedRequest, res: Response) => {
  const parsedProvider = providerParam.safeParse(req.params.provider);
  if (!parsedProvider.success) return res.status(400).json({ error: 'Unsupported git provider' });

  const adapter = getProvider(parsedProvider.data);
  if (!adapter || !adapter.isConfigured()) {
    return res.status(400).json({ error: `${parsedProvider.data} is not configured on this server` });
  }

  res.json({ url: adapter.getConnectUrl(req.user!.id) });
});

/**
 * GitHub App installation callback. GitHub redirects here after the user
 * finishes the "Install App" flow.
 */
gitConnectRouter.get('/git/github/callback', async (req, res: Response) => {
  const { installation_id, state, setup_action } = req.query as Record<string, string | undefined>;

  if (!state) return res.status(400).send('Missing state parameter.');
  const verified = verifyState(state, 'github');
  if (!verified) {
    return res.status(400).send('This connection link has expired or is invalid. Please try connecting again from the dashboard.');
  }

  if (setup_action === 'request') {
    // The user requested installation but an org owner needs to approve it.
    return res.redirect(`${dashboardUrl()}/deployments?git_connect=pending&provider=github`);
  }

  if (!installation_id) return res.status(400).send('Missing installation_id.');

  try {
    const existingInstallation = await prisma.gitHubInstallation.findUnique({
      where: { installationId: installation_id },
    });

    if (existingInstallation && existingInstallation.userId !== verified.userId) {
      logger.warn(
        { installationId: installation_id, existingUserId: existingInstallation.userId, newUserId: verified.userId },
        'GitHub installation link rejected: installation already linked to another platform user'
      );
      return res.redirect(`${dashboardUrl()}/deployments?git_connect=error&reason=already_linked&provider=github`);
    }

    const details = await fetchInstallationDetails(installation_id);
    await prisma.gitHubInstallation.upsert({
      where: { installationId: installation_id },
      create: {
        userId: verified.userId,
        installationId: installation_id,
        accountLogin: details.accountLogin,
        accountType: details.accountType,
        avatarUrl: details.avatarUrl,
      },
      update: {
        accountLogin: details.accountLogin,
        accountType: details.accountType,
        avatarUrl: details.avatarUrl,
      },
    });
    return res.redirect(`${dashboardUrl()}/deployments?git_connect=success&provider=github`);
  } catch (err) {
    logger.error({ err, installationId: installation_id }, 'GitHub installation callback failed');
    return res.redirect(`${dashboardUrl()}/deployments?git_connect=error&provider=github`);
  }
});

/**
 * GitLab OAuth callback. GitLab redirects here with `code` + our signed
 * `state` after the user authorizes the application.
 */
gitConnectRouter.get('/git/gitlab/callback', async (req, res: Response) => {
  const { code, state } = req.query as Record<string, string | undefined>;

  if (!state) return res.status(400).send('Missing state parameter.');
  const verified = verifyState(state, 'gitlab');
  if (!verified) {
    return res.status(400).send('This connection link has expired or is invalid. Please try connecting again from the dashboard.');
  }
  if (!code) return res.status(400).send('Missing authorization code.');

  try {
    await exchangeGitLabCode(code, verified.userId);
    return res.redirect(`${dashboardUrl()}/deployments?git_connect=success&provider=gitlab`);
  } catch (err) {
    logger.error({ err }, 'GitLab OAuth callback failed');
    return res.redirect(`${dashboardUrl()}/deployments?git_connect=error&provider=gitlab`);
  }
});

/** GET /api/git/repos?accountId=... — repos/projects visible through one connected account. */
gitConnectRouter.get('/git/repos', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { accountId, provider } = req.query as { accountId?: string; provider?: string };
  if (!accountId) return res.status(400).json({ error: 'accountId is required' });

  const parsedProvider = providerParam.safeParse(provider ?? 'github');
  if (!parsedProvider.success) return res.status(400).json({ error: 'Unsupported git provider' });

  const adapter = getProvider(parsedProvider.data);
  if (!adapter) return res.status(400).json({ error: 'Unsupported git provider' });

  // Ownership check: the account must actually belong to this user.
  const accounts = await adapter.listConnectedAccounts(req.user!.id);
  const owned = accounts.find((a) => a.id === accountId);
  if (!owned) return res.status(403).json({ error: 'That connected account does not belong to you' });

  try {
    const repos = await adapter.listRepos(accountId);
    // No token is included in this response — deployment creation resolves
    // a fresh, scoped token server-side via gitAccountId instead.
    res.json({ repos, accountId, accountLabel: owned.accountLabel });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list repositories' });
  }
});

const disconnectSchema = z.object({
  provider: providerParam,
  accountId: z.string().min(1),
});

/** POST /api/git/disconnect — revoke and remove a connected account. */
gitConnectRouter.post('/git/disconnect', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = disconnectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const adapter = getProvider(parsed.data.provider);
  if (!adapter) return res.status(400).json({ error: 'Unsupported git provider' });

  await adapter.disconnect(req.user!.id, parsed.data.accountId);
  res.json({ ok: true });
});

// ── helpers ──────────────────────────────────────────────────────────────

function dashboardUrl(): string {
  return process.env.DASHBOARD_URL || `https://app.${process.env.ROOT_DOMAIN || 'shanutechx.com'}`;
}

async function fetchInstallationDetails(
  installationId: string
): Promise<{ accountLogin: string; accountType: string; avatarUrl: string | null }> {
  // Uses the same App-JWT auth as github.ts's mintInstallationToken, kept
  // local here since it's only needed once, at callback time, to display
  // which account/org was just connected.
  const now = Math.floor(Date.now() / 1000);
  const appJwt = jwt.sign(
    { iat: now - 30, exp: now + 9 * 60, iss: env.githubAppId },
    env.githubAppPrivateKey,
    { algorithm: 'RS256' }
  );
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ShanuTechX-Platform',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch installation details (${res.status})`);
  const data: any = await res.json();
  return {
    accountLogin: data.account?.login ?? 'unknown',
    accountType: data.account?.type ?? 'User',
    avatarUrl: data.account?.avatar_url ?? null,
  };
}

async function exchangeGitLabCode(code: string, userId: string): Promise<void> {
  const tokenRes = await fetch('https://gitlab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.gitlabAppClientId,
      client_secret: env.gitlabAppClientSecret,
      redirect_uri: env.gitlabRedirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`GitLab token exchange failed (${tokenRes.status})`);
  const tokenData: any = await tokenRes.json();

  const userRes = await fetch('https://gitlab.com/api/v4/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) throw new Error(`Failed to fetch GitLab user profile (${userRes.status})`);
  const gitlabUser: any = await userRes.json();

  await prisma.gitLabConnection.upsert({
    where: { userId_gitlabUserId: { userId, gitlabUserId: String(gitlabUser.id) } },
    create: {
      userId,
      gitlabUserId: String(gitlabUser.id),
      username: gitlabUser.username,
      avatarUrl: gitlabUser.avatar_url ?? null,
      accessTokenEnc: encryptSecret(tokenData.access_token, env.secretsEncryptionKey),
      refreshTokenEnc: encryptSecret(tokenData.refresh_token, env.secretsEncryptionKey),
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in ?? 7200) * 1000),
      scopes: tokenData.scope ?? '',
    },
    update: {
      username: gitlabUser.username,
      avatarUrl: gitlabUser.avatar_url ?? null,
      accessTokenEnc: encryptSecret(tokenData.access_token, env.secretsEncryptionKey),
      refreshTokenEnc: encryptSecret(tokenData.refresh_token, env.secretsEncryptionKey),
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in ?? 7200) * 1000),
      scopes: tokenData.scope ?? '',
    },
  });
}
