import { Readable } from 'stream';
import { env } from '../env';
import { logger } from './logger';

/**
 * GitHub REST API client used for deployment backups.
 *
 * Design (see docs/GITHUB_BACKUPS.md for the full write-up):
 *  - One private repo holds every backup. Each backup is one *release*; each
 *    backed-up component (workspace / volume) plus a manifest.json is one *asset*.
 *  - The release is created as a DRAFT, assets are uploaded, and only then is it
 *    published. A backup that died half-way therefore never looks complete: it is
 *    an orphan draft, which we delete on failure.
 *  - Release assets allow up to 2 GiB per file, don't bloat git history, and are
 *    deleted cleanly by the retention policy. (Committing archives through the
 *    Git Data API would cap blobs at 100 MB and grow the repo forever.)
 *  - Uploads and downloads are streamed. Nothing is buffered in API memory.
 *  - The token only ever travels in the Authorization header. It is never put in
 *    a URL, never logged, and never included in thrown error messages.
 */

export type GithubErrorCode = 'auth' | 'forbidden' | 'not_found' | 'rate_limited' | 'validation' | 'server' | 'network';

export class GithubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: GithubErrorCode,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

export interface GithubBackupClientOptions {
  token: string;
  owner: string;
  repo: string;
  apiBase?: string;
  uploadsBase?: string;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  /** Max attempts for idempotent JSON calls (uploads are retried by the caller, which can re-open its source stream). */
  maxAttempts?: number;
  uploadTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ReleaseInfo {
  id: string;
  tagName: string;
  htmlUrl: string;
  draft: boolean;
}

export interface AssetInfo {
  id: string;
  name: string;
  size: number;
}

export interface RepoAccess {
  repoFullName: string;
  exists: boolean;
  private: boolean;
  canPush: boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** undici reports most failures as a bare "fetch failed"; the useful reason is on `cause`. */
function describeFetchError(e: unknown): string {
  const err = e as Error & { cause?: { message?: string; code?: string } };
  const cause = err.cause?.message || err.cause?.code;
  return cause ? `${err.message} (${cause})` : err.message;
}

/** Same value everywhere so GitHub can attribute API traffic to us. */
const USER_AGENT = 'ShanuTechX-Platform-Backups';

export class GithubBackupClient {
  private readonly token: string;
  readonly owner: string;
  readonly repo: string;
  private readonly apiBase: string;
  private readonly uploadsBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly uploadTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: GithubBackupClientOptions) {
    if (!opts.token) throw new GithubApiError('GitHub backup token is not configured (set BACKUP_GITHUB_TOKEN)', 0, 'auth');
    if (!opts.owner || !opts.repo) throw new GithubApiError('GitHub backup owner/repo is not configured', 0, 'validation');
    this.token = opts.token;
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.apiBase = (opts.apiBase ?? 'https://api.github.com').replace(/\/$/, '');
    this.uploadsBase = (opts.uploadsBase ?? 'https://uploads.github.com').replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    this.uploadTimeoutMs = opts.uploadTimeoutMs ?? 30 * 60 * 1000;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  get fullName(): string {
    return `${this.owner}/${this.repo}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      ...extra,
    };
  }

  /** Turns a non-2xx response into a typed error with an actionable message (never includes the token). */
  private async toError(res: Response, what: string): Promise<GithubApiError> {
    const text = await res.text().catch(() => '');
    let apiMessage = '';
    try {
      apiMessage = (JSON.parse(text) as { message?: string }).message ?? '';
    } catch {
      apiMessage = text.slice(0, 200);
    }
    const retryAfterHeader = Number(res.headers.get('retry-after'));
    const resetHeader = Number(res.headers.get('x-ratelimit-reset'));
    const remaining = res.headers.get('x-ratelimit-remaining');
    let retryAfterMs: number | undefined;
    if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) retryAfterMs = retryAfterHeader * 1000;
    else if (remaining === '0' && Number.isFinite(resetHeader) && resetHeader > 0) {
      retryAfterMs = Math.max(0, resetHeader * 1000 - Date.now());
    }

    const secondaryLimit = /secondary rate limit|abuse detection/i.test(apiMessage);
    if (res.status === 429 || (res.status === 403 && (secondaryLimit || remaining === '0' || retryAfterMs !== undefined))) {
      return new GithubApiError(`GitHub rate limit hit while trying to ${what}. ${apiMessage}`.trim(), res.status, 'rate_limited', retryAfterMs ?? 30_000);
    }
    if (res.status === 401) {
      return new GithubApiError(`GitHub rejected the backup token while trying to ${what} (401). It is invalid, expired or revoked.`, 401, 'auth');
    }
    if (res.status === 403) {
      return new GithubApiError(
        `GitHub denied permission to ${what} (403). The token needs "Contents: Read and write" on ${this.fullName} (fine-grained) or the "repo" scope (classic). ${apiMessage}`.trim(),
        403,
        'forbidden'
      );
    }
    if (res.status === 404) {
      // GitHub answers 404 (not 403) when a token can't see a private repo, so name both causes.
      return new GithubApiError(`GitHub returned 404 while trying to ${what}. The repo ${this.fullName} may not exist, or the token cannot access it.`, 404, 'not_found');
    }
    if (res.status === 422) {
      return new GithubApiError(`GitHub rejected the request to ${what} (422): ${apiMessage}`, 422, 'validation');
    }
    return new GithubApiError(`GitHub error while trying to ${what} (${res.status}): ${apiMessage}`, res.status, res.status >= 500 ? 'server' : 'validation');
  }

  /**
   * JSON request with retry on network errors, 5xx and rate limits. Only used for idempotent-or-safe calls;
   * `expectNoContent` allows 204 responses (DELETE).
   */
  private async json<T>(what: string, method: string, url: string, body?: unknown, okStatuses: number[] = [200, 201]): Promise<T> {
    let lastErr: GithubApiError | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers: this.headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(60_000),
        });
        if (okStatuses.includes(res.status)) {
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }
        const err = await this.toError(res, what);
        if (err.code !== 'rate_limited' && err.code !== 'server') throw err;
        lastErr = err;
        if (attempt < this.maxAttempts) {
          const wait = Math.min(err.retryAfterMs ?? 500 * 2 ** (attempt - 1), 30_000);
          logger.warn({ what, attempt, status: err.status, waitMs: wait }, 'GitHub call failed, retrying');
          await this.sleep(wait);
        }
      } catch (e) {
        if (e instanceof GithubApiError) {
          if (e.code !== 'rate_limited' && e.code !== 'server') throw e;
          lastErr = e;
          continue;
        }
        // fetch() itself failed: DNS, connection reset, timeout.
        lastErr = new GithubApiError(`Network error while trying to ${what}: ${describeFetchError(e)}`, 0, 'network');
        if (attempt < this.maxAttempts) await this.sleep(500 * 2 ** (attempt - 1));
      }
    }
    throw lastErr ?? new GithubApiError(`Failed to ${what}`, 0, 'network');
  }

  /** Reports whether the token can actually push to the backup repo, without changing anything. */
  async checkAccess(): Promise<RepoAccess> {
    try {
      const repo = await this.json<{ full_name: string; private: boolean; permissions?: { push?: boolean; admin?: boolean } }>(
        `read repository ${this.fullName}`,
        'GET',
        `${this.apiBase}/repos/${this.owner}/${this.repo}`,
        undefined,
        [200]
      );
      return { repoFullName: repo.full_name, exists: true, private: repo.private, canPush: Boolean(repo.permissions?.push || repo.permissions?.admin) };
    } catch (e) {
      if (e instanceof GithubApiError && e.code === 'not_found') {
        return { repoFullName: this.fullName, exists: false, private: false, canPush: false };
      }
      throw e;
    }
  }

  /**
   * Makes sure the backup repo exists. Creates it PRIVATE (with an initial commit, which GitHub requires
   * before a release/tag can be created) if it is missing. Refuses to use a public repo: backups contain
   * customer files.
   */
  async ensureRepo(): Promise<RepoAccess & { created: boolean }> {
    const access = await this.checkAccess();
    if (access.exists) {
      if (!access.private) {
        throw new GithubApiError(`Refusing to store backups in ${this.fullName}: the repository is PUBLIC. Make it private or point BACKUP_GITHUB_REPO at a private repo.`, 0, 'validation');
      }
      if (!access.canPush) {
        throw new GithubApiError(`The backup token can read ${this.fullName} but cannot write to it. Grant "Contents: Read and write".`, 403, 'forbidden');
      }
      return { ...access, created: false };
    }

    const body = { name: this.repo, private: true, auto_init: true, description: 'Automated ShanuTechX deployment backups. Do not edit by hand.' };
    try {
      await this.json('create backup repository (organisation)', 'POST', `${this.apiBase}/orgs/${this.owner}/repos`, body, [201]);
    } catch (e) {
      // Not an org (or no org rights): the owner may be the token's own user account.
      if (e instanceof GithubApiError && (e.code === 'not_found' || e.code === 'forbidden')) {
        await this.json('create backup repository (user account)', 'POST', `${this.apiBase}/user/repos`, body, [201]);
      } else {
        throw e;
      }
    }
    logger.info({ repo: this.fullName }, 'Created private GitHub backup repository');
    const after = await this.checkAccess();
    return { ...after, created: true };
  }

  async createDraftRelease(params: { tag: string; name: string; body: string }): Promise<ReleaseInfo> {
    const r = await this.json<{ id: number; tag_name: string; html_url: string; draft: boolean }>(
      'create backup release',
      'POST',
      `${this.apiBase}/repos/${this.owner}/${this.repo}/releases`,
      { tag_name: params.tag, name: params.name, body: params.body, draft: true, prerelease: false },
      [201]
    );
    return { id: String(r.id), tagName: r.tag_name, htmlUrl: r.html_url, draft: r.draft };
  }

  /**
   * Streams `body` to GitHub as a release asset. GitHub requires Content-Length up front, so the caller
   * must know the exact size. Not retried here: the source stream is consumed by the attempt, so the caller
   * (which can re-open it) owns retries.
   */
  async uploadAsset(releaseId: string, name: string, body: Readable | ReadableStream<Uint8Array> | Buffer, size: number, contentType = 'application/gzip'): Promise<AssetInfo> {
    const url = `${this.uploadsBase}/repos/${this.owner}/${this.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
    let requestBody: RequestInit['body'];
    if (Buffer.isBuffer(body)) requestBody = new Uint8Array(body);
    else if (body instanceof Readable) requestBody = Readable.toWeb(body) as unknown as RequestInit['body'];
    else requestBody = body as unknown as RequestInit['body'];

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': contentType, 'Content-Length': String(size) }),
        body: requestBody,
        // Required by undici when the body is a stream.
        duplex: 'half',
        signal: AbortSignal.timeout(this.uploadTimeoutMs),
      } as RequestInit);
    } catch (e) {
      throw new GithubApiError(`Network error while uploading ${name}: ${describeFetchError(e)}`, 0, 'network');
    }
    if (res.status !== 201) throw await this.toError(res, `upload asset ${name}`);
    const a = (await res.json()) as { id: number; name: string; size: number };
    if (a.size !== size) {
      throw new GithubApiError(`GitHub stored ${a.size} bytes for ${name} but ${size} were sent`, 0, 'validation');
    }
    return { id: String(a.id), name: a.name, size: a.size };
  }

