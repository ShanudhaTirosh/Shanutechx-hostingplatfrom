import { env } from '../env';
import { logger } from './logger';
import { decryptSecret } from './secretsVault';
import { prisma } from './prisma';

/**
 * Git credentials for private repositories.
 *
 * Old behaviour: the access token was pasted into `Deployment.repoUrl` ("https://x-access-token:TOKEN@github.com/...")
 * and persisted. That left plaintext tokens in the database, and GitHub App installation tokens expire after about an
 * hour, so every later redeploy, webhook rebuild or failover used a dead token.
 *
 * Now the stored `repoUrl` is credential-free and the credential is resolved fresh, at build time, from what the
 * deployment record points to:
 *   1. a connected Git account (gitAccountId + gitProvider): a new short-lived scoped token is minted, or
 *   2. a saved personal access token (githubTokenEncrypted, AES-GCM at rest): decrypted.
 * The node agent then passes it to git through the environment, never argv or .git/config (see node-agent repo.js).
 */

export interface RepoAuthRecord {
  userId: string;
  gitAccountId: string | null;
  gitProvider: string | null;
  githubTokenEncrypted: string | null;
}

export interface GitAuthDeps {
  loadAuth(deploymentId: string): Promise<RepoAuthRecord | null>;
  mintToken(provider: string, accountId: string, repoUrl: string): Promise<string>;
  decrypt(encrypted: string): string;
}

export interface ParsedRepoUrl {
  cleanUrl: string;
  username: string;
  password: string;
}

const isHttp = (url: string) => /^https?:\/\//i.test(url);

/** Splits an http(s) URL into a credential-free URL and the credentials it carried. Null for anything else. */
export function parseRepoUrl(raw: string): ParsedRepoUrl | null {
  if (!isHttp(raw)) return null;
  try {
    const u = new URL(raw);
    const username = decodeURIComponent(u.username);
    const password = decodeURIComponent(u.password);
    u.username = '';
    u.password = '';
    return { cleanUrl: u.toString(), username, password };
  } catch {
    return null;
  }
}

export function stripRepoCredentials(raw: string): string {
  const parsed = parseRepoUrl(raw);
  return parsed ? parsed.cleanUrl : raw;
}

/** The token carried by a URL, in either "user:TOKEN@" or "TOKEN@" form, or null when it carries none. */
export function extractEmbeddedToken(raw: string): string | null {
  const parsed = parseRepoUrl(raw);
  if (!parsed) return null;
  return parsed.password || parsed.username || null;
}

/**
 * Prepares a user-supplied repo URL for storage: the returned URL is credential-free, and a token that was embedded
 * in it is returned encrypted so it can go in `githubTokenEncrypted` instead of the plaintext URL.
 */
export function sanitizeRepoUrlForStorage(raw: string, encrypt: (token: string) => string): { repoUrl: string; githubTokenEncrypted?: string } {
  const token = extractEmbeddedToken(raw);
  if (!token) return { repoUrl: raw };
  return { repoUrl: stripRepoCredentials(raw), githubTokenEncrypted: encrypt(token) };
}

/** Which username a host expects in front of an access token (matches what the create route always did). */
function credentialUser(host: string, provider: string | null): string | null {
  const h = host.toLowerCase();
  if (provider === 'gitlab' || h.includes('gitlab')) return 'oauth2';
  if (provider === 'github' || h.includes('github')) return 'x-access-token';
  return null; // other hosts: the token itself is the username
}

export function injectRepoCredentials(cleanUrl: string, token: string, provider: string | null = null): string {
  const u = new URL(cleanUrl);
  const user = credentialUser(u.hostname, provider);
  if (user) {
    u.username = user;
    u.password = token;
  } else {
    u.username = token;
    u.password = '';
  }
  return u.toString();
}

/**
 * Returns the URL to hand to the node agent for a build: the stored URL with a freshly resolved credential when the
 * deployment has one, otherwise the URL unchanged (public repos, archives, docker images, legacy rows).
 */
export async function resolveRepoUrlForBuild(deploymentId: string, repoUrl: string, deps: GitAuthDeps = defaultDeps): Promise<string> {
  if (!isHttp(repoUrl)) return repoUrl; // zip://, upload://, docker images, ...
  const incoming = parseRepoUrl(repoUrl);
  if (!incoming) return repoUrl;
  const hasLegacyCredentials = Boolean(incoming.username || incoming.password);

  let auth: RepoAuthRecord | null = null;
  try {
    auth = await deps.loadAuth(deploymentId);
  } catch (err) {
    logger.warn({ err, deploymentId }, 'Could not load git auth for build; using the URL as given');
    return repoUrl;
  }
  if (!auth) return repoUrl;

  if (auth.gitAccountId && auth.gitProvider) {
    try {
      const token = await deps.mintToken(auth.gitProvider, auth.gitAccountId, incoming.cleanUrl);
      return injectRepoCredentials(incoming.cleanUrl, token, auth.gitProvider);
    } catch (err) {
      // Never log the token; the error from the provider adapter does not contain it.
      logger.warn({ err: err instanceof Error ? err.message : String(err), deploymentId, provider: auth.gitProvider }, 'Could not mint a fresh git token; falling back');
    }
  }

  if (auth.githubTokenEncrypted) {
    try {
      return injectRepoCredentials(incoming.cleanUrl, deps.decrypt(auth.githubTokenEncrypted), auth.gitProvider);
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), deploymentId }, 'Could not decrypt the saved git token; falling back');
    }
  }

  // Nothing fresh available: a legacy URL that still carries its own credentials is better than none; otherwise the
  // clean URL goes out and the node reports a clear authentication failure for a private repo.
  return hasLegacyCredentials ? repoUrl : incoming.cleanUrl;
}

const defaultDeps: GitAuthDeps = {
  async loadAuth(deploymentId) {
    const row = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { userId: true, gitAccountId: true, gitProvider: true, githubTokenEncrypted: true },
    });
    return row ? { userId: row.userId, gitAccountId: row.gitAccountId ?? null, gitProvider: row.gitProvider ?? null, githubTokenEncrypted: row.githubTokenEncrypted ?? null } : null;
  },
  async mintToken(provider, accountId, repoUrl) {
    const { getProvider } = await import('./gitProviders');
    const adapter = getProvider(provider as 'github' | 'gitlab');
    if (!adapter) throw new Error(`Git provider "${provider}" is not available`);
    return adapter.getScopedToken(accountId, repoUrl);
  },
  decrypt: (encrypted) => decryptSecret(encrypted, env.secretsEncryptionKey),
};
