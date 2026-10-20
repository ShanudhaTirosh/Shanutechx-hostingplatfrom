import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

const user = (over: any = {}) => ({ id: 'target1', email: 't@example.com', displayName: 'T', role: 'customer', isBanned: false, assignedAdminId: 'admin1', firebaseUid: null, ...over });

async function impersonate(actor: { user: string; role: string }, target: any) {
  const f = makeFakePrisma({ 'user.findUnique': () => target, 'auditLog.create': () => ({}) });
  const s = await mountRouter('admin', 'adminRouter', f.prisma);
  try { return { ...(await s.call('POST', '/admin/impersonate/target1', actor)), f }; } finally { s.close(); }
}

test('POST /admin/impersonate: an admin can only impersonate their ASSIGNED customers', async () => {
  assert.equal((await impersonate({ user: 'admin1', role: 'admin' }, user())).status, 200);
  const denied = await impersonate({ user: 'admin1', role: 'admin' }, user({ assignedAdminId: 'admin2' }));
  assert.equal(denied.status, 403);
  assert.equal(denied.f.count('auditLog.create'), 0);
  assert.equal((await impersonate({ user: 'devuser', role: 'dev' }, user({ assignedAdminId: 'admin2' }))).status, 200);
});

test('POST /admin/impersonate: staff accounts cannot be impersonated and their profile is not returned', async () => {
  for (const role of ['admin', 'dev', 'support']) {
    const r = await impersonate({ user: 'devuser', role: 'dev' }, user({ role, email: 'staff-secret@example.com' }));
    assert.equal(r.status, 403, `target ${role}`);
    assert.equal(JSON.stringify(r.json).includes('staff-secret@example.com'), false);
  }
});

async function setRole(actor: { user: string; role: string }, target: any, role: string) {
  const f = makeFakePrisma({ 'user.findUnique': () => target, 'user.update': (a: any) => ({ ...target, ...a.data }), 'auditLog.create': () => ({}) });
  const s = await mountRouter('admin', 'adminRouter', f.prisma);
  try { return { ...(await s.call('PATCH', '/admin/staff/target1/role', { ...actor, body: { role } })), f }; } finally { s.close(); }
}

test('PATCH /admin/staff/:id/role: only dev may change the role of an ADMIN account (admins cannot demote each other)', async () => {
  const demote = await setRole({ user: 'admin1', role: 'admin' }, user({ role: 'admin' }), 'customer');
  assert.equal(demote.status, 403);
  assert.equal(demote.f.count('user.update'), 0);
  assert.equal((await setRole({ user: 'devuser', role: 'dev' }, user({ role: 'admin' }), 'customer')).status, 200);
});

test('PATCH /admin/staff/:id/role: admins can still manage support staff, and dev accounts stay undemotable', async () => {
  assert.equal((await setRole({ user: 'admin1', role: 'admin' }, user(), 'support')).status, 200);
  assert.equal((await setRole({ user: 'admin1', role: 'admin' }, user({ role: 'support' }), 'customer')).status, 200);
  assert.equal((await setRole({ user: 'admin1', role: 'admin' }, user({ role: 'admin' }), 'admin')).status === 403, true, 'admin cannot touch admins');
  assert.equal((await setRole({ user: 'devuser', role: 'dev' }, user({ role: 'dev' }), 'admin')).status, 403, 'dev cannot be demoted');
});
