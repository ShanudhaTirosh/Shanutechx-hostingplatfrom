import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveVpsAgentSecret, vpsAgentSecretFor } from '../../apps/api/src/lib/agentSecret';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';
import { env } from '../../apps/api/src/env';

process.env.NODE_AGENT_SECRET = process.env.NODE_AGENT_SECRET || env.nodeAgentSecret;
const PLATFORM = process.env.NODE_AGENT_SECRET;

test('derived VPS secrets are deterministic, per-VPS and not the platform secret', () => {
  const a = deriveVpsAgentSecret('vps-a', PLATFORM);
  assert.equal(a, deriveVpsAgentSecret('vps-a', PLATFORM));
  assert.notEqual(a, deriveVpsAgentSecret('vps-b', PLATFORM));
  assert.notEqual(a, deriveVpsAgentSecret('vps-a', PLATFORM + 'x'));
  assert.notEqual(a, PLATFORM);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("mode 'derived' switches to the derived secret, anything else keeps the platform secret (compatible default)", () => {
  assert.equal(vpsAgentSecretFor('v', PLATFORM, 'derived'), deriveVpsAgentSecret('v', PLATFORM));
  for (const mode of [undefined, '', 'legacy', 'DERIVED', 'true']) assert.equal(vpsAgentSecretFor('v', PLATFORM, mode), PLATFORM);
});

// ---- what actually leaves the API for a customer VPS ----
const realFetch = globalThis.fetch;
const outbound: Array<{ url: string; secret?: string }> = [];
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init);
  outbound.push({ url: String(url), secret: init?.headers?.['x-agent-secret'] });
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

async function engineCall(opts: { who: { user: string; role: string }; clusterNode?: boolean; mode?: string }) {
  outbound.length = 0;
  if (opts.mode === undefined) delete process.env.VPS_AGENT_SECRET_MODE; else process.env.VPS_AGENT_SECRET_MODE = opts.mode;
  const f = makeFakePrisma({
    'node.findUnique': () => (opts.clusterNode ? { id: 'n1', ip: '10.0.0.5', label: 'edge-1', monthlyBandwidthGb: 1000 } : null),
    'vpsProvision.findUnique': () => ({ id: 'v1', userId: 'cust1', ip: '203.0.113.77', externalId: 'x' }),
  });
  const s = await mountRouter('nodeEngine', 'nodeEngineRouter', f.prisma);
  try { await s.call('GET', `/nodes/${opts.clusterNode ? 'n1' : 'v1'}/engine/monitoring`, opts.who); } finally { s.close(); }
  return outbound[0];
}

test("derived mode: a customer's VPS never receives the platform secret, only its own derived one", async () => {
  const call = await engineCall({ who: { user: 'cust1', role: 'customer' }, mode: 'derived' });
  assert.match(call.url, /^http:\/\/203\.0\.113\.77:/);
  assert.equal(call.secret, deriveVpsAgentSecret('v1', PLATFORM));
  assert.notEqual(call.secret, PLATFORM);
});

test('derived mode: platform-owned cluster nodes still authenticate with the platform secret', async () => {
  const call = await engineCall({ who: { user: 'adm1', role: 'dev' }, clusterNode: true, mode: 'derived' });
  assert.match(call.url, /^http:\/\/10\.0\.0\.5:/);
  assert.equal(call.secret, PLATFORM);
});

test('default (legacy) mode is unchanged so existing VPS agents keep working until they are re-keyed', async () => {
  const call = await engineCall({ who: { user: 'cust1', role: 'customer' } });
  assert.equal(call.secret, PLATFORM);
});
