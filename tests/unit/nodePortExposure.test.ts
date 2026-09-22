import test from 'node:test';
import assert from 'node:assert/strict';

const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db', FIREBASE_PROJECT_ID: 'x', FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32), CLOUDFLARE_API_TOKEN: 'x'.repeat(20), CLOUDFLARE_ZONE_ID: 'x'.repeat(20), ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32), SMS_WEBHOOK_SECRET: 'x'.repeat(32), DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32), BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

type Row = import('../../apps/api/src/lib/portExposure').NodeExposureRow;

async function world(opts: { deploymentSubdomains?: string[] } = {}) {
  const lib = await import('../../apps/api/src/lib/nodePortExposure');
  const { reservedPorts } = await import('../../apps/api/src/lib/portExposure');
  const records = new Map<string, { name: string; ip: string }>(); // the "Cloudflare zone"
  const rows = new Map<string, Row>();
  const audits: string[] = [];
  const nodes: Record<string, { id: string; label: string; ip: string }> = { n1: { id: 'n1', label: 'Node 1', ip: '1.1.1.1' }, n2: { id: 'n2', label: 'Node 2', ip: '2.2.2.2' } };
  let rec = 0;
  let seq = 0;
  const sw = { dnsCreateFails: false, dnsDeleteFails: false, dbUpsertFails: false, dbMoveFails: false };
  const deps: import('../../apps/api/src/lib/nodePortExposure').ExposureDeps = {
    reserved: reservedPorts(5000),
    dns: {
      async create(name, ip) { if (sw.dnsCreateFails) throw new Error('cf down'); const id = `rec${++rec}`; records.set(id, { name, ip }); return { recordId: id }; },
      async deleteById(id) { if (sw.dnsDeleteFails) throw new Error('cf down'); records.delete(id); },
      async deleteByNameAndIp(name, ip) { let n = 0; for (const [id, r] of records) if (r.name === name && r.ip === ip) { records.delete(id); n++; } return n; },
    },
    store: {
      getNode: async (id) => nodes[id] ?? null,
      liveDeploymentSubdomains: async () => new Set(opts.deploymentSubdomains ?? []),
      getBySubdomain: async (s) => [...rows.values()].find((r) => r.subdomain === s) ?? null,
      getByNodePort: async (n, p) => [...rows.values()].find((r) => r.nodeId === n && r.port === p) ?? null,
      getById: async (id) => rows.get(id) ?? null,
      async upsert(r) {
        if (sw.dbUpsertFails) throw new Error('db down');
        const cur = [...rows.values()].find((x) => x.nodeId === r.nodeId && x.port === r.port);
        const row: Row = { id: cur?.id ?? `e${++seq}`, ...r };
        rows.set(row.id, row);
        return row;
      },
      async moveToNode(id, nodeId, cfId) { if (sw.dbMoveFails) throw new Error('db down'); Object.assign(rows.get(id)!, { nodeId, cfDnsRecordId: cfId }); },
      async remove(id) { rows.delete(id); },
      async audit(a, t) { audits.push(`${a} ${t}`); },
    },
  };
  return { lib, deps, records, rows, audits, sw, nodes };
}

test('exposeNodePort', async (t) => {
  await t.test('creates one DNS record + one row, defaults the hostname from the node label, audits', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http' }, 'admin1', w.deps);
    assert.equal(exposure.subdomain, 'node1-port-9000');
    assert.equal(w.records.size, 1);
    assert.equal(exposure.cfDnsRecordId, [...w.records.keys()][0]);
    assert.ok(w.audits.some((a) => a.startsWith('node.port_exposure.created')));
  });

  await t.test('refuses reserved hostnames and names a deployment already owns (the DNS-takeover / round-robin footgun)', async () => {
    const w = await world({ deploymentSubdomains: ['shop'] });
    await assert.rejects(w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'api' }, null, w.deps), (e: any) => e.code === 'reserved_subdomain');
    await assert.rejects(w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'SHOP' }, null, w.deps), (e: any) => e.code === 'subdomain_in_use' && e.status === 409);
    assert.equal(w.records.size, 0, 'nothing was created in DNS');
  });

  await t.test('refuses a hostname used by another exposure, and reserved / out-of-range ports', async () => {
    const w = await world();
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'one' }, null, w.deps);
    await assert.rejects(w.lib.exposeNodePort('n1', { port: 9001, protocol: 'http', subdomain: 'one' }, null, w.deps), (e: any) => e.code === 'subdomain_in_use');
    for (const p of [22, 2375, 5000]) await assert.rejects(w.lib.exposeNodePort('n1', { port: p, protocol: 'tcp' }, null, w.deps), (e: any) => e.code === 'port_reserved', String(p));
    for (const p of [0, 70000, 1.5]) await assert.rejects(w.lib.exposeNodePort('n1', { port: p, protocol: 'tcp' }, null, w.deps), (e: any) => e.code === 'port_out_of_range', String(p));
    await assert.rejects(w.lib.exposeNodePort('nope', { port: 9000, protocol: 'http' }, null, w.deps), (e: any) => e.status === 404);
  });

  await t.test('a DNS failure stores nothing (before: swallowed, and a phantom exposure was saved)', async () => {
    const w = await world();
    w.sw.dnsCreateFails = true;
    await assert.rejects(w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http' }, null, w.deps), (e: any) => e.code === 'dns_failed' && e.status === 502);
    assert.equal(w.rows.size, 0);
  });

  await t.test('a database failure removes the DNS record it just created', async () => {
    const w = await world();
    w.sw.dbUpsertFails = true;
    await assert.rejects(w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http' }, null, w.deps), /db down/);
    assert.equal(w.records.size, 0, 'no orphaned record');
  });

  await t.test('re-saving with the same hostname reuses the record (before: a duplicate record every time)', async () => {
    const w = await world();
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'one' }, null, w.deps);
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'https', subdomain: 'one', label: 'renamed' }, null, w.deps);
    assert.equal(w.records.size, 1);
    assert.equal([...w.rows.values()][0].protocol, 'https');
  });

  await t.test('renaming replaces the DNS record instead of leaking the old one', async () => {
    const w = await world();
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'one' }, null, w.deps);
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'two' }, null, w.deps);
    assert.equal(w.records.size, 1);
    assert.equal([...w.records.values()][0].name, 'two');
  });

  await t.test('a failure deleting the old record is reported as a warning, not swallowed', async () => {
    const w = await world();
    await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'one' }, null, w.deps);
    w.sw.dnsDeleteFails = true;
    const { warnings } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'two' }, null, w.deps);
    assert.match(warnings[0], /"one".*remove it manually/);
  });
});

