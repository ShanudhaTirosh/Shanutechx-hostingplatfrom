import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSettingsUnlockToken, verifySettingsUnlockToken, SETTINGS_UNLOCK_TTL_MS } from '../../apps/api/src/lib/settingsUnlock';

const SECRET = 'unit-test-secret-0123456789abcdef';

test('a freshly issued token verifies for the same user', () => {
  const { token, expiresAt } = issueSettingsUnlockToken('u1', SECRET, 1_000);
  assert.equal(expiresAt, 1_000 + SETTINGS_UNLOCK_TTL_MS);
  assert.equal(verifySettingsUnlockToken(token, 'u1', SECRET, 2_000), true);
});

test('it is bound to the user and the server secret', () => {
  const { token } = issueSettingsUnlockToken('u1', SECRET, 1_000);
  assert.equal(verifySettingsUnlockToken(token, 'u2', SECRET, 2_000), false);
  assert.equal(verifySettingsUnlockToken(token, 'u1', 'another-secret', 2_000), false);
});

test('it expires', () => {
  const { token, expiresAt } = issueSettingsUnlockToken('u1', SECRET, 1_000);
  assert.equal(verifySettingsUnlockToken(token, 'u1', SECRET, expiresAt - 1), true);
  assert.equal(verifySettingsUnlockToken(token, 'u1', SECRET, expiresAt), false);
});

test('tampering with the payload or signature is rejected', () => {
  const { token } = issueSettingsUnlockToken('u1', SECRET, 1_000);
  const [p, s] = token.split('.');
  const forgedPayload = Buffer.from(`u1.${9_999_999_999_999}`).toString('base64url');
  assert.equal(verifySettingsUnlockToken(`${forgedPayload}.${s}`, 'u1', SECRET, 2_000), false);
  assert.equal(verifySettingsUnlockToken(`${p}.${s.slice(0, -2)}AA`, 'u1', SECRET, 2_000), false);
});

test('garbage input never verifies (and never throws)', () => {
  for (const bad of [undefined, null, 42, {}, '', 'abc', 'a.b.c', '.', 'x.', '.y', '%%%.%%%']) {
    assert.equal(verifySettingsUnlockToken(bad, 'u1', SECRET, 2_000), false, String(bad));
  }
});
