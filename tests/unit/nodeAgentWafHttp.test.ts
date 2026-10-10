import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Boots the REAL node agent and drives /agent/waf-check (the Traefik forwardAuth target) and /agent/waf/sync over
 * real HTTP. Exists because the auth story for this one route is unusual (secret via query string, not the header
 * every other /agent/* route requires, since Traefik cannot be told to send a custom header from a label alone) and
 * because "does a deployment with no synced rules fail OPEN, not closed" is exactly the kind of thing that is easy
 * to get backwards and would take every proxied app on the platform down if it did.
 */

const SECRET = 'x'.repeat(32);
const DEP = 'cdepwaf0000001';

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

test('node agent WAF routes (real HTTP)', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-waf-http-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let logs = '';
  const child: ChildProcess = spawn(process.execPath, [path.resolve('services/node-agent/src/index.js')], {
    env: { ...process.env, NODE_AGENT_SECRET: SECRET, AGENT_PORT: String(port), AGENT_BIND_HOST: '127.0.0.1', AGENT_WORKSPACES_DIR: path.join(root, 'ws'), AGENT_VOLUMES_DIR: path.join(root, 'vol'), AGENT_BACKUPS_DIR: path.join(root, 'bak') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => (logs = (logs + d).slice(-4000)));
  child.stderr?.on('data', (d) => (logs = (logs + d).slice(-4000)));
  t.after(() => {
    try { child.kill(); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  let ready = false;
  for (let i = 0; i < 75 && !ready; i++) {
    try {
      ready = (await fetch(`${base}/agent/backups/capabilities`, { headers: { 'x-agent-secret': SECRET }, signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(ready, `agent did not start. Logs:\n${logs}`);

  const wafCheck = (query: string, headers: Record<string, string> = {}) => fetch(`${base}/agent/waf-check/${DEP}?${query}`, { headers, signal: AbortSignal.timeout(5000) });
  const sync = (rules: unknown[]) => fetch(`${base}/agent/deployments/${DEP}/waf/sync`, { method: 'POST', headers: { 'x-agent-secret': SECRET, 'content-type': 'application/json' }, body: JSON.stringify({ rules }), signal: AbortSignal.timeout(5000) });

  await t.test('waf-check requires the secret as a query param; the normal header alone does not work here', async () => {
    assert.equal((await wafCheck('')).status, 401, 'no secret at all');
    assert.equal((await wafCheck('', { 'x-agent-secret': SECRET })).status, 401, 'header only is not accepted on this path');
    assert.equal((await wafCheck('secret=wrong')).status, 401);
    assert.equal((await wafCheck(`secret=${SECRET}`)).status, 200, 'query secret alone is accepted');
  });

  await t.test('every other /agent/* route still requires the header (regression check: the bypass is scoped to waf-check only)', async () => {
    assert.equal((await fetch(`${base}/agent/backups/capabilities?secret=${SECRET}`)).status, 401, 'query string does not work for other routes');
  });

  await t.test('a deployment with no synced rules fails OPEN (200), not closed', async () => {
    const res = await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '9.9.9.9' });
    assert.equal(res.status, 200);
  });

  await t.test('sync + block: a matching IP is blocked (403), everyone else is allowed (200)', async () => {
    const s = await sync([{ id: 'r1', action: 'block', matchType: 'ip', matchValue: '1.2.3.4', isEnabled: true, rateLimitPerMinute: null }]);
    assert.equal(s.status, 200);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '1.2.3.4' })).status, 403);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '5.6.7.8' })).status, 200);
  });

  await t.test('rate_limit rules are enforced across real requests (429 after the threshold)', async () => {
    await sync([{ id: 'rl', action: 'rate_limit', matchType: 'ip_range', matchValue: '0.0.0.0/0', isEnabled: true, rateLimitPerMinute: 3 }]);
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '4.4.4.4' })).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  });

  await t.test('resyncing replaces the previous rule set rather than merging with it', async () => {
    await sync([{ id: 'allow-all-again', action: 'block', matchType: 'ip', matchValue: '250.250.250.250', isEnabled: true, rateLimitPerMinute: null }]);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '1.2.3.4' })).status, 200, 'the earlier block rule for this IP is gone after resync');
  });

  await t.test('x-forwarded-uri and x-forwarded-user-agent (what Traefik actually sends) drive path/user-agent rules', async () => {
    await sync([{ id: 'p1', action: 'block', matchType: 'path', matchValue: '/admin*', isEnabled: true, rateLimitPerMinute: null }]);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '1.1.1.1', 'x-forwarded-uri': '/admin/panel?x=1' })).status, 403);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '1.1.1.1', 'x-forwarded-uri': '/public' })).status, 200);
  
});
  const syncWithPassword = (hash: string | null, rules: unknown[] = []) =>
    fetch(`${base}/agent/deployments/${DEP}/waf/sync`, { method: 'POST', headers: { 'x-agent-secret': SECRET, 'content-type': 'application/json' }, body: JSON.stringify({ rules, protectionPasswordHash: hash }), signal: AbortSignal.timeout(5000) });
  const basicAuth = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  // bcryptjs hash of "correcthorse" at cost 4 (fast on purpose, this is a test, not production).
  const HASH = '$2a$04$cNzr7GuIwGfG0wuNUG4wLu.DdzLVogG1.pde/FRII/pCLmLFUCk8u';

  await t.test('password protection: no credentials -> 401 with a WWW-Authenticate header the browser needs to show its own prompt', async () => {
    await syncWithPassword(HASH);
    const res = await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '3.3.3.3' });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') || '', /Basic/);
  });

  await t.test('password protection: wrong password -> 401; correct password -> 200; username is ignored', async () => {
    await syncWithPassword(HASH);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '3.3.3.3', authorization: basicAuth('anyone', 'wrong') })).status, 401);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '3.3.3.3', authorization: basicAuth('doesnotmatter', 'correcthorse') })).status, 200);
  });

  await t.test('password protection: the same correct credentials keep working on repeated requests (the cache Node agent WAF tests already cover in isolation, checked here end to end)', async () => {
    await syncWithPassword(HASH);
    const auth = basicAuth('u', 'correcthorse');
    for (let i = 0; i < 5; i++) assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '3.3.3.3', authorization: auth })).status, 200);
  });

  await t.test('a WAF block rule takes precedence over the password prompt: a blocked IP gets 403, never 401', async () => {
    await syncWithPassword(HASH, [{ id: 'blockit', action: 'block', matchType: 'ip', matchValue: '6.6.6.6', isEnabled: true, rateLimitPerMinute: null }]);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '6.6.6.6', authorization: basicAuth('u', 'correcthorse') })).status, 403);
  });

  await t.test('changing the password immediately invalidates a previously-cached correct credential', async () => {
    await syncWithPassword(HASH);
    const oldAuth = basicAuth('u', 'correcthorse');
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '7.7.7.7', authorization: oldAuth })).status, 200);
    const NEW_HASH = '$2a$04$g9GM6.3kU.mejnOBFfLK6er0.oCRC.suvlhGL2ZEJ9yxH7h2iHhbu'; // "newpassword" @ cost 4
    await syncWithPassword(NEW_HASH);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '7.7.7.7', authorization: oldAuth })).status, 401, 'the old password no longer works, and is not served from a stale cache');
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '7.7.7.7', authorization: basicAuth('u', 'newpassword') })).status, 200);
  });

  await t.test('removing protection (syncing with no hash) opens the deployment back up', async () => {
    await syncWithPassword(HASH);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '8.8.8.8' })).status, 401);
    await syncWithPassword(null);
    assert.equal((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '8.8.8.8' })).status, 200);
  });

  await t.test('repeated wrong-password attempts from one IP are eventually rate-limited (bounds bcrypt CPU cost per attacker)', async () => {
    await syncWithPassword(HASH);
    const results: number[] = [];
    for (let i = 0; i < 25; i++) results.push((await wafCheck(`secret=${SECRET}`, { 'x-forwarded-for': '9.1.1.1', authorization: basicAuth('u', `wrong${i}`) })).status);
    assert.ok(results.includes(429), `expected a 429 among the last attempts: ${results.join(',')}`);
    assert.ok(results.slice(0, 5).every((s) => s === 401), 'the first several genuine wrong attempts are still evaluated (401), not immediately rate-limited');
  });
});
