import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

const invite = () => ({ id: 'i1', teamId: 't1', token: 'SECRET-INVITE-TOKEN', email: 'x@y.z', status: 'pending', role: 'viewer', invitedByUser: { id: 'owner' } });
const team = () => ({
  id: 't1', name: 'Acme', ownerId: 'owner', owner: { id: 'owner' },
  members: [
    { id: 'm-viewer', userId: 'viewer1', teamId: 't1', role: 'viewer', permissions: [] },
    { id: 'm-admin', userId: 'tadmin', teamId: 't1', role: 'admin', permissions: [] },
  ],
  invites: [invite()],
});

function setup(assignedAdminId = 'someone-else') {
  let p: any;
  const f = makeFakePrisma({
    '$transaction': (cb: any) => cb(p),
    'team.findUnique': team,
    'teamInvite.findUnique': invite,
    'teamInvite.delete': () => ({}),
    'teamMember.findUnique': () => ({ id: 'm-viewer', teamId: 't1', userId: 'viewer1', role: 'viewer' }),
    'teamMember.update': () => ({ id: 'm-viewer' }),
    'teamMember.delete': () => ({}),
    'resourcePermission.deleteMany': () => ({}),
    'user.findUnique': () => ({ assignedAdminId }),
    'deployment.findMany': () => [], 'managedDatabase.findMany': () => [], 'vpsProvision.findMany': () => [], 'smtpAccount.findMany': () => [],
  });
  p = f.prisma;
  return f;
}

test('revoking an invitation requires owner / team-admin / dev (previously the check was computed but never enforced)', async () => {
  const f = setup();
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    for (const who of [{ user: 'stranger', label: 'non-member' }, { user: 'viewer1', label: 'viewer member' }]) {
      const r = await s.call('DELETE', '/teams/t1/invites/i1', { user: who.user });
      assert.equal(r.status, 403, `${who.label} got ${r.status}`);
    }
    assert.equal(f.count('teamInvite.delete'), 0);
    for (const who of [{ user: 'owner' }, { user: 'tadmin' }, { user: 'devuser', role: 'dev' }]) {
      const r = await s.call('DELETE', '/teams/t1/invites/i1', who);
      assert.equal(r.status, 200, `${who.user} got ${r.status}`);
    }
    assert.equal(f.count('teamInvite.delete'), 3);
  } finally { s.close(); }
});

test('a platform admin can only edit/remove members of teams owned by their ASSIGNED customers', async () => {
  const f = setup('someone-else'); // the caller (admin1) is NOT the owner's assigned admin
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    const patch = await s.call('PATCH', '/teams/t1/members/m-viewer', { user: 'admin1', role: 'admin', body: { role: 'admin' } });
    assert.equal(patch.status, 403, `PATCH got ${patch.status}`);
    const del = await s.call('DELETE', '/teams/t1/members/m-viewer', { user: 'admin1', role: 'admin' });
    assert.equal(del.status, 403, `DELETE got ${del.status}`);
    assert.equal(f.count('teamMember.update'), 0);
    assert.equal(f.count('teamMember.delete'), 0);
  } finally { s.close(); }
});

test('owner, the ASSIGNED admin and dev can still manage members; members can still leave', async () => {
  const f = setup('admin1'); // admin1 IS the owner's assigned admin
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    assert.equal((await s.call('PATCH', '/teams/t1/members/m-viewer', { user: 'owner', body: { role: 'developer' } })).status, 200);
    assert.equal((await s.call('PATCH', '/teams/t1/members/m-viewer', { user: 'admin1', role: 'admin', body: { role: 'developer' } })).status, 200);
    assert.equal((await s.call('PATCH', '/teams/t1/members/m-viewer', { user: 'devuser', role: 'dev', body: { role: 'developer' } })).status, 200);
    assert.equal((await s.call('DELETE', '/teams/t1/members/m-viewer', { user: 'viewer1' })).status, 200); // leave
    assert.equal((await s.call('DELETE', '/teams/t1/members/m-viewer', { user: 'admin1', role: 'admin' })).status, 200);
  } finally { s.close(); }
});

test('a team ADMIN member still cannot edit member roles (owner-only, as the API message says)', async () => {
  const f = setup();
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    assert.equal((await s.call('PATCH', '/teams/t1/members/m-viewer', { user: 'tadmin', body: { role: 'admin' } })).status, 403);
  } finally { s.close(); }
});

test('GET /teams/:id hides pending-invite tokens from ordinary members, owners and team admins still see them', async () => {
  const f = setup();
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    const viewer = await s.call('GET', '/teams/t1', { user: 'viewer1' });
    assert.equal(viewer.status, 200);
    assert.equal(JSON.stringify(viewer.json).includes('SECRET-INVITE-TOKEN'), false, 'viewer must not see invite tokens');
    for (const user of ['owner', 'tadmin']) {
      const r = await s.call('GET', '/teams/t1', { user });
      assert.equal(JSON.stringify(r.json).includes('SECRET-INVITE-TOKEN'), true, `${user} should still see invites`);
    }
  } finally { s.close(); }
});

test('GET /teams/:id: a platform admin who is not assigned to the owner cannot read the team', async () => {
  const f = setup('someone-else');
  const s = await mountRouter('teams', 'teamsRouter', f.prisma);
  try {
    assert.equal((await s.call('GET', '/teams/t1', { user: 'admin1', role: 'admin' })).status, 403);
    const f2 = setup('admin1');
    const s2 = await mountRouter('teams', 'teamsRouter', f2.prisma);
    try { assert.equal((await s2.call('GET', '/teams/t1', { user: 'admin1', role: 'admin' })).status, 200); } finally { s2.close(); }
  } finally { s.close(); }
});
