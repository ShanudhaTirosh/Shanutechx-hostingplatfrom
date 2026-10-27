import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

/**
 * nodeEngine = root-level host management (users, passwords, firewall, docker, packages, SSH tickets).
 * For customer VPS provisions, access used canAccessResource(owner, req) with its READ default, so
 * support staff (read-only) and view-only team members could run every state-changing operation.
 */
const realFetch = globalThis.fetch;
const agentCalls: string[] = [];
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1')) return realFetch(url, init); // the test's own HTTP server
  agentCalls.push(`${init?.method || 'GET'} ${u}`);
  return new Response(JSON.stringify({ ok: true, ticket: 't' }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const vps = () => ({ id: 'v1', userId: 'owner', ip: '203.0.113.9', panelUrl: null, externalId: 'x' });
const viewerMembership = () => ({ role: 'viewer', permissions: [{ resourceType: 'vps', resourceId: 'v1', permission: 'view' }] });

const WRITE_ROUTES: Array<[string, string, any]> = [
  ['POST', '/nodes/v1/engine/users', { username: 'u', password: 'p' }],
  ['POST', '/nodes/v1/engine/users/bob/password', { password: 'x' }],
  ['DELETE', '/nodes/v1/engine/users/bob', {}],
  ['POST', '/nodes/v1/engine/firewall/rules', { port: 22, protocol: 'tcp', action: 'allow' }],
  ['POST', '/nodes/v1/engine/services/action', { serviceName: 'nginx', action: 'restart' }],
  ['POST', '/nodes/v1/engine/docker/prune', {}],
  ['POST', '/nodes/v1/engine/ssh-ticket', {}],
];

async function run(who: { user: string; role: string }, membership: boolean, calls: Array<[string, string, any]>) {
  agentCalls.length = 0;
  const f = makeFakePrisma({
    'node.findUnique': () => null,
    'vpsProvision.findUnique': vps,
    'teamMember.findFirst': membership ? viewerMembership : () => null,
    'auditLog.create': () => ({}),
  });
  const s = await mountRouter('nodeEngine', 'nodeEngineRouter', f.prisma);
  const statuses: number[] = [];
  try {
    for (const [method, path, body] of calls) statuses.push((await s.call(method, path, { ...who, body })).status);
  } finally { s.close(); }
  return statuses;
}

test('support staff (read-only) cannot run any state-changing operation on a customer VPS', async () => {
  const statuses = await run({ user: 'sup1', role: 'support' }, false, WRITE_ROUTES);
  assert.deepEqual(statuses, WRITE_ROUTES.map(() => 404), `statuses=${statuses}`);
  assert.deepEqual(agentCalls, [], 'no call may reach the agent');
});

test('a view-only team member cannot run state-changing operations either', async () => {
  const statuses = await run({ user: 'viewer1', role: 'customer' }, true, WRITE_ROUTES);
  assert.deepEqual(statuses, WRITE_ROUTES.map(() => 404), `statuses=${statuses}`);
  assert.deepEqual(agentCalls, []);
});

test('the VPS owner can still run them', async () => {
  const statuses = await run({ user: 'owner', role: 'customer' }, false, WRITE_ROUTES);
  assert.equal(statuses.every((s) => s === 200 || s === 201), true, `statuses=${statuses}`);
  assert.equal(agentCalls.length >= WRITE_ROUTES.length - 1, true); // ssh-ticket does not call the agent
});

test('support staff keep read-only visibility (monitoring, services, users list)', async () => {
  const reads: Array<[string, string, any]> = [
    ['GET', '/nodes/v1/engine/monitoring', undefined],
    ['GET', '/nodes/v1/engine/services', undefined],
    ['GET', '/nodes/v1/engine/users', undefined],
  ];
  const statuses = await run({ user: 'sup1', role: 'support' }, false, reads);
  assert.deepEqual(statuses, [200, 200, 200], `statuses=${statuses}`);
  assert.equal(agentCalls.length, 3);
});

test('system cluster nodes (platform infra) are strictly restricted to role dev', async () => {
  agentCalls.length = 0;
  const clusterNode = () => ({ id: 'sys-node-1', ip: '10.0.0.1', label: 'prod-node-1', projects: [] });
  const f = makeFakePrisma({
    'node.findUnique': clusterNode,
    'vpsProvision.findUnique': () => null,
    'auditLog.create': () => ({}),
  });
  const s = await mountRouter('nodeEngine', 'nodeEngineRouter', f.prisma);

  try {
    // 1. Non-dev roles (admin, support, customer) MUST receive 404 / access denied on system nodes
    const nonDevRoles = ['admin', 'support', 'customer'];
    for (const role of nonDevRoles) {
      const res = await s.call('GET', '/nodes/sys-node-1/engine/firewall', { user: 'user1', role });
      assert.equal(res.status, 404, `Role ${role} must not access system compute node engine`);
    }

    // 2. Dev superuser role CAN access system compute nodes
    const devRes = await s.call('GET', '/nodes/sys-node-1/engine/firewall', { user: 'dev1', role: 'dev' });
    assert.equal(devRes.status, 200, 'Dev role can manage system compute node engine');
  } finally {
    s.close();
  }
});
