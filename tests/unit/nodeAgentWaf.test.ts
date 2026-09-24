import test from 'node:test';
import assert from 'node:assert/strict';
import waf from '../../services/node-agent/src/waf.js';

const { evaluate, ruleMatches, matchesIp, matchesIpRange, matchesHeader, matchesPath, matchesUserAgent, RateLimiter } = waf as any;

const rule = (o: any) => ({ id: 'r1', action: 'block', matchType: 'ip', matchValue: '1.2.3.4', rateLimitPerMinute: null, isEnabled: true, ...o });
const req = (o: any = {}) => ({ ip: '1.2.3.4', path: '/', userAgent: 'curl/8.0', headers: {}, ...o });

test('matchesIp / matchesIpRange', () => {
  assert.equal(matchesIp('1.2.3.4', '1.2.3.4'), true);
  assert.equal(matchesIp('1.2.3.5', '1.2.3.4'), false);
  assert.equal(matchesIp('::1', '::1'), false, 'IPv6 never matches (unsupported, fails safe)');
  assert.equal(matchesIpRange('10.0.0.5', '10.0.0.0/24'), true);
  assert.equal(matchesIpRange('10.0.1.5', '10.0.0.0/24'), false);
  assert.equal(matchesIpRange('192.168.1.1', '0.0.0.0/0'), true, '/0 matches everything');
  assert.equal(matchesIpRange('10.0.0.1', '10.0.0.1/32'), true);
  assert.equal(matchesIpRange('10.0.0.2', '10.0.0.1/32'), false);
  assert.equal(matchesIpRange('bad', '10.0.0.0/24'), false);
  assert.equal(matchesIpRange('10.0.0.1', 'not-a-cidr'), false);
  assert.equal(matchesIpRange('10.0.0.1', '10.0.0.0/99'), false, 'invalid prefix length rejected, not crashed');
});

test('matchesHeader: bare name = presence, "Name: value" = exact value, case-insensitive name', () => {
  assert.equal(matchesHeader({ 'x-api-key': 'secret' }, 'X-Api-Key'), true);
  assert.equal(matchesHeader({}, 'X-Api-Key'), false);
  assert.equal(matchesHeader({ 'x-api-key': 'secret' }, 'X-Api-Key: secret'), true);
  assert.equal(matchesHeader({ 'x-api-key': 'wrong' }, 'X-Api-Key: secret'), false);
});

test('matchesPath: exact, and trailing * = prefix', () => {
  assert.equal(matchesPath('/admin', '/admin'), true);
  assert.equal(matchesPath('/admin/x', '/admin'), false);
  assert.equal(matchesPath('/admin/x', '/admin*'), true);
  assert.equal(matchesPath('/other', '/admin*'), false);
});

test('matchesUserAgent: case-insensitive substring', () => {
  assert.equal(matchesUserAgent('Mozilla/5.0 (compatible; BadBot/1.0)', 'badbot'), true);
  assert.equal(matchesUserAgent('curl/8.0', 'badbot'), false);
});

test('ruleMatches: an unrecognised matchType (e.g. a not-yet-supported "country") never matches', () => {
  assert.equal(ruleMatches(rule({ matchType: 'country', matchValue: 'US' }), req()), false);
});

test('evaluate: precedence', async (t) => {
  await t.test('a matching block rule wins, regardless of rule order', () => {
    const rules = [rule({ id: 'allow-would-be-irrelevant', action: 'block', matchValue: '9.9.9.9' }), rule({ id: 'the-block', action: 'block', matchValue: '1.2.3.4' })];
    assert.deepEqual(evaluate(rules, req(), new RateLimiter()), { decision: 'block', ruleId: 'the-block' });
  });

  await t.test('no matching rule at all defaults to allow', () => {
    assert.deepEqual(evaluate([rule({ matchValue: '9.9.9.9' })], req(), new RateLimiter()), { decision: 'allow', ruleId: null });
  });

  await t.test('a disabled rule is never applied', () => {
    assert.deepEqual(evaluate([rule({ isEnabled: false })], req(), new RateLimiter()), { decision: 'allow', ruleId: null });
  });

  await t.test('a rate_limit rule with no threshold set fails OPEN (never silently blocks everyone)', () => {
    const rules = [rule({ action: 'rate_limit', matchType: 'ip', matchValue: '1.2.3.4', rateLimitPerMinute: null })];
    for (let i = 0; i < 20; i++) assert.deepEqual(evaluate(rules, req(), new RateLimiter()), { decision: 'allow', ruleId: null });
  });

  await t.test('rate limiting: the Nth+1 request in the window is rejected, the window resets, allow rules still apply within it', () => {
    const rules = [rule({ id: 'rl', action: 'rate_limit', matchType: 'ip', matchValue: '1.2.3.4', rateLimitPerMinute: 3 })];
    const limiter = new RateLimiter();
    const t0 = 60_000_000;
    for (let i = 0; i < 3; i++) assert.deepEqual(evaluate(rules, req(), limiter, t0 + i), { decision: 'allow', ruleId: null });
    assert.deepEqual(evaluate(rules, req(), limiter, t0 + 4), { decision: 'rate_limited', ruleId: 'rl' });
    assert.deepEqual(evaluate(rules, req(), limiter, t0 + 60_000), { decision: 'allow', ruleId: null }, 'next minute, counter resets');
  });

  await t.test('rate limiting is scoped per IP: a different IP has its own budget', () => {
    const rules = [rule({ id: 'rl', action: 'rate_limit', matchType: 'ip_range', matchValue: '0.0.0.0/0', rateLimitPerMinute: 1 })];
    const limiter = new RateLimiter();
    assert.equal(evaluate(rules, req({ ip: '1.1.1.1' }), limiter, 0).decision, 'allow');
    assert.equal(evaluate(rules, req({ ip: '1.1.1.1' }), limiter, 0).decision, 'rate_limited');
    assert.equal(evaluate(rules, req({ ip: '2.2.2.2' }), limiter, 0).decision, 'allow', 'a different IP is not affected');
  });

  await t.test('a block rule for one IP does not affect requests from a different IP', () => {
    assert.deepEqual(evaluate([rule({ matchValue: '1.2.3.4' })], req({ ip: '9.9.9.9' }), new RateLimiter()), { decision: 'allow', ruleId: null });
  });

  await t.test('path- and header-scoped block rules only block matching requests', () => {
    const rules = [rule({ id: 'admin-block', matchType: 'path', matchValue: '/admin*' })];
    assert.equal(evaluate(rules, req({ path: '/admin/panel' }), new RateLimiter()).decision, 'block');
    assert.equal(evaluate(rules, req({ path: '/public' }), new RateLimiter()).decision, 'allow');
  });
});

