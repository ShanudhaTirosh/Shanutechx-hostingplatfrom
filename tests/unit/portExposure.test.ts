import test from 'node:test';
import assert from 'node:assert/strict';
import * as pe from '../../apps/api/src/lib/portExposure';

const reserved = pe.reservedPorts(5000);
const dep = (o: Partial<pe.DeploymentPortRow> = {}): pe.DeploymentPortRow => ({
  id: 'd1', userId: 'u1', nodeId: 'n1', subdomain: 'app1', status: 'running', exposureMode: 'ssl_with_proxy', internalPort: 3000, publishedPort: null, ...o,
});
const exp = (o: Partial<pe.NodeExposureRow> = {}): pe.NodeExposureRow => ({ id: 'e1', nodeId: 'n1', port: 9000, protocol: 'http', subdomain: 'myport', cfDnsRecordId: 'cf1', label: null, ...o });
const ctx = (o: Partial<pe.ValidateContext> = {}): pe.ValidateContext => ({ deployment: dep(), siblings: [], nodeExposures: [], reserved, ...o });

test('modes map to stored values and back (including legacy names)', () => {
  assert.equal(pe.modeFromStored('ssl_with_proxy'), 'proxied');
  assert.equal(pe.modeFromStored('ssl_direct'), 'proxied');
  assert.equal(pe.modeFromStored(null), 'proxied');
  assert.equal(pe.modeFromStored('no_ssl'), 'direct_port');
  assert.equal(pe.modeFromStored('raw_tcp'), 'direct_port');
  assert.equal(pe.modeFromStored('internal_only'), 'internal');
  assert.deepEqual(['proxied', 'direct_port', 'internal'].map((m) => pe.STORED_MODE[m as pe.ExposureMode]), ['ssl_with_proxy', 'no_ssl', 'internal_only']);
});

test('effectiveHostPort mirrors the agent: publishedPort wins, else internalPort, only for direct mode', () => {
  assert.equal(pe.effectiveHostPort(dep({ exposureMode: 'no_ssl', publishedPort: 25565 })), 25565);
  assert.equal(pe.effectiveHostPort(dep({ exposureMode: 'no_ssl', publishedPort: null, internalPort: 3000 })), 3000);
  assert.equal(pe.effectiveHostPort(dep({ exposureMode: 'raw_tcp', publishedPort: 4000 })), 4000);
  assert.equal(pe.effectiveHostPort(dep({ exposureMode: 'ssl_with_proxy', publishedPort: 4000 })), null);
  assert.equal(pe.effectiveHostPort(dep({ exposureMode: 'internal_only', publishedPort: 4000 })), null);
});

test('validateExposureChange', async (t) => {
  await t.test('proxied / internal store the right mode and clear any port', () => {
    assert.deepEqual(pe.validateExposureChange({ mode: 'proxied' }, ctx()), { exposureMode: 'ssl_with_proxy', publishedPort: null });
    assert.deepEqual(pe.validateExposureChange({ mode: 'internal' }, ctx()), { exposureMode: 'internal_only', publishedPort: null });
  });
  await t.test('a port with a non-direct mode is refused rather than silently dropped', () => {
    assert.throws(() => pe.validateExposureChange({ mode: 'proxied', publishedPort: 25565 }, ctx()), (e: any) => e.code === 'port_not_applicable');
  });
  await t.test('direct_port needs a valid, non-reserved port', () => {
    assert.deepEqual(pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx()), { exposureMode: 'no_ssl', publishedPort: 25565 });
    assert.throws(() => pe.validateExposureChange({ mode: 'direct_port' }, ctx()), (e: any) => e.code === 'port_required');
    for (const bad of [0, 80, 1023, 65536, 3000.5, -1]) {
      assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: bad }, ctx()), (e: any) => e instanceof pe.PortError, String(bad));
    }
    for (const r of [2375, 2377, 4789, 7946, 5000]) {
      assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: r }, ctx()), (e: any) => e.code === 'port_reserved', String(r));
    }
  });
  await t.test('refuses a port another deployment on the node holds, but not one that failed/was deleted, and not its own', () => {
    const holder = dep({ id: 'd2', subdomain: 'game', exposureMode: 'no_ssl', publishedPort: 25565 });
    assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx({ siblings: [holder] })), (e: any) => e.code === 'port_in_use' && e.status === 409 && /game/.test(e.message));
    assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx({ siblings: [{ ...holder, status: 'stopped' }] })), (e: any) => e.code === 'port_in_use', 'a stopped container still conflicts when restarted');
    assert.doesNotThrow(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx({ siblings: [{ ...holder, status: 'failed' }] })));
    assert.doesNotThrow(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx({ siblings: [{ ...holder, status: 'deleted' }] })));
    assert.doesNotThrow(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 25565 }, ctx({ deployment: holder, siblings: [holder] })), 'keeping its own port is fine');
  });
  await t.test('an implicit (internal-port fallback) holder counts', () => {
    const bot = dep({ id: 'bot', exposureMode: 'no_ssl', publishedPort: null, internalPort: 3000 });
    assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 3000 }, ctx({ siblings: [bot] })), (e: any) => e.code === 'port_in_use');
  });
  await t.test('refuses a port claimed by a node port exposure', () => {
    assert.throws(() => pe.validateExposureChange({ mode: 'direct_port', publishedPort: 9000 }, ctx({ nodeExposures: [exp()] })), (e: any) => e.code === 'port_claimed' && /myport/.test(e.message));
  });
});