  async publishRelease(releaseId: string): Promise<ReleaseInfo> {
    const r = await this.json<{ id: number; tag_name: string; html_url: string; draft: boolean }>(
      'publish backup release',
      'PATCH',
      `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/${releaseId}`,
      { draft: false },
      [200]
    );
    return { id: String(r.id), tagName: r.tag_name, htmlUrl: r.html_url, draft: r.draft };
  }

  /** Deletes a release and (best effort) its tag. Missing release/tag is not an error, so this is safe to call twice. */
  async deleteRelease(releaseId: string, tag?: string): Promise<void> {
    try {
      await this.json('delete backup release', 'DELETE', `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/${releaseId}`, undefined, [204]);
    } catch (e) {
      if (!(e instanceof GithubApiError && e.code === 'not_found')) throw e;
    }
    if (tag) {
      try {
        await this.json('delete backup tag', 'DELETE', `${this.apiBase}/repos/${this.owner}/${this.repo}/git/refs/tags/${encodeURIComponent(tag)}`, undefined, [204]);
      } catch (e) {
        // 404 = no tag (draft never published); 422 = ref already gone. Neither matters.
        if (!(e instanceof GithubApiError && (e.code === 'not_found' || e.code === 'validation'))) throw e;
      }
    }
  }

  /**
   * Opens a streaming download of an asset. GitHub answers with a 302 to a pre-signed storage URL; that
   * URL must be fetched WITHOUT our Authorization header, so we follow the redirect by hand.
   */
  async downloadAsset(assetId: string): Promise<{ body: ReadableStream<Uint8Array>; size: number | null }> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/assets/${assetId}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'GET',
        headers: this.headers({ Accept: 'application/octet-stream' }),
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new GithubApiError(`Network error while downloading asset ${assetId}: ${describeFetchError(e)}`, 0, 'network');
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new GithubApiError(`GitHub redirected asset ${assetId} without a Location header`, res.status, 'server');
      try {
        res = await this.fetchImpl(location, { method: 'GET', signal: AbortSignal.timeout(this.uploadTimeoutMs) });
      } catch (e) {
        throw new GithubApiError(`Network error while downloading asset ${assetId}: ${describeFetchError(e)}`, 0, 'network');
      }
    }
    if (!res.ok || !res.body) throw await this.toError(res, `download asset ${assetId}`);
    const len = Number(res.headers.get('content-length'));
    return { body: res.body, size: Number.isFinite(len) && len > 0 ? len : null };
  }
}