test('RateLimiter.sweep removes stale windows so memory does not grow unbounded', () => {
  const limiter = new RateLimiter();
  limiter.hit('a', 5, 0);
  limiter.hit('b', 5, 0);
  assert.equal((limiter as any).windows.size, 2);
  limiter.sweep(120_000);
  assert.equal((limiter as any).windows.size, 0);
});

test('PasswordGate', async (t) => {
  const { PasswordGate } = waf as any;
  const b64 = (s: string) => `Basic ${Buffer.from(s).toString('base64')}`;

  await t.test('no hash set: protection is off, everything passes without ever calling compare', async () => {
    let calls = 0;
    const gate = new PasswordGate(async () => { calls++; return true; });
    assert.deepEqual(await gate.check('d1', null, undefined), { ok: true });
    assert.equal(calls, 0);
  });

  await t.test('missing Authorization, or the wrong scheme, is rejected without calling compare', async () => {
    let calls = 0;
    const gate = new PasswordGate(async () => { calls++; return true; });
    assert.deepEqual(await gate.check('d1', 'HASH', undefined), { ok: false, reason: 'missing' });
    assert.deepEqual(await gate.check('d1', 'HASH', 'Bearer abc'), { ok: false, reason: 'missing' });
    assert.equal(calls, 0);
  });

  await t.test('garbage after "Basic " never crashes; it is just treated as a (wrong) password attempt', async () => {
    const gate = new PasswordGate(async (pw: string) => pw === 'right');
    const result = await gate.check('d1', 'HASH', 'Basic %%%not-base64%%%');
    assert.equal(result.ok, false);
  });

  await t.test('only the password portion is checked; the username is accepted but ignored', async () => {
    let seen: string | null = null;
    const gate = new PasswordGate(async (pw: string) => { seen = pw; return pw === 'letmein'; });
    assert.equal((await gate.check('d1', 'HASH', b64('anyuser:letmein'))).ok, true);
    assert.equal(seen, 'letmein');
    assert.equal((await gate.check('d1', 'HASH', b64(':letmein'))).ok, true, 'an empty username is fine too');
  });

  await t.test('a wrong password is rejected, and rejection is never cached (so a later correct attempt still works)', async () => {
    const gate = new PasswordGate(async (pw: string) => pw === 'right');
    assert.deepEqual(await gate.check('d1', 'HASH', b64('u:wrong')), { ok: false, reason: 'wrong' });
    assert.deepEqual(await gate.check('d1', 'HASH', b64('u:right')), { ok: true });
  });

  await t.test('the whole point: once verified, the SAME header is accepted again without calling compare (avoids a slow bcrypt call on every request)', async () => {
    let calls = 0;
    const gate = new PasswordGate(async () => { calls++; return true; });
    const header = b64('u:right');
    assert.equal((await gate.check('d1', 'HASH', header)).ok, true);
    assert.equal(calls, 1);
    for (let i = 0; i < 50; i++) await gate.check('d1', 'HASH', header);
    assert.equal(calls, 1, 'compare was called exactly once despite 51 requests with the same credentials');
  });

  await t.test('a different deployment, or a different password, gets its own cache entry (no cross-deployment leakage)', async () => {
    let calls = 0;
    const gate = new PasswordGate(async () => { calls++; return true; });
    await gate.check('d1', 'HASH1', b64('u:pw'));
    await gate.check('d2', 'HASH2', b64('u:pw'));
    assert.equal(calls, 2);
  });

  await t.test('invalidate() clears the cache for one deployment only, forcing a fresh compare (so a changed/removed password takes effect immediately)', async () => {
    let calls = 0;
    const gate = new PasswordGate(async () => { calls++; return true; });
    const h1 = b64('u:pw1');
    await gate.check('d1', 'HASH', h1);
    await gate.check('d2', 'HASH', h1);
    gate.invalidate('d1');
    await gate.check('d1', 'HASH', h1);
    await gate.check('d2', 'HASH', h1);
    assert.equal(calls, 3, 'd1 was re-checked after invalidation; d2 was not');
  });

  await t.test('the cache does not grow without bound', async () => {
    const gate = new PasswordGate(async () => true);
    for (let i = 0; i < 1100; i++) await gate.check('d1', 'HASH', b64(`u${i}:pw`));
    assert.ok((gate as any)._verified.get('d1').size <= 1000);
  });
});