test('closeNodePort', async (t) => {
  await t.test('deletes the exposure\'s own record by id and leaves an unrelated record with the same name alone', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'shared' }, null, w.deps);
    w.records.set('customer-rec', { name: 'shared', ip: '9.9.9.9' }); // someone else's record, same hostname
    const r = await w.lib.closeNodePort('n1', exposure.id, 'admin1', w.deps);
    assert.equal(r.dnsRecordDeleted, true);
    assert.ok(w.records.has('customer-rec'), 'the other record survives (the old delete-by-name removed it)');
    assert.equal(w.rows.size, 0);
    assert.ok(w.audits.some((a) => a.startsWith('node.port_exposure.closed')));
  });

  await t.test('a failed DNS delete keeps the row so the close can be retried', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http' }, null, w.deps);
    w.sw.dnsDeleteFails = true;
    await assert.rejects(w.lib.closeNodePort('n1', exposure.id, null, w.deps), (e: any) => e.code === 'dns_failed');
    assert.equal(w.rows.size, 1);
    w.sw.dnsDeleteFails = false;
    await w.lib.closeNodePort('n1', exposure.id, null, w.deps);
    assert.equal(w.rows.size, 0);
  });

  await t.test('legacy row with no record id: only records pointing at this node are deleted', async () => {
    const w = await world();
    w.rows.set('old', { id: 'old', nodeId: 'n1', port: 9000, protocol: 'http', subdomain: 'legacy', cfDnsRecordId: null, label: null });
    w.records.set('mine', { name: 'legacy', ip: '1.1.1.1' });
    w.records.set('theirs', { name: 'legacy', ip: '9.9.9.9' });
    const r = await w.lib.closeNodePort('n1', 'old', null, w.deps);
    assert.equal(r.dnsRecordDeleted, true);
    assert.ok(!w.records.has('mine') && w.records.has('theirs'));
  });

  await t.test('legacy row named like a deployment or a platform host: DNS is left untouched and the response says why', async () => {
    const w = await world({ deploymentSubdomains: ['shop'] });
    w.rows.set('a', { id: 'a', nodeId: 'n1', port: 9000, protocol: 'http', subdomain: 'shop', cfDnsRecordId: null, label: null });
    w.rows.set('b', { id: 'b', nodeId: 'n1', port: 9001, protocol: 'http', subdomain: 'api', cfDnsRecordId: null, label: null });
    w.records.set('shop-rec', { name: 'shop', ip: '1.1.1.1' });
    w.records.set('api-rec', { name: 'api', ip: '1.1.1.1' });
    for (const id of ['a', 'b']) {
      const r = await w.lib.closeNodePort('n1', id, null, w.deps);
      assert.equal(r.dnsRecordDeleted, false);
      assert.match(r.dnsSkippedReason!, /left untouched/);
    }
    assert.equal(w.records.size, 2, 'the customer\'s and the platform\'s DNS records are intact');
    assert.equal(w.rows.size, 0, 'the exposure itself is still closed');
  });

  await t.test('404 for an exposure that is not on that node', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http' }, null, w.deps);
    await assert.rejects(w.lib.closeNodePort('n2', exposure.id, null, w.deps), (e: any) => e.status === 404);
  });
});

test('moveExposureToNode (failover)', async (t) => {
  await t.test('creates the new record, repoints the row and DELETES the dead node\'s record', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'svc' }, null, w.deps);
    const ok = await w.lib.moveExposureToNode(exposure, w.nodes.n2, w.deps);
    assert.equal(ok, true);
    assert.deepEqual([...w.records.values()], [{ name: 'svc', ip: '2.2.2.2' }], 'exactly one record, on the new node (before: both, so DNS round-robined to the dead node)');
    const row = [...w.rows.values()][0];
    assert.equal(row.nodeId, 'n2');
    assert.equal(row.cfDnsRecordId, [...w.records.keys()][0]);
  });

  await t.test('if DNS cannot be updated nothing changes (before: the row was moved anyway)', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'svc' }, null, w.deps);
    w.sw.dnsCreateFails = true;
    assert.equal(await w.lib.moveExposureToNode(exposure, w.nodes.n2, w.deps), false);
    assert.equal([...w.rows.values()][0].nodeId, 'n1');
  });

  await t.test('if saving the move fails, the new record is removed', async () => {
    const w = await world();
    const { exposure } = await w.lib.exposeNodePort('n1', { port: 9000, protocol: 'http', subdomain: 'svc' }, null, w.deps);
    w.sw.dbMoveFails = true;
    assert.equal(await w.lib.moveExposureToNode(exposure, w.nodes.n2, w.deps), false);
    assert.deepEqual([...w.records.values()], [{ name: 'svc', ip: '1.1.1.1' }]);
  });
});