/** Parses "owner/repo" or builds it from BACKUP_GITHUB_ORG + BACKUP_GITHUB_REPO. */
export function resolveBackupRepo(): { owner: string; repo: string } {
  const repoSetting = env.backupGithubRepo;
  if (repoSetting.includes('/')) {
    const [owner, repo] = repoSetting.split('/', 2);
    return { owner, repo };
  }
  return { owner: env.backupGithubOrg, repo: repoSetting };
}

let cached: GithubBackupClient | null = null;

/** Lazily-built shared client for the platform's configured backup repo. Throws a clear error if not configured. */
export function getGithubBackupClient(): GithubBackupClient {
  if (cached) return cached;
  const { owner, repo } = resolveBackupRepo();
  cached = new GithubBackupClient({ token: env.backupGithubToken, owner, repo });
  return cached;
}

/** For tests / after config changes. */
export function resetGithubBackupClientForTests(): void {
  cached = null;
}

/** Release tag + asset naming, kept in one place so restore/retention can rely on it. */
export function backupTag(deploymentId: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `backup-${deploymentId}-${stamp}`;
}

export function componentAssetName(kind: 'workspace' | 'volume', name: string): string {
  return kind === 'workspace' ? 'workspace.tar.gz' : `volume-${name}.tar.gz`;
}
