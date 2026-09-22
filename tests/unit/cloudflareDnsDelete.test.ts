import test from 'node:test';
import assert from 'node:assert/strict';

const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db', FIREBASE_PROJECT_ID: 'x', FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32), CLOUDFLARE_API_TOKEN: 'x'.repeat(20), CLOUDFLARE_ZONE_ID: 'zone123', ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32), SMS_WEBHOOK_SECRET: 'x'.repeat(32), DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32), BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

test('deleteDnsRecordsByNameAndIp only lists and deletes records for that name AND ip', async (t) => {
  const { deleteDnsRecordsByNameAndIp } = await import('../../apps/api/src/lib/cloudflare');
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const calls: Array<{ method: string; url: string }> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url: String(url) });
    if (method === 'GET') return new Response(JSON.stringify({ success: true, result: [{ id: 'r1' }, { id: 'r2' }] }));
    return new Response(JSON.stringify({ success: true }));
  }) as typeof fetch;

  const n = await deleteDnsRecordsByNameAndIp('legacy', '1.1.1.1');
  assert.equal(n, 2);
  const list = new URL(calls[0].url);
  assert.equal(list.searchParams.get('name'), 'legacy.shanutechx.com');
  assert.equal(list.searchParams.get('type'), 'A');
  assert.equal(list.searchParams.get('content'), '1.1.1.1', 'the IP filter is what keeps other owners\' records safe');
  assert.deepEqual(calls.slice(1).map((c) => [c.method, c.url.split('/').pop()]), [['DELETE', 'r1'], ['DELETE', 'r2']]);

  globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10000 }] }))) as typeof fetch;
  await assert.rejects(deleteDnsRecordsByNameAndIp('legacy', '1.1.1.1'), /Failed to list DNS records/, 'an API failure is not mistaken for "nothing to delete"');
});
