import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../../apps/mobile-admin/src/lib/serverUrl';

const ok = (input: string, opts?: { allowInsecureLoopback?: boolean }) => {
  const r = normalizeServerUrl(input, opts);
  assert.equal(r.ok, true, `${input} should be accepted: ${JSON.stringify(r)}`);
  return (r as { ok: true; url: string }).url;
};
const bad = (input: string, opts?: { allowInsecureLoopback?: boolean }) =>
  assert.equal(normalizeServerUrl(input, opts).ok, false, `${input} should be rejected`);

test('https URLs are accepted and normalised (trim, lower-case host, no trailing slash)', () => {
  assert.equal(ok('https://api.shanutechx.com'), 'https://api.shanutechx.com');
  assert.equal(ok('  HTTPS://API.ShanuTechX.com///  '), 'https://api.shanutechx.com');
  assert.equal(ok('https://api.example.com:8443/v1/'), 'https://api.example.com:8443/v1');
});

test('plain http is rejected for real servers, even in dev builds', () => {
  bad('http://api.shanutechx.com');
  bad('http://api.shanutechx.com', { allowInsecureLoopback: true });
  bad('http://evil.example', { allowInsecureLoopback: true });
});

test('plain http is accepted only for loopback / emulator hosts and only when explicitly allowed (dev builds)', () => {
  bad('http://localhost:4000');
  for (const u of ['http://localhost:4000', 'http://127.0.0.1:4000', 'http://10.0.2.2:4000', 'http://[::1]:4000']) {
    assert.equal(ok(u, { allowInsecureLoopback: true }), u);
  }
});

test('embedded credentials, query strings and fragments are rejected', () => {
  bad('https://admin:secret@api.shanutechx.com');
  bad('https://admin@api.shanutechx.com');
  bad('https://api.shanutechx.com?x=1');
  bad('https://api.shanutechx.com/path#frag');
});

test('non-URLs, other schemes and bad ports are rejected', () => {
  for (const u of ['', '   ', 'not a url', 'api.shanutechx.com', 'ftp://api.shanutechx.com', 'javascript:alert(1)', 'https://', 'https://exa mple.com', 'https://host:99999']) bad(u);
});
