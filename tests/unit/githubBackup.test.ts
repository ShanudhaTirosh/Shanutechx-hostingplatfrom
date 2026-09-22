import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';

// env.ts throws at import time when required vars are missing; mirror the CI values.
const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  FIREBASE_PROJECT_ID: 'x',
  FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32),
  CLOUDFLARE_API_TOKEN: 'x'.repeat(20),
  CLOUDFLARE_ZONE_ID: 'x'.repeat(20),
  ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32),
  SMS_WEBHOOK_SECRET: 'x'.repeat(32),
  DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32),
  BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

const TOKEN = 'ghp_SUPERSECRETTOKENVALUE1234567890';

interface Recorded {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/** Minimal GitHub double. Behaviour is driven by `state` so each test can flip switches. */
function startMockGithub() {
  const state = {
    repoExists: true,
    repoPrivate: true,
    repoPush: true,
    orgCreateStatus: 201,
    rateLimitFirstReleaseCall: false,
    releaseCalls: 0,
    forceStatus: 0 as number,
    assetBytes: Buffer.alloc(0),
    lieAboutStoredSize: false,
  };
  const requests: Recorded[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      requests.push({ method: req.method || '', url: req.url || '', headers: req.headers, body });
      const send = (status: number, json?: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(json === undefined ? '' : JSON.stringify(json));
      };
      const url = req.url || '';

      if (state.forceStatus) return send(state.forceStatus, { message: 'forced' });

      if (req.method === 'GET' && url === '/repos/acme/backups') {
        if (!state.repoExists) return send(404, { message: 'Not Found' });
        return send(200, { full_name: 'acme/backups', private: state.repoPrivate, permissions: { push: state.repoPush } });
      }
      if (req.method === 'POST' && url === '/orgs/acme/repos') {
        if (state.orgCreateStatus !== 201) return send(state.orgCreateStatus, { message: 'nope' });
        state.repoExists = true;
        return send(201, { full_name: 'acme/backups' });
      }
      if (req.method === 'POST' && url === '/user/repos') {
        state.repoExists = true;
        return send(201, { full_name: 'acme/backups' });
      }
      if (req.method === 'POST' && url === '/repos/acme/backups/releases') {
        state.releaseCalls++;
        if (state.rateLimitFirstReleaseCall && state.releaseCalls === 1) {
          return send(403, { message: 'You have exceeded a secondary rate limit' }, { 'retry-after': '1' });
        }
        const payload = JSON.parse(body.toString());
        return send(201, { id: 111, tag_name: payload.tag_name, html_url: 'https://github.com/acme/backups/releases/tag/x', draft: payload.draft });
      }
      if (req.method === 'POST' && url.startsWith('/uploads/repos/acme/backups/releases/111/assets')) {
        const name = new URL(url, 'http://x').searchParams.get('name');
        return send(201, { id: 900 + requests.length, name, size: state.lieAboutStoredSize ? body.length - 1 : body.length });
      }
      if (req.method === 'PATCH' && url === '/repos/acme/backups/releases/111') {
        return send(200, { id: 111, tag_name: 'backup-x', html_url: 'https://github.com/acme/backups/releases/tag/x', draft: false });
      }
      if (req.method === 'DELETE' && url === '/repos/acme/backups/releases/111') return send(204);
      if (req.method === 'DELETE' && url.startsWith('/repos/acme/backups/git/refs/tags/')) return send(422, { message: 'Reference does not exist' });
      if (req.method === 'GET' && url === '/repos/acme/backups/releases/assets/5') {
        res.writeHead(302, { location: `http://127.0.0.1:${(server.address() as AddressInfo).port}/blob/abc` });
        return res.end();
      }
      if (req.method === 'GET' && url === '/blob/abc') {
        res.writeHead(200, { 'content-length': String(state.assetBytes.length), 'content-type': 'application/octet-stream' });
        return res.end(state.assetBytes);
      }
      send(500, { message: `unhandled ${req.method} ${url}` });
    });
  });

  return new Promise<{ baseUrl: string; state: typeof state; requests: Recorded[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        state,
        requests,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function makeClient(baseUrl: string, extra: Record<string, unknown> = {}) {
  const { GithubBackupClient } = await import('../../apps/api/src/lib/githubBackup');
  return new GithubBackupClient({
    token: TOKEN,
    owner: 'acme',
    repo: 'backups',
    apiBase: baseUrl,
    uploadsBase: `${baseUrl}/uploads`,
    sleep: async () => {},
    ...extra,
  });
}

test('GithubBackupClient', async (t) => {
  const gh = await startMockGithub();
  t.after(() => gh.close());

  await t.test('uploads a large asset as a stream with an explicit Content-Length (no chunked encoding)', async () => {
    const client = await makeClient(gh.baseUrl);
    const payload = crypto.randomBytes(5 * 1024 * 1024);
    const before = gh.requests.length;

    // Feed it in small pieces so it is genuinely a stream, not one buffer.
    const source = Readable.from(
      (function* () {
        for (let i = 0; i < payload.length; i += 64 * 1024) yield payload.subarray(i, i + 64 * 1024);
      })()
    );
    const asset = await client.uploadAsset('111', 'workspace.tar.gz', source, payload.length);

    assert.equal(asset.name, 'workspace.tar.gz');
    assert.equal(asset.size, payload.length);
    const req = gh.requests[before];
    assert.equal(req.headers['content-length'], String(payload.length));
    assert.notEqual(req.headers['transfer-encoding'], 'chunked');
    assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(Buffer.compare(req.body, payload), 0, 'server received exactly the bytes that were streamed');
  });

  await t.test('refuses a body whose length differs from the declared Content-Length, and says why', async () => {
    const client = await makeClient(gh.baseUrl);
    const err = (await client.uploadAsset('111', 'x.tar.gz', Buffer.from('hello'), 999).catch((e) => e)) as Error;
    assert.match(err.message, /Network error while uploading x\.tar\.gz/);
    assert.doesNotMatch(err.message, /^GithubApiError: Network error while uploading x\.tar\.gz: fetch failed$/, 'must include the underlying cause, not a bare "fetch failed"');
    assert.match(err.message, /\(.+\)/, 'cause is appended in parentheses');
  });

  await t.test('rejects an upload when GitHub reports a different stored size than was sent', async () => {
    const client = await makeClient(gh.baseUrl);
    gh.state.lieAboutStoredSize = true;
    await assert.rejects(client.uploadAsset('111', 'x.tar.gz', Buffer.from('hello'), 5), /stored 4 bytes .* 5 were sent/);
    gh.state.lieAboutStoredSize = false;
  });

  await t.test('download follows the 302 by hand and does NOT forward the Authorization header', async () => {
    const client = await makeClient(gh.baseUrl);
    gh.state.assetBytes = crypto.randomBytes(200_000);
    const before = gh.requests.length;
    const { body, size } = await client.downloadAsset('5');
    const got = Buffer.from(await new Response(body).arrayBuffer());

    assert.equal(size, 200_000);
    assert.equal(Buffer.compare(got, gh.state.assetBytes), 0);
    const first = gh.requests[before];
    const second = gh.requests[before + 1];
    assert.equal(first.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(first.headers.accept, 'application/octet-stream');
    assert.equal(second.url, '/blob/abc');
    assert.equal(second.headers.authorization, undefined, 'signed storage URL must not receive the token');
  });

  await t.test('ensureRepo creates a private repo when missing and falls back to the user endpoint if the org endpoint 404s', async () => {
    const client = await makeClient(gh.baseUrl);
    gh.state.repoExists = false;
    gh.state.orgCreateStatus = 404;
    const before = gh.requests.length;
    const res = await client.ensureRepo();
    assert.equal(res.created, true);
    const calls = gh.requests.slice(before).map((r) => `${r.method} ${r.url}`);
    assert.ok(calls.includes('POST /orgs/acme/repos'));
    assert.ok(calls.includes('POST /user/repos'));
    const createBody = JSON.parse(gh.requests.slice(before).find((r) => r.url === '/user/repos')!.body.toString());
    assert.equal(createBody.private, true);
    assert.equal(createBody.auto_init, true, 'needs an initial commit so a release tag can be created');
    gh.state.orgCreateStatus = 201;
  });

  await t.test('ensureRepo refuses a PUBLIC repo and a repo the token cannot write to', async () => {
    const client = await makeClient(gh.baseUrl);
    gh.state.repoExists = true;
    gh.state.repoPrivate = false;
    await assert.rejects(client.ensureRepo(), /PUBLIC/);
    gh.state.repoPrivate = true;
    gh.state.repoPush = false;
    await assert.rejects(client.ensureRepo(), /cannot write/);
    gh.state.repoPush = true;
  });

  await t.test('retries a secondary rate limit and then succeeds', async () => {
    const sleeps: number[] = [];
    const client = await makeClient(gh.baseUrl, { sleep: async (ms: number) => void sleeps.push(ms) });
    gh.state.rateLimitFirstReleaseCall = true;
    gh.state.releaseCalls = 0;
    const rel = await client.createDraftRelease({ tag: 'backup-1', name: 'n', body: 'b' });
    assert.equal(rel.id, '111');
    assert.equal(rel.draft, true);
    assert.equal(gh.state.releaseCalls, 2);
    assert.deepEqual(sleeps, [1000], 'honours the retry-after header');
    gh.state.rateLimitFirstReleaseCall = false;
  });

  await t.test('maps auth / permission / missing-repo failures to typed errors without retrying or leaking the token', async () => {
    const client = await makeClient(gh.baseUrl);
    for (const [status, code, hint] of [
      [401, 'auth', /invalid, expired or revoked/],
      [403, 'forbidden', /Contents: Read and write/],
      [404, 'not_found', /may not exist, or the token cannot access it/],
    ] as const) {
      gh.state.forceStatus = status;
      const before = gh.requests.length;
      const err = (await client.createDraftRelease({ tag: 't', name: 'n', body: 'b' }).catch((e) => e)) as InstanceType<
        typeof import('../../apps/api/src/lib/githubBackup').GithubApiError
      >;
      assert.equal(err.code, code);
      assert.match(err.message, hint);
      assert.ok(!err.message.includes(TOKEN), 'error message must never contain the token');
      assert.equal(gh.requests.length - before, 1, `${status} must not be retried`);
    }
    gh.state.forceStatus = 0;
  });

  await t.test('deleteRelease is idempotent: a missing tag (422) is not an error', async () => {
    const client = await makeClient(gh.baseUrl);
    await client.deleteRelease('111', 'backup-x');
  });

  await t.test('constructor refuses to run without a token', async () => {
    const { GithubBackupClient } = await import('../../apps/api/src/lib/githubBackup');
    assert.throws(() => new GithubBackupClient({ token: '', owner: 'a', repo: 'b' }), /BACKUP_GITHUB_TOKEN/);
  });

  await t.test('tag and asset names are stable and filesystem/URL safe', async () => {
    const { backupTag, componentAssetName } = await import('../../apps/api/src/lib/githubBackup');
    assert.equal(backupTag('cabc123', new Date('2026-09-20T05:41:07.123Z')), 'backup-cabc123-20260920T054107Z');
    assert.equal(componentAssetName('workspace', ''), 'workspace.tar.gz');
    assert.equal(componentAssetName('volume', 'pgdata'), 'volume-pgdata.tar.gz');
  });
});
