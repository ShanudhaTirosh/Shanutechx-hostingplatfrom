import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

const PIN_HASH = bcrypt.hashSync('1234', 4);

function setup() {
  const f = makeFakePrisma({
    'user.findUnique': () => ({ settingsPinHash: PIN_HASH }),
    'secretProject.findFirst': () => ({ id: 'sp1' }),
    'secretItem.upsert': () => ({}),
    'auditLog.create': () => ({}),
  });
  return f;
}

async function unlockToken(s: any, user: string) {
  const r = await s.call('POST', '/settings/verify-password', { user, role: 'admin', body: { password: '1234' } });
  assert.equal(r.status, 200);
  assert.equal(typeof r.json.unlockToken, 'string', 'verify-password must return a server-issued unlock token');
  return r.json.unlockToken as string;
}

test('verify-password rejects a wrong PIN and issues no token', async () => {
  const s = await mountRouter('settings', 'settingsRouter', setup().prisma, '/api/settings');
  try {
    const r = await s.call('POST', '/settings/verify-password', { user: 'admin1', role: 'admin', body: { password: 'wrong' } });
    assert.equal(r.status, 401);
    assert.equal(r.json.unlockToken, undefined);
  } finally { s.close(); }
});

test('replacing the platform GitHub backup token requires the PIN-derived unlock token (admins)', async () => {
  const f = setup();
  const s = await mountRouter('settings', 'settingsRouter', f.prisma, '/api/settings');
  try {
    const body = { token: 'ghp_attacker', org: 'attacker-org' };
    const locked = await s.call('POST', '/settings/github-backup', { user: 'admin1', role: 'admin', body });
    assert.equal(locked.status, 403);
    assert.equal(locked.json.code, 'SETTINGS_LOCKED');
    assert.equal(f.count('secretItem.upsert'), 0, 'nothing may be stored while locked');

    const forged = await s.call('POST', '/settings/github-backup', { user: 'admin1', role: 'admin', body: { ...body, unlockToken: 'forged.token' } });
    assert.equal(forged.status, 403);

    const token = await unlockToken(s, 'admin1');
    const other = await s.call('POST', '/settings/github-backup', { user: 'admin2', role: 'admin', body: { ...body, unlockToken: token } });
    assert.equal(other.status, 403, "another user's token must not work");

    const ok = await s.call('POST', '/settings/github-backup', { user: 'admin1', role: 'admin', body: { ...body, unlockToken: token } });
    assert.equal(ok.status, 200);
    assert.equal(f.count('secretItem.upsert'), 1);
  } finally { s.close(); }
});

test('the GitHub connection test (which uses the stored token) is locked the same way', async () => {
  const s = await mountRouter('settings', 'settingsRouter', setup().prisma, '/api/settings');
  try {
    const r = await s.call('POST', '/settings/github-backup/test', { user: 'admin1', role: 'admin', body: {} });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'SETTINGS_LOCKED');
  } finally { s.close(); }
});

test('dev accounts are exempt (the dashboard auto-unlocks dev without a PIN prompt)', async () => {
  const f = setup();
  const s = await mountRouter('settings', 'settingsRouter', f.prisma, '/api/settings');
  try {
    const r = await s.call('POST', '/settings/github-backup', { user: 'devuser', role: 'dev', body: { token: 'ghp_x', org: 'my-org' } });
    assert.equal(r.status, 200);
    assert.equal(f.count('secretItem.upsert'), 1);
  } finally { s.close(); }
});

test('the backup org must look like a GitHub org name (it is interpolated into API URLs)', async () => {
  const s = await mountRouter('settings', 'settingsRouter', setup().prisma, '/api/settings');
  try {
    for (const org of ['../user/repos', 'a/b', 'org?x=1', 'with space', 'a'.repeat(40)]) {
      const r = await s.call('POST', '/settings/github-backup', { user: 'devuser', role: 'dev', body: { token: 'ghp_x', org } });
      assert.equal(r.status, 400, `org=${org}`);
    }
    assert.equal((await s.call('POST', '/settings/github-backup', { user: 'devuser', role: 'dev', body: { token: 'ghp_x', org: '' } })).status, 200);
    assert.equal((await s.call('POST', '/settings/github-backup/test', { user: 'devuser', role: 'dev', body: { token: 't', org: '../x' } })).status, 400);
  } finally { s.close(); }
});
