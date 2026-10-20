import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

/**
 * loadOwnedDeployment() / canAccessFs() are shared helpers that called canAccessResource(owner, req)
 * with its READ default for every HTTP method, so support staff (read-only) and view-only team members
 * could restart/delete/reconfigure deployments, edit WAF + edge rules, create volumes and write or delete
 * files in a customer's workspace.
 */
const realFetch = globalThis.fetch;
const agentCalls: string[] = [];
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1')) return realFetch(url, init);
  agentCalls.push(`${init?.method || 'GET'} ${u}`);
  return new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const depRow = () => ({
  id: 'd1', userId: 'owner', containerId: 'c1', status: 'running', subdomain: 'app', nodeId: 'n1',
  repoUrl: 'https://github.com/o/r', branch: 'main', rootDir: '', edgeRules: [], envVars: [],
  node: { id: 'n1', ip: '203.0.113.5' }, user: { email: 'o@example.com' },
});
const dep = depRow;
const viewerMembership = () => ({ role: 'viewer', permissions: [{ resourceType: 'deployment', resourceId: 'd1', permission: 'view' }] });
const WRITES = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
const wrote = (calls: any[]) => calls.filter((c) => WRITES.some((w) => c.fn.endsWith('.' + w)));
type Res = { status: number; json: any };
// Every router answers an access denial with exactly this response (a 404 for anything else, e.g. a
// missing volume, or a 400 for a bad body, means the access check was PASSED).
const isDenied = (r: Res) => r.status === 404 && r.json?.error === 'Deployment not found';

const MUTATIONS: Array<{ file: string; exp: string; calls: Array<[string, string, any]> }> = [
  { file: 'volumes', exp: 'volumesRouter', calls: [['POST', '/deployments/d1/volumes', { name: 'v', mountPath: '/data', sizeGb: 1 }], ['DELETE', '/deployments/d1/volumes/vol1', {}]] },
  { file: 'waf', exp: 'wafRouter', calls: [['POST', '/deployments/d1/waf/rules', { action: 'block', matchType: 'ip', matchValue: '1.2.3.4' }], ['DELETE', '/deployments/d1/waf/rules/r1', {}], ['POST', '/deployments/d1/waf/protection', { password: 'x' }]] },
  { file: 'filesystem', exp: 'filesystemRouter', calls: [['PUT', '/fs/d1/write', { path: 'a.txt', content: 'x' }], ['POST', '/fs/d1/mkdir', { path: 'x' }], ['DELETE', '/fs/d1/delete', { path: 'a.txt' }], ['POST', '/fs/d1/rename', { from: 'a', to: 'b' }]] },
  { file: 'deployments', exp: 'deploymentsRouter', calls: [['POST', '/deployments/d1/launch', {}], ['PATCH', '/deployments/d1/config', {}]] },
  { file: 'edgeRules', exp: 'edgeRulesRouter', calls: [['PUT', '/deployments/d1/edge-rules', { rules: [] }]] },
  { file: 'nixpacks', exp: 'nixpacksRouter', calls: [['PUT', '/deployments/d1/nixpacks', {}]] },
];

async function run(file: string, exp: string, who: { user: string; role: string }, member: boolean, calls: Array<[string, string, any]>) {
  agentCalls.length = 0;
  const f = makeFakePrisma({
    'deployment.findUnique': dep, 'deployment.findFirst': dep, 'deployment.update': dep, 'deployment.create': dep,
    'teamMember.findFirst': member ? viewerMembership : () => null,
    'auditLog.create': () => ({}),
  });
  const s = await mountRouter(file, exp, f.prisma);
  const results: Res[] = [];
  try { for (const [m, p, body] of calls) results.push(await s.call(m, p, { ...who, body })); } finally { s.close(); }
  return { results, statuses: results.map((r) => r.status), f };
}

for (const { file, exp, calls } of MUTATIONS) {
  test(`${file}: support staff and view-only team members cannot use state-changing routes`, async () => {
    for (const who of [{ user: 'sup1', role: 'support', member: false }, { user: 'viewer1', role: 'customer', member: true }]) {
      const { results, statuses, f } = await run(file, exp, who, who.member, calls);
      assert.equal(results.every(isDenied), true, `${who.user}: statuses=${statuses}`);
      assert.deepEqual(wrote(f.calls), [], `${who.user}: no database write allowed`);
      assert.deepEqual(agentCalls, [], `${who.user}: no call may reach the node agent`);
    }
  });

  test(`${file}: the owner is not blocked by the access check`, async () => {
    const { results, statuses } = await run(file, exp, { user: 'owner', role: 'customer' }, false, calls);
    assert.equal(results.some(isDenied), false, `owner statuses=${statuses}`);
  });
}

test('support staff keep read-only visibility on deployments, volumes, WAF rules and the file manager', async () => {
  for (const [file, exp, path] of [['volumes', 'volumesRouter', '/deployments/d1/volumes'], ['waf', 'wafRouter', '/deployments/d1/waf/rules'], ['filesystem', 'filesystemRouter', '/fs/d1/list?path=.']] as const) {
    const { results } = await run(file, exp, { user: 'sup1', role: 'support' }, false, [['GET', path, undefined]]);
    assert.equal(isDenied(results[0]), false, `${file} GET got ${results[0].status}`);
  }
});