test('buildOverview', async (t) => {
  const node: pe.NodeRow = { id: 'n1', label: 'node-1', ip: '1.2.3.4', isActive: true };
  const snap = (deployments: pe.DeploymentPortRow[], exposures: pe.NodeExposureRow[] = []): pe.OverviewSnapshot => ({ nodes: [node], deployments, exposures, rootDomain: 'shanutechx.com', reserved });
  const issuesOf = (o: ReturnType<typeof pe.buildOverview>) => o.nodes[0].issues.map((i) => i.code).sort();

  await t.test('lists deployments with mode, host port and URL; proxied ones get a URL, direct ones a host port', () => {
    const o = pe.buildOverview(snap([dep(), dep({ id: 'd2', subdomain: null, exposureMode: 'no_ssl', publishedPort: 25565 }), dep({ id: 'd3', exposureMode: 'internal_only' }), dep({ id: 'gone', status: 'deleted' })]));
    const rows = o.nodes[0].deployments;
    assert.equal(rows.length, 3, 'deleted deployments are not listed');
    assert.deepEqual(rows.map((r) => [r.mode, r.hostPort, r.url]), [['proxied', null, 'https://app1.shanutechx.com'], ['direct_port', 25565, null], ['internal', null, null]]);
    assert.equal(o.summary.directPorts, 1);
    assert.equal(o.summary.errors, 0);
  });

  await t.test('flags two direct deployments on one host port (the Discord-bot case: both fall back to 3000)', () => {
    const bots = [dep({ id: 'b1', subdomain: null, exposureMode: 'no_ssl' }), dep({ id: 'b2', subdomain: null, exposureMode: 'no_ssl' })];
    const o = pe.buildOverview(snap(bots));
    assert.deepEqual(issuesOf(o), ['implicit_port', 'implicit_port', 'port_conflict', 'port_conflict']);
    assert.equal(o.summary.errors, 2);
    assert.match(o.nodes[0].deployments[0].issues.find((i) => i.code === 'port_conflict')!.message, /Only one can start/);
  });

  await t.test('a failed or deleted holder is not a conflict', () => {
    const o = pe.buildOverview(snap([dep({ id: 'a', exposureMode: 'no_ssl', publishedPort: 25565 }), dep({ id: 'b', exposureMode: 'no_ssl', publishedPort: 25565, status: 'failed' })]));
    assert.ok(!issuesOf(o).includes('port_conflict'));
  });

  await t.test('flags reserved host ports and ports claimed by node exposures', () => {
    const o = pe.buildOverview(snap([dep({ id: 'a', exposureMode: 'no_ssl', publishedPort: 2377 }), dep({ id: 'b', exposureMode: 'no_ssl', publishedPort: 9000 })], [exp()]));
    assert.ok(issuesOf(o).includes('reserved_port'));
    assert.ok(issuesOf(o).includes('port_claimed'));
  });

  await t.test('legacy raw_tcp rows are called out', () => {
    const o = pe.buildOverview(snap([dep({ exposureMode: 'raw_tcp', publishedPort: 4000 })]));
    assert.deepEqual(issuesOf(o), ['legacy_mode']);
  });

  await t.test('node exposures: always reported as DNS-only, and the dangerous DNS collisions are errors', () => {
    const o = pe.buildOverview(snap([dep({ subdomain: 'shop' })], [exp({ id: 'e1', subdomain: 'shop' }), exp({ id: 'e2', port: 9001, subdomain: 'api' }), exp({ id: 'e3', port: 9002, subdomain: 'ok', cfDnsRecordId: null })]));
    const [e1, e2, e3] = o.nodes[0].exposures;
    assert.ok([e1, e2, e3].every((e) => e.routed === false && /DNS record only/.test(e.note)));
    assert.deepEqual(e1.issues.map((i) => i.code), ['subdomain_collision']);
    assert.deepEqual(e2.issues.map((i) => i.code), ['reserved_subdomain']);
    assert.deepEqual(e3.issues.map((i) => i.code), ['no_dns_record']);
    assert.equal(o.summary.errors, 2);
    assert.equal(e1.domain, 'shop.shanutechx.com');
  });
});

test('assertHostPortAvailable input validation', async (t) => {
  await t.test('rejects out of range and non-integer ports', async () => {
    for (const bad of [0, 80, 1023, 65536, 8080.5, -5]) {
      await assert.rejects(
        () => pe.assertHostPortAvailable('node1', bad, 4001),
        (err: any) => err instanceof pe.PortError && err.code === 'port_out_of_range'
      );
    }
  });

  await t.test('rejects infrastructure reserved ports and agent port', async () => {
    for (const r of [2375, 2376, 2377, 4001]) {
      await assert.rejects(
        () => pe.assertHostPortAvailable('node1', r, 4001),
        (err: any) => err instanceof pe.PortError && err.code === 'port_reserved'
      );
    }
  });
});
