import test from 'node:test';
import assert from 'node:assert/strict';

const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db', FIREBASE_PROJECT_ID: 'x', FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32), CLOUDFLARE_API_TOKEN: 'x'.repeat(20), CLOUDFLARE_ZONE_ID: 'x'.repeat(20), ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32), SMS_WEBHOOK_SECRET: 'x'.repeat(32), DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32), BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

type Auth = import('../../apps/api/src/lib/gitAuth').RepoAuthRecord;

async function load() {
  return import('../../apps/api/src/lib/gitAuth');
}

function deps(auth: Auth | null, opts: { mint?: (p: string, a: string, u: string) => Promise<string>; decrypt?: (s: string) => string } = {}) {
  const calls: string[] = [];
  return {
    calls,
    d: {
      async loadAuth() { calls.push('load'); return auth; },
      async mintToken(p: string, a: string, u: string) { calls.push(`mint:${p}:${a}`); return (opts.mint ?? (async () => 'FRESHTOKEN'))(p, a, u); },
      decrypt: (s: string) => { calls.push('decrypt'); return (opts.decrypt ?? ((x: string) => `PAT(${x})`))(s); },
    },
  };
}
const rec = (o: Partial<Auth> = {}): Auth => ({ userId: 'u1', gitAccountId: null, gitProvider: null, githubTokenEncrypted: null, ...o });

test('url helpers', async () => {
  const g = await load();
  assert.deepEqual(g.parseRepoUrl('https://x-access-token:abc@github.com/o/r.git'), { cleanUrl: 'https://github.com/o/r.git', username: 'x-access-token', password: 'abc' });
  assert.equal(g.parseRepoUrl('zip://abc'), null);
  assert.equal(g.stripRepoCredentials('https://tok@gitlab.com/o/r.git'), 'https://gitlab.com/o/r.git');
  assert.equal(g.stripRepoCredentials('upload://x'), 'upload://x');
  assert.equal(g.extractEmbeddedToken('https://x-access-token:abc@github.com/o/r'), 'abc');
  assert.equal(g.extractEmbeddedToken('https://tok123@example.com/o/r'), 'tok123');
  assert.equal(g.extractEmbeddedToken('https://github.com/o/r'), null);
  // per-host username conventions match what the create route always produced
  assert.equal(g.injectRepoCredentials('https://github.com/o/r.git', 'T', 'github'), 'https://x-access-token:T@github.com/o/r.git');
  assert.equal(g.injectRepoCredentials('https://gitlab.com/o/r.git', 'T', 'gitlab'), 'https://oauth2:T@gitlab.com/o/r.git');
  assert.equal(g.injectRepoCredentials('https://git.example.com/o/r.git', 'T'), 'https://T@git.example.com/o/r.git');
  // tokens with URL-special characters survive a round trip
  const weird = 'p@ss:w/rd#1';
  assert.equal(g.extractEmbeddedToken(g.injectRepoCredentials('https://github.com/o/r.git', weird, 'github')), weird);
});

test('resolveRepoUrlForBuild', async (t) => {
  const g = await load();

  await t.test('connected account: mints a FRESH token at build time and injects it', async () => {
    const { d, calls } = deps(rec({ gitAccountId: 'acc1', gitProvider: 'github' }));
    const url = await g.resolveRepoUrlForBuild('dep1', 'https://github.com/o/r.git', d);
    assert.equal(url, 'https://x-access-token:FRESHTOKEN@github.com/o/r.git');
    assert.deepEqual(calls, ['load', 'mint:github:acc1']);
  });

  await t.test('a stale token embedded in a legacy URL is replaced by a fresh one when the account is known', async () => {
    const { d } = deps(rec({ gitAccountId: 'acc1', gitProvider: 'github' }));
    const url = await g.resolveRepoUrlForBuild('dep1', 'https://x-access-token:EXPIRED@github.com/o/r.git', d);
    assert.equal(url, 'https://x-access-token:FRESHTOKEN@github.com/o/r.git');
  });

  await t.test('saved personal access token: decrypted and injected; nothing is minted', async () => {
    const { d, calls } = deps(rec({ githubTokenEncrypted: 'ENC' }));
    const url = await g.resolveRepoUrlForBuild('dep1', 'https://github.com/o/r.git', d);
    assert.equal(url, 'https://x-access-token:PAT(ENC)@github.com/o/r.git');
    assert.ok(!calls.some((c) => c.startsWith('mint')));
  });

  await t.test('mint failure falls back to the saved PAT, then to a legacy URL, then to the clean URL', async () => {
    const boom = async () => { throw new Error('account revoked'); };
    let r = deps(rec({ gitAccountId: 'a', gitProvider: 'github', githubTokenEncrypted: 'ENC' }), { mint: boom });
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', r.d), 'https://x-access-token:PAT(ENC)@github.com/o/r.git');
    r = deps(rec({ gitAccountId: 'a', gitProvider: 'github' }), { mint: boom });
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://x-access-token:LEGACY@github.com/o/r.git', r.d), 'https://x-access-token:LEGACY@github.com/o/r.git');
    r = deps(rec({ gitAccountId: 'a', gitProvider: 'github' }), { mint: boom });
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', r.d), 'https://github.com/o/r.git');
  });

  await t.test('a corrupt saved token does not crash the deploy', async () => {
    const { d } = deps(rec({ githubTokenEncrypted: 'ENC' }), { decrypt: () => { throw new Error('bad key'); } });
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', d), 'https://github.com/o/r.git');
  });

  await t.test('public repo / no auth on the record / unknown deployment: URL unchanged', async () => {
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', deps(rec()).d), 'https://github.com/o/r.git');
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', deps(null).d), 'https://github.com/o/r.git');
  });

  await t.test('non-http sources are passed through without touching the database', async () => {
    for (const u of ['zip://abc', 'upload://x', 'docker://nginx:latest', 'nginx:latest']) {
      const { d, calls } = deps(rec({ gitAccountId: 'a', gitProvider: 'github' }));
      assert.equal(await g.resolveRepoUrlForBuild('d', u, d), u);
      assert.equal(calls.length, 0, u);
    }
  });

  await t.test('a database error while loading auth does not fail the build', async () => {
    const d = { loadAuth: async () => { throw new Error('db down'); }, mintToken: async () => 'x', decrypt: () => 'x' };
    assert.equal(await g.resolveRepoUrlForBuild('d', 'https://github.com/o/r.git', d), 'https://github.com/o/r.git');
  });
});

test('sanitizeRepoUrlForStorage', async () => {
  const g = await load();
  const enc = (t: string) => `ENC(${t})`;
  assert.deepEqual(g.sanitizeRepoUrlForStorage('https://x-access-token:abc@github.com/o/r.git', enc), { repoUrl: 'https://github.com/o/r.git', githubTokenEncrypted: 'ENC(abc)' });
  assert.deepEqual(g.sanitizeRepoUrlForStorage('https://tok@git.example.com/o/r.git', enc), { repoUrl: 'https://git.example.com/o/r.git', githubTokenEncrypted: 'ENC(tok)' });
  assert.deepEqual(g.sanitizeRepoUrlForStorage('https://github.com/o/r.git', enc), { repoUrl: 'https://github.com/o/r.git' }, 'a clean URL is left alone and nothing is encrypted');
  assert.deepEqual(g.sanitizeRepoUrlForStorage('zip://abc', enc), { repoUrl: 'zip://abc' });
});
