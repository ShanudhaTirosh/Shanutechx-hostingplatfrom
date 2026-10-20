import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

/**
 * canAccessResource(owner, req) defaults to action='read'. Support staff are read-only by policy
 * (MED-05) and team members with only a "view" permission may not change things, so every
 * state-changing route must authorise with action='write'.
 */
const dbRow = () => ({ id: 'd1', userId: 'owner', containerId: null, node: null, nodeId: 'n1', name: 'db', type: 'postgres', status: 'running' });
const vpsRow = () => ({ id: 'v1', userId: 'owner', host: '203.0.113.9', status: 'active', credentialRef: null, sshPrivateKey: null });
const keyRow = () => ({ id: 'k1', userId: 'owner', revokedAt: null });
const lkRow = () => ({ id: 'p1', userId: 'owner', isActive: true, apiKey: 'k', apiSecretRef: 'x' });
const WRITES = ['update', 'updateMany', 'delete', 'deleteMany', 'create', 'upsert'];
const wrote = (calls: any[]) => calls.filter((c) => WRITES.some((w) => c.fn.endsWith('.' + w)));

// A customer who is a team member of the owner's team but only has a read ("view") permission.
const viewerMembership = () => ({ role: 'viewer', permissions: [{ resourceType: 'managed_database', resourceId: 'd1', permission: 'view' }] });

test('support staff (read-only) cannot revoke a customer API key; the owner can', async () => {
  const f = makeFakePrisma({ 'apiKey.findUnique': keyRow, 'apiKey.update': () => ({}) });
  const s = await mountRouter('apiKeys', 'apiKeysRouter', f.prisma);
  try {
    const denied = await s.call('DELETE', '/api-keys/k1', { user: 'sup1', role: 'support' });
    assert.equal(denied.status, 404);
    assert.equal(f.count('apiKey.update'), 0, 'support must not revoke keys');
    const ok = await s.call('DELETE', '/api-keys/k1', { user: 'owner', role: 'customer' });
    assert.equal(ok.status, 200);
    assert.equal(f.count('apiKey.update'), 1);
  } finally { s.close(); }
});

test('support staff cannot delete a customer database, and a view-only team member cannot either', async () => {
  for (const who of [
    { user: 'sup1', role: 'support', label: 'support' },
    { user: 'viewer1', role: 'customer', label: 'view-only team member' },
  ]) {
    const f = makeFakePrisma({
      'managedDatabase.findUnique': dbRow,
      'teamMember.findFirst': who.label === 'support' ? () => null : viewerMembership,
    });
    const s = await mountRouter('managedDatabases', 'managedDatabasesRouter', f.prisma);
    try {
      const r = await s.call('DELETE', '/managed-databases/d1', { user: who.user, role: who.role });
      assert.equal(r.status, 404, `${who.label} got ${r.status}`);
      assert.deepEqual(wrote(f.calls), [], `${who.label} must not cause any write`);
    } finally { s.close(); }
  }
});

test('support staff cannot power-cycle or delete a customer VPS', async () => {
  const f = makeFakePrisma({ 'vpsProvision.findUnique': vpsRow });
  const s = await mountRouter('vps', 'vpsRouter', f.prisma);
  try {
    const power = await s.call('POST', '/vps-provisions/v1/power', { user: 'sup1', role: 'support', body: { action: 'reboot' } });
    assert.equal(power.status, 404, `power got ${power.status}`);
    const del = await s.call('DELETE', '/vps-provisions/v1', { user: 'sup1', role: 'support' });
    assert.equal(del.status, 404, `delete got ${del.status}`);
    assert.deepEqual(wrote(f.calls), []);
  } finally { s.close(); }
});

test('support staff cannot mint LiveKit room tokens for a customer project', async () => {
  const f = makeFakePrisma({ 'liveKitProject.findUnique': lkRow });
  const s = await mountRouter('livekit', 'livekitRouter', f.prisma);
  try {
    const r = await s.call('POST', '/livekit/projects/p1/token', { user: 'sup1', role: 'support', body: { roomName: 'r', identity: 'i' } });
    assert.equal(r.status, 404, `got ${r.status}`);
  } finally { s.close(); }
});

test('read-only access still works for reads (support can view, owner unaffected)', async () => {
  const f = makeFakePrisma({ 'managedDatabase.findUnique': dbRow, 'vpsProvision.findUnique': vpsRow, 'vpsProvision.findFirst': vpsRow });
  const s = await mountRouter('vps', 'vpsRouter', f.prisma);
  try {
    const r = await s.call('GET', '/vps-provisions/v1', { user: 'sup1', role: 'support' });
    assert.equal(r.status, 200, 'support must keep read visibility for ticket investigation');
  } finally { s.close(); }
});
