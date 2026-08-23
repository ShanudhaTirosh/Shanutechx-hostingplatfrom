import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { env } from '../../env';
import { logger } from '../logger';
import { createState } from './state';
import type { GitProviderAdapter, GitRepoSummary, ConnectedAccountSummary } from './types';

/**
 * GitHub App integration. No PATs are ever requested from or stored for
 * the user — access is entirely through a GitHub App installation:
 *
 *  1. The user is sent to GitHub's "Install App" page (getConnectUrl).
 *  2. They pick which repos (or "all repos") to grant, on GitHub's own
 *     UI — we never see or choose that.
 *  3. GitHub redirects back to our callback with an `installation_id`.
 *     We store *only* that ID (plus display metadata) — never a token.
 *  4. Every time we need to call the GitHub API, we mint a fresh,
 *     ~1-hour installation access token on demand (short-lived by
 *     GitHub's own design) using a JWT signed with the App's private
 *     key. Nothing long-lived ever leaves GitHub's servers.
 */

const GITHUB_API = 'https://api.github.com';

function isConfigured(): boolean {
  return Boolean(env.githubAppId && env.githubAppPrivateKey && env.githubAppSlug);
}

/** Signs a short-lived (9 minute, under GitHub's 10 minute cap) App JWT, used only to mint installation tokens — never sent to any third party besides GitHub. */
function signAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 30, exp: now + 9 * 60, iss: env.githubAppId },
    env.githubAppPrivateKey,
    { algorithm: 'RS256' }
  );
}

/** Mints a fresh installation access token (valid ~1 hour, GitHub-controlled expiry). Always requested fresh rather than cached across requests, since these calls are infrequent and this avoids any token-expiry bookkeeping. */
async function mintInstallationToken(installationId: string): Promise<string> {
  const appJwt = signAppJwt();
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to mint GitHub installation token (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.token as string;
}

export const githubProvider: GitProviderAdapter = {
  provider: 'github',

  isConfigured,

  getConnectUrl(userId: string): string {
    const state = createState(userId, 'github');
    // "Install App" flow: the user picks which account/org and which
    // repos on GitHub's own page. `state` round-trips back to our
    // callback so we know which ShanuTechX user to attach the
    // installation to.
    return `https://github.com/apps/${env.githubAppSlug}/installations/new?state=${encodeURIComponent(state)}`;
  },

  async listConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]> {
    const rows = await prisma.gitHubInstallation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return rows.map((r: any) => ({
      id: r.id,
      provider: 'github' as const,
      accountLabel: r.accountLogin,
      accountType: r.accountType,
      avatarUrl: r.avatarUrl,
      updatedAt: r.updatedAt.toISOString(),
    }));
  },

  async listRepos(accountId: string): Promise<GitRepoSummary[]> {
    const installation = await prisma.gitHubInstallation.findUnique({ where: { id: accountId } });
    if (!installation) throw new Error('GitHub installation not found');

    const token = await mintInstallationToken(installation.installationId);
    const repos: GitRepoSummary[] = [];
    // GitHub paginates installation repos; walk all pages (bounded to a
    // sane number so a runaway org can't hang this request forever).
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${GITHUB_API}/installation/repositories?per_page=100&page=${page}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!res.ok) throw new Error(`Failed to list GitHub repos (${res.status})`);
      const data = await res.json();
      for (const r of data.repositories ?? []) {
        repos.push({
          id: String(r.id),
          fullName: r.full_name,
          name: r.name,
          private: r.private,
          defaultBranch: r.default_branch,
          htmlUrl: r.html_url,
        });
      }
      if (!data.repositories || data.repositories.length < 100) break;
    }
    return repos;
  },

  async getScopedToken(accountId: string, _repoFullName: string): Promise<string> {
    const installation = await prisma.gitHubInstallation.findUnique({ where: { id: accountId } });
    if (!installation) throw new Error('GitHub installation not found');
    // The installation token is already scoped to exactly the
    // repos/permissions the user granted at install time -- no separate
    // per-repo narrowing is possible or necessary here.
    return mintInstallationToken(installation.installationId);
  },

  async disconnect(userId: string, accountId: string): Promise<void> {
    const installation = await prisma.gitHubInstallation.findFirst({ where: { id: accountId, userId } });
    if (!installation) return;

    // Best-effort: also ask GitHub to delete the installation server-side
    // so the App no longer shows as installed on the user's account. This
    // requires the App to have been granted deletion rights implicitly
    // via being the installer; if it fails, we still remove our own
    // record below so the user is disconnected from our side regardless.
    try {
      const appJwt = signAppJwt();
      await fetch(`${GITHUB_API}/app/installations/${installation.installationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (err) {
      logger.warn({ err, installationId: installation.installationId }, 'Failed to revoke GitHub App installation remotely; removing local record anyway');
    }

    await prisma.gitHubInstallation.delete({ where: { id: accountId } });
  },
};
