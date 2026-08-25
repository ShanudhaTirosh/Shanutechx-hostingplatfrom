import { prisma } from '../prisma';
import { env } from '../../env';
import { encryptSecret, decryptSecret } from '../secretsVault';
import { createState } from './state';
import type { GitProviderAdapter, GitRepoSummary, ConnectedAccountSummary } from './types';

/**
 * GitLab OAuth application integration. No PATs are ever requested from
 * or stored for the user — access is entirely through GitLab's OAuth
 * "Authorize application" flow, with the minimum scopes needed
 * (read_repository + read_user; api is NOT requested since we only ever
 * read repo metadata/clone, we don't need write access to the user's
 * GitLab account itself). Access and refresh tokens are encrypted at
 * rest via lib/secretsVault.ts and refreshed automatically when expired
 * — never re-requesting the user to reauthorize for routine use.
 */

const GITLAB_OAUTH_SCOPES = 'read_user read_repository';

function isConfigured(): boolean {
  return Boolean(env.gitlabAppClientId && env.gitlabAppClientSecret);
}

async function getFreshAccessToken(connectionId: string): Promise<string> {
  const conn = await prisma.gitLabConnection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new Error('GitLab connection not found');

  // Refresh proactively if the token expires within the next 60 seconds,
  // rather than waiting for a 401 from GitLab's API.
  if (conn.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(conn.accessTokenEnc, env.secretsEncryptionKey);
  }

  const refreshToken = decryptSecret(conn.refreshTokenEnc, env.secretsEncryptionKey);
  const res = await fetch('https://gitlab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.gitlabAppClientId,
      client_secret: env.gitlabAppClientSecret,
      redirect_uri: env.gitlabRedirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh GitLab token (${res.status}) — the user may need to reconnect their account.`);
  }
  const data: any = await res.json();

  const newAccessTokenEnc = encryptSecret(data.access_token, env.secretsEncryptionKey);
  const newRefreshTokenEnc = encryptSecret(data.refresh_token ?? refreshToken, env.secretsEncryptionKey);
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 7200) * 1000);

  await prisma.gitLabConnection.update({
    where: { id: connectionId },
    data: { accessTokenEnc: newAccessTokenEnc, refreshTokenEnc: newRefreshTokenEnc, tokenExpiresAt: newExpiresAt },
  });

  return data.access_token as string;
}

export const gitlabProvider: GitProviderAdapter = {
  provider: 'gitlab',

  isConfigured,

  getConnectUrl(userId: string): string {
    const state = createState(userId, 'gitlab');
    const params = new URLSearchParams({
      client_id: env.gitlabAppClientId,
      redirect_uri: env.gitlabRedirectUri,
      response_type: 'code',
      scope: GITLAB_OAUTH_SCOPES,
      state,
    });
    return `https://gitlab.com/oauth/authorize?${params.toString()}`;
  },

  async listConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]> {
    const rows = await prisma.gitLabConnection.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return rows.map((r: any) => ({
      id: r.id,
      provider: 'gitlab' as const,
      accountLabel: r.username,
      avatarUrl: r.avatarUrl,
      updatedAt: r.updatedAt.toISOString(),
    }));
  },

  async listRepos(accountId: string): Promise<GitRepoSummary[]> {
    const token = await getFreshAccessToken(accountId);
    const repos: GitRepoSummary[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://gitlab.com/api/v4/projects?membership=true&per_page=100&page=${page}&order_by=last_activity_at`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Failed to list GitLab projects (${res.status})`);
      const data: any = await res.json();
      for (const p of data) {
        repos.push({
          id: String(p.id),
          fullName: p.path_with_namespace,
          name: p.name,
          private: p.visibility !== 'public',
          defaultBranch: p.default_branch ?? 'main',
          htmlUrl: p.web_url,
        });
      }
      if (data.length < 100) break;
    }
    return repos;
  },

  async getScopedToken(accountId: string, _repoFullName: string): Promise<string> {
    // GitLab OAuth tokens for this application are already scoped to
    // read_user + read_repository across every project the user is a
    // member of -- there's no narrower per-repo token to mint on top of
    // that (unlike GitHub's per-installation tokens).
    return getFreshAccessToken(accountId);
  },

  async disconnect(userId: string, accountId: string): Promise<void> {
    const conn = await prisma.gitLabConnection.findFirst({ where: { id: accountId, userId } });
    if (!conn) return;

    // Best-effort: revoke the token with GitLab too, not just delete our
    // own record, so the "Authorized applications" list on the user's
    // GitLab account reflects the disconnect.
    try {
      const accessToken = decryptSecret(conn.accessTokenEnc, env.secretsEncryptionKey);
      await fetch('https://gitlab.com/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: accessToken,
          client_id: env.gitlabAppClientId,
          client_secret: env.gitlabAppClientSecret,
        }),
      });
    } catch {
      // Non-fatal — still remove our own stored (encrypted) credentials below.
    }

    await prisma.gitLabConnection.delete({ where: { id: accountId } });
  },
};
