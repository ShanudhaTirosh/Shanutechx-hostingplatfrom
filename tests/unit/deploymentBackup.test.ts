import test from 'node:test';
import assert from 'node:assert/strict';

const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  FIREBASE_PROJECT_ID: 'x',
  FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32),
  CLOUDFLARE_API_TOKEN: 'x'.repeat(20),
  CLOUDFLARE_ZONE_ID: 'x'.repeat(20),
  ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32),
  SMS_WEBHOOK_SECRET: 'x'.repeat(32),
  DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32),
  BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

type Lib = typeof import('../../apps/api/src/lib/deploymentBackup');
type Row = import('../../apps/api/src/lib/deploymentBackup').BackupRow;
type Policy = import('../../apps/api/src/lib/deploymentBackup').PolicyRow;

const DEP = 'cdep0000000001';
const NODE = { id: 'node1', ip: '10.0.0.5' };
const sha = (c: string) => c.repeat(64).slice(0, 64);

/** Everything the orchestrator touches, in memory, with switches for each way it can fail. */
async function world(overrides: { volumes?: { name: string; hostPath: string }[]; status?: string } = {}) {
  const lib: Lib = await import('../../apps/api/src/lib/deploymentBackup');
  const { AgentBackupError } = await import('../../apps/api/src/lib/nodeAgentClient');
  const { GithubApiError } = await import('../../apps/api/src/lib/githubBackup');

  const clock = { t: new Date('2026-09-20T00:00:00.000Z') };
  const rows = new Map<string, Row>();
  const policies = new Map<string, Policy>();
  const audits: string[] = [];
  const calls: string[] = [];
  let seq = 0;
  const dep = {
    id: DEP,
    userId: 'user1',
    subdomain: 'myapp',
    status: overrides.status ?? 'running',
    containerId: 'ctr1',
    sourceType: 'zip',
    node: NODE,
    volumes: overrides.volumes ?? [{ name: 'data', hostPath: `/var/lib/shanutechx/volumes/${DEP}/data` }],
  };
  const sw = {
    supports: true,
    configured: true,
    agentComponents: [
      { kind: 'workspace' as const, name: 'workspace', file: 'workspace.tar.gz', sizeBytes: 100, sha256: sha('a') },
      { kind: 'volume' as const, name: 'data', file: 'volume-data.tar.gz', sizeBytes: 200, sha256: sha('b') },
    ],
    agentCreateError: null as Error | null,
    uploadFailsOn: null as string | null,
    ghDeleteFails: false,
    restoreFailsOn: null as string | null,
    downloadSize: null as number | null,
    startFails: false,
  };

  const store: import('../../apps/api/src/lib/deploymentBackup').BackupStore = {
    async loadDeployment(id) {
      return id === DEP ? { ...dep, volumes: [...dep.volumes] } : null;
    },
    async createBackup(d) {
      const row: Row = {
        id: `cbak${String(++seq).padStart(10, '0')}`,
        deploymentId: d.deploymentId,
        trigger: d.trigger,
        status: 'in_progress',
        phase: 'Queued',
        repoFullName: null,
        releaseId: null,
        releaseTag: null,
        releaseUrl: null,
        components: null,
        sizeBytes: null,
        error: null,
        createdById: d.createdById,
        createdAt: new Date(clock.t.getTime() + seq), // strictly increasing => stable ordering
        completedAt: null,
        restoreStatus: null,
        restorePhase: null,
        restoreError: null,
        restoreStartedAt: null,
        restoredAt: null,
      };
      rows.set(row.id, row);
      return { ...row };
    },
    async updateBackup(id, data) {
      const r = rows.get(id);
      if (!r) throw new Error('no such row');
      Object.assign(r, data);
      return { ...r };
    },
    async getBackup(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async listBackups(deploymentId, limit) {
      return [...rows.values()].filter((r) => r.deploymentId === deploymentId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },
    async findActive(deploymentId, since, ignoreId) {
      return (
        [...rows.values()].find(
          (r) =>
            r.deploymentId === deploymentId &&
            r.id !== ignoreId &&
            ((r.status === 'in_progress' && r.createdAt > since) || (r.restoreStatus === 'in_progress' && r.restoreStartedAt !== null && r.restoreStartedAt > since))
        ) ?? null
      );
    },
    async listCompleted(deploymentId, trigger) {
      return [...rows.values()].filter((r) => r.deploymentId === deploymentId && r.trigger === trigger && r.status === 'completed').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listFailed(deploymentId) {
      return [...rows.values()].filter((r) => r.deploymentId === deploymentId && r.status === 'failed').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listBackupsOfDeletedDeployments(limit) {
      return dep.status === 'deleted' ? [...rows.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit) : [];
    },
    async deleteBackup(id) {
      rows.delete(id);
    },
    async reapStale(cutoff) {
      let n = 0;
      for (const r of rows.values()) {
        if (r.status === 'in_progress' && r.createdAt < cutoff) {
          r.status = 'failed';
          r.error = 'Interrupted';
          n++;
        }
        if (r.restoreStatus === 'in_progress' && r.restoreStartedAt && r.restoreStartedAt < cutoff) {
          r.restoreStatus = 'failed';
          n++;
        }
      }
      return n;
    },
    async getPolicy(id) {
      return policies.get(id) ?? null;
    },
    async upsertPolicy(id, data) {
      const cur: Policy = policies.get(id) ?? { deploymentId: id, enabled: false, intervalHours: 24, retention: 7, lastRunAt: null, nextRunAt: null, lastStatus: null, consecutiveFailures: 0 };
      const next = { ...cur, ...data } as Policy;
      policies.set(id, next);
      return { ...next };
    },
    async dueBackupPolicies(now, limit) {
      return [...policies.values()].filter((p) => p.enabled && p.nextRunAt && p.nextRunAt <= now).slice(0, limit);
    },
    async audit(action, target) {
      audits.push(`${action} ${target}`);
    },
  };

  let releaseSeq = 0;
  const releases = new Map<string, { tag: string; published: boolean; assets: string[] }>();
  const github = {
    fullName: 'acme/backups',
    async ensureRepo() {
      calls.push('gh.ensureRepo');
      return { repoFullName: 'acme/backups', exists: true, private: true, canPush: true, created: false };
    },
    async createDraftRelease(p: { tag: string; name: string; body: string }) {
      const id = String(++releaseSeq);
      releases.set(id, { tag: p.tag, published: false, assets: [] });
      calls.push(`gh.createDraft:${p.tag}`);
      return { id, tagName: p.tag, htmlUrl: `https://github.com/acme/backups/releases/tag/${p.tag}`, draft: true };
    },
    async uploadAsset(releaseId: string, name: string, body: unknown, size: number) {
      calls.push(`gh.upload:${name}`);
      if (sw.uploadFailsOn === name) throw new GithubApiError('GitHub error while uploading (502)', 502, 'server');
      releases.get(releaseId)!.assets.push(name);
      return { id: `asset-${releaseId}-${name}`, name, size };
    },
    async publishRelease(releaseId: string) {
      calls.push('gh.publish');
      const r = releases.get(releaseId)!;
      r.published = true;
      return { id: releaseId, tagName: r.tag, htmlUrl: `https://github.com/acme/backups/releases/tag/${r.tag}`, draft: false };
    },
    async deleteRelease(releaseId: string) {
      calls.push(`gh.deleteRelease:${releaseId}`);
      if (sw.ghDeleteFails) throw new GithubApiError('GitHub error while trying to delete backup release (502)', 502, 'server');
      releases.delete(releaseId);
    },
    async downloadAsset(assetId: string) {
      calls.push(`gh.download:${assetId}`);
      const comp = sw.agentComponents.find((c) => assetId.endsWith(c.kind === 'workspace' ? 'workspace.tar.gz' : `volume-${c.name}.tar.gz`))!;
      return { body: new Response(Buffer.alloc(4)).body as ReadableStream<Uint8Array>, size: sw.downloadSize ?? comp.sizeBytes };
    },
  };

  const agent: import('../../apps/api/src/lib/deploymentBackup').BackupAgentPort = {
    async supportsBackups() {
      return sw.supports;
    },
    async createBackup() {
      calls.push('agent.create');
      if (sw.agentCreateError) throw sw.agentCreateError;
      return { components: sw.agentComponents, skipped: [], warnings: [] };
    },
    async openFile(_n, _id, file) {
      calls.push(`agent.open:${file}`);
      const c = sw.agentComponents.find((x) => x.file === file)!;
      return { body: new Response(Buffer.alloc(4)).body as ReadableStream<Uint8Array>, size: c.sizeBytes };
    },
    async deleteBackup() {
      calls.push('agent.deleteSpool');
    },
    async restoreComponent(_n, _d, comp) {
      calls.push(`agent.restore:${comp.kind === 'workspace' ? 'workspace' : `volume:${comp.name}`}:${comp.hostPath ?? '-'}`);
      if (sw.restoreFailsOn === (comp.kind === 'workspace' ? 'workspace' : `volume:${comp.name}`)) {
        throw new AgentBackupError('Checksum mismatch: the downloaded archive is not the one that was backed up. Nothing was changed.', 422, 'checksum_mismatch');
      }
      return { warnings: [] };
    },
    async stop() {
      calls.push('agent.stop');
    },
    async start() {
      calls.push('agent.start');
      if (sw.startFails) throw new Error('start failed');
    },
  };

  const deps: import('../../apps/api/src/lib/deploymentBackup').BackupDeps = {
    store,
    agent,
    github: () => github as never,
    isConfigured: () => sw.configured,
    now: () => new Date(clock.t),
    maxComponentBytes: 1_000_000,
  };
  return { lib, deps, rows, policies, audits, calls, clock, sw, releases, dep, AgentBackupError, GithubApiError };
}

async function runBackup(w: Awaited<ReturnType<typeof world>>, trigger: 'manual' | 'schedule' | 'pre-restore' = 'manual') {
  const started = await w.lib.startBackup(DEP, { trigger, userId: 'user1' }, w.deps);
  return w.lib.executeBackup(started.id, w.deps);
}

test('backup', async (t) => {
  await t.test('happy path: uploads components + manifest, publishes, records everything, cleans the node spool', async () => {
    const w = await world();
    const { row, failure } = await runBackup(w);
    assert.equal(failure, undefined);
    assert.equal(row.status, 'completed');
    assert.equal(row.sizeBytes, 300);
    assert.equal(row.repoFullName, 'acme/backups');
    assert.match(row.releaseTag!, /^backup-cdep0000000001-\d{8}T\d{6}Z$/);
    assert.deepEqual(row.components!.map((c) => [c.kind, c.name, c.assetName, c.sha256.length]), [
      ['workspace', 'workspace', 'workspace.tar.gz', 64],
      ['volume', 'data', 'volume-data.tar.gz', 64],
    ]);
    const rel = [...w.releases.values()][0];
    assert.equal(rel.published, true);
    assert.deepEqual(rel.assets, ['workspace.tar.gz', 'volume-data.tar.gz', 'manifest.json']);
    assert.ok(w.calls.indexOf('gh.publish') > w.calls.indexOf('gh.upload:manifest.json'), 'published only after every asset is uploaded');
    assert.ok(w.calls.includes('agent.deleteSpool'));
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.completed')));
  });

  await t.test('an upload failing half-way deletes the draft release, marks the row failed, and still cleans the spool', async () => {
    const w = await world();
    w.sw.uploadFailsOn = 'volume-data.tar.gz';
    const { row, failure } = await runBackup(w);
    assert.equal(row.status, 'failed');
    assert.equal(failure!.code, 'github');
    assert.match(row.error!, /GitHub error/);
    assert.equal(w.releases.size, 0, 'the incomplete draft release must not be left behind');
    assert.ok(w.calls.some((c) => c.startsWith('gh.deleteRelease:')));
    assert.ok(!w.calls.includes('gh.publish'), 'a failed backup is never published');
    assert.ok(w.calls.includes('agent.deleteSpool'));
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.failed')));
  });

  await t.test('an agent that predates backups fails fast with a clear message and never touches GitHub', async () => {
    const w = await world();
    w.sw.supports = false;
    const { row, failure } = await runBackup(w);
    assert.equal(failure!.code, 'unsupported_agent');
    assert.match(row.error!, /Update the node agent/);
    assert.ok(!w.calls.some((c) => c.startsWith('gh.')), 'no GitHub calls');
    assert.ok(!w.calls.includes('agent.create'));
  });

  await t.test('"nothing to back up" and "too large" from the node surface as their own codes', async () => {
    const w = await world();
    w.sw.agentCreateError = new w.AgentBackupError('Nothing to back up', 422, 'nothing_to_backup');
    assert.equal((await runBackup(w)).failure!.code, 'nothing_to_backup');
    const w2 = await world();
    w2.sw.agentCreateError = new w2.AgentBackupError('Archive exceeds the 1 MB limit', 413, 'too_large');
    assert.equal((await runBackup(w2)).failure!.code, 'too_large');
  });

  await t.test('an unreachable node gives an actionable message, not "fetch failed"', async () => {
    const w = await world();
    const err = new TypeError('fetch failed') as TypeError & { cause?: unknown };
    err.cause = { code: 'ECONNREFUSED' };
    w.sw.agentCreateError = err;
    const { failure } = await runBackup(w);
    assert.equal(failure!.code, 'node_unreachable');
    assert.match(failure!.message, /ECONNREFUSED/);
    assert.match(failure!.message, /node is online/);
  });

  await t.test('refuses to start when GitHub backups are not configured, or the deployment does not exist', async () => {
    const w = await world();
    w.sw.configured = false;
    await assert.rejects(w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps), (e: any) => e.code === 'not_configured' && e.status === 503);
    w.sw.configured = true;
    await assert.rejects(w.lib.startBackup('cnope', { trigger: 'manual' }, w.deps), (e: any) => e.code === 'not_found' && e.status === 404);
  });

  await t.test('does not allow two at once (409), but a job stuck for over 2h no longer blocks', async () => {
    const w = await world();
    await w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps);
    await assert.rejects(w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps), (e: any) => e.code === 'conflict' && e.status === 409);
    w.clock.t = new Date(w.clock.t.getTime() + 3 * 3600_000);
    await w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps); // stale one is ignored
  });

  await t.test('public serialisation exposes sizes and status but never asset ids, checksums or release ids', async () => {
    const w = await world();
    const { row } = await runBackup(w);
    const json = JSON.stringify(w.lib.toPublicBackup(row));
    assert.ok(!json.includes('asset-'), 'no asset ids');
    assert.ok(!json.includes(sha('a')), 'no checksums');
    assert.ok(!/"releaseId"/.test(json));
    assert.match(json, /"status":"completed"/);
  });
});

test('restore', async (t) => {
  async function backedUp(w: Awaited<ReturnType<typeof world>>) {
    const { row } = await runBackup(w);
    w.calls.length = 0;
    return row;
  }
  const finish = async (w: Awaited<ReturnType<typeof world>>, backupId: string, comps?: string[], opts: { skipSafetyBackup?: boolean } = {}) => {
    const s = await w.lib.startRestore(DEP, backupId, { components: comps }, w.deps);
    return w.lib.executeRestore(backupId, s.selected, opts, w.deps);
  };

  await t.test('happy path: safety backup first, app stopped, node restores each component, app restarted', async () => {
    const w = await world();
    const b = await backedUp(w);
    const res = await finish(w, b.id);
    assert.equal(res.ok, true);
    assert.equal(res.needsRedeploy, true);
    const order = w.calls.filter((c) => c.startsWith('agent.') && c !== 'agent.deleteSpool' && c !== 'agent.create' && !c.startsWith('agent.open'));
    assert.deepEqual(order, ['agent.stop', `agent.restore:workspace:-`, `agent.restore:volume:data:/var/lib/shanutechx/volumes/${DEP}/data`, 'agent.start']);
    assert.ok(w.calls.indexOf('gh.publish') < w.calls.indexOf('agent.stop'), 'safety backup completes before the app is touched');
    const preRestore = [...w.rows.values()].filter((r) => r.trigger === 'pre-restore');
    assert.equal(preRestore.length, 1);
    assert.equal(preRestore[0].status, 'completed');
    const src = w.rows.get(b.id)!;
    assert.equal(src.restoreStatus, 'completed');
    assert.match(src.restorePhase!, /redeploy/i);
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.restored')));
  });

  await t.test('a failing safety backup cancels the restore before anything is stopped or overwritten', async () => {
    const w = await world();
    const b = await backedUp(w);
    w.sw.uploadFailsOn = 'workspace.tar.gz'; // makes the pre-restore backup fail
    const res = await finish(w, b.id);
    assert.equal(res.ok, false);
    assert.match(res.error!, /Restore cancelled.*nothing was changed/);
    assert.ok(!w.calls.includes('agent.stop'));
    assert.ok(!w.calls.some((c) => c.startsWith('agent.restore')));
    assert.equal(w.rows.get(b.id)!.restoreStatus, 'failed');
  });

  await t.test('"nothing to back up" is tolerated: restoring into a wiped workspace is the disaster-recovery case', async () => {
    const w = await world();
    const b = await backedUp(w);
    w.sw.agentCreateError = new w.AgentBackupError('Nothing to back up', 422, 'nothing_to_backup');
    const res = await finish(w, b.id);
    assert.equal(res.ok, true);
    assert.ok(res.warnings.some((x) => /No safety backup was taken/.test(x)));
    assert.ok(w.calls.some((c) => c.startsWith('agent.restore')));
  });

  await t.test('a failure part-way restarts the app, names what was already restored, and points at the safety backup', async () => {
    const w = await world();
    const b = await backedUp(w);
    w.sw.restoreFailsOn = 'volume:data';
    const res = await finish(w, b.id);
    assert.equal(res.ok, false);
    assert.match(res.error!, /Checksum mismatch/);
    assert.match(res.error!, /Already restored before the failure: workspace files/);
    assert.match(res.error!, /safety backup/);
    assert.equal(w.calls.at(-1), 'agent.start', 'the customer\'s app is brought back up, not left stopped');
    assert.equal(w.rows.get(b.id)!.restoreStatus, 'failed');
    assert.match(w.rows.get(b.id)!.restoreError!, /Checksum mismatch/);
  });

  await t.test('does not restart an app that was not running', async () => {
    const w = await world({ status: 'stopped' });
    const b = await backedUp(w);
    const res = await finish(w, b.id);
    assert.equal(res.ok, true);
    assert.ok(!w.calls.includes('agent.stop') && !w.calls.includes('agent.start'));
  });

  await t.test('refuses a GitHub archive whose size differs from what was recorded', async () => {
    const w = await world();
    const b = await backedUp(w);
    w.sw.downloadSize = 999;
    const res = await finish(w, b.id, undefined, { skipSafetyBackup: true });
    assert.equal(res.ok, false);
    assert.match(res.error!, /different size than recorded/);
    assert.ok(!w.calls.some((c) => c.startsWith('agent.restore')), 'nothing was sent to the node');
    assert.equal(w.calls.at(-1), 'agent.start');
  });

  await t.test('partial restore: only the selected component is restored, and no redeploy is needed for volumes', async () => {
    const w = await world();
    const b = await backedUp(w);
    const res = await finish(w, b.id, ['volume:data']);
    assert.equal(res.ok, true);
    assert.equal(res.needsRedeploy, false);
    assert.deepEqual(w.calls.filter((c) => c.startsWith('agent.restore')), [`agent.restore:volume:data:/var/lib/shanutechx/volumes/${DEP}/data`]);
  });

  await t.test('startRestore validation', async () => {
    const w = await world();
    const b = await backedUp(w);
    await assert.rejects(w.lib.startRestore(DEP, 'cbak_missing', {}, w.deps), (e: any) => e.status === 404);
    await assert.rejects(w.lib.startRestore(DEP, b.id, { components: ['volume:nope'] }, w.deps), (e: any) => e.status === 400 && /does not contain/.test(e.message));
    const failed = await (async () => {
      w.sw.uploadFailsOn = 'workspace.tar.gz';
      return (await runBackup(w)).row;
    })();
    await assert.rejects(w.lib.startRestore(DEP, failed.id, {}, w.deps), (e: any) => e.status === 409 && /completed backups/.test(e.message));
    const noVol = await world({ volumes: [] });
    const b2 = await (async () => { const r = await runBackup(noVol); return r.row; })();
    await assert.rejects(noVol.lib.startRestore(DEP, b2.id, {}, noVol.deps), (e: any) => e.status === 409 && /no longer exists/.test(e.message));
  });

  await t.test('cannot start a second restore or a backup while one is running', async () => {
    const w = await world();
    const b = await backedUp(w);
    await w.lib.startRestore(DEP, b.id, {}, w.deps);
    await assert.rejects(w.lib.startRestore(DEP, b.id, {}, w.deps), (e: any) => e.code === 'conflict');
    await assert.rejects(w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps), (e: any) => e.code === 'conflict' && /restore is running/.test(e.message));
  });
});

test('retention, deletion and stale reaping', async (t) => {
  await t.test('keeps the newest N scheduled backups, deletes the rest from GitHub, never touches manual ones', async () => {
    const w = await world();
    await w.deps.store.upsertPolicy(DEP, { enabled: true, retention: 2, intervalHours: 24 });
    const manual = (await runBackup(w, 'manual')).row;
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await runBackup(w, 'schedule')).row.id);
    const remaining = [...w.rows.values()].filter((r) => r.trigger === 'schedule').map((r) => r.id).sort();
    assert.deepEqual(remaining, ids.slice(2).sort(), 'the two newest scheduled backups remain');
    assert.ok(w.rows.has(manual.id), 'manual backups are never auto-deleted');
    assert.equal([...w.releases.values()].length, 3, 'GitHub releases were deleted for the pruned ones');
  });

  await t.test('keeps only the latest 3 pre-restore snapshots', async () => {
    const w = await world();
    for (let i = 0; i < 5; i++) await runBackup(w, 'pre-restore');
    assert.equal([...w.rows.values()].filter((r) => r.trigger === 'pre-restore').length, 3);
  });

  await t.test('if GitHub deletion fails the DB row is kept so the delete can be retried', async () => {
    const w = await world();
    const { row } = await runBackup(w);
    w.sw.ghDeleteFails = true;
    await assert.rejects(w.lib.deleteBackup(DEP, row.id, w.deps, { adminId: null, role: 'customer' }), (e: any) => e.code === 'github');
    assert.ok(w.rows.has(row.id));
    w.sw.ghDeleteFails = false;
    await w.lib.deleteBackup(DEP, row.id, w.deps, { adminId: null, role: 'customer' });
    assert.ok(!w.rows.has(row.id));
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.deleted')));
  });

  await t.test('cannot delete a backup that is being restored right now, or one from another deployment', async () => {
    const w = await world();
    const { row } = await runBackup(w);
    await w.lib.startRestore(DEP, row.id, {}, w.deps);
    await assert.rejects(w.lib.deleteBackup(DEP, row.id, w.deps, { adminId: null, role: null }), (e: any) => e.code === 'conflict');
    await assert.rejects(w.lib.deleteBackup('cother', row.id, w.deps, { adminId: null, role: null }), (e: any) => e.status === 404);
  });

  await t.test('runDueBackups reaps jobs stuck for over 2h', async () => {
    const w = await world();
    const started = await w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps);
    w.clock.t = new Date(w.clock.t.getTime() + 3 * 3600_000);
    await w.lib.runDueBackups(w.deps);
    assert.equal(w.rows.get(started.id)!.status, 'failed');
  });
});

test('policy and scheduler', async (t) => {
  const actor = { adminId: null, role: 'customer' };

  await t.test('validates interval and retention', async () => {
    const w = await world();
    for (const bad of [{ intervalHours: 0, retention: 7 }, { intervalHours: 169, retention: 7 }, { intervalHours: 24, retention: 0 }, { intervalHours: 24, retention: 31 }, { intervalHours: 1.5, retention: 7 }, { intervalHours: 'x', retention: 7 }]) {
      await assert.rejects(w.lib.setBackupPolicy(DEP, { enabled: true, ...bad }, w.deps, actor), (e: any) => e.status === 400, JSON.stringify(bad));
    }
  });

  await t.test('enabling schedules the first run for the next sweep; disabling clears it; unchanged re-save keeps the schedule', async () => {
    const w = await world();
    const on = await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 12, retention: 5 }, w.deps, actor);
    assert.deepEqual(on.nextRunAt, w.clock.t);
    const later = new Date(w.clock.t.getTime() + 3600_000);
    await w.deps.store.upsertPolicy(DEP, { nextRunAt: later });
    const same = await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 12, retention: 9 }, w.deps, actor);
    assert.deepEqual(same.nextRunAt, later, 'changing only retention does not reschedule');
    const off = await w.lib.setBackupPolicy(DEP, { enabled: false, intervalHours: 12, retention: 9 }, w.deps, actor);
    assert.equal(off.nextRunAt, null);
    await assert.rejects(w.lib.setBackupPolicy('cnope', { enabled: true, intervalHours: 1, retention: 1 }, w.deps, actor), (e: any) => e.status === 404);
  });

  await t.test('a due policy runs, records success, and schedules the next run one interval later', async () => {
    const w = await world();
    await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 6, retention: 3 }, w.deps, actor);
    const r = await w.lib.runDueBackups(w.deps);
    assert.deepEqual(r, { ran: 1, failed: 0 });
    const p = w.policies.get(DEP)!;
    assert.equal(p.lastStatus, 'completed');
    assert.equal(p.consecutiveFailures, 0);
    assert.equal(p.nextRunAt!.getTime(), w.clock.t.getTime() + 6 * 3600_000);
    assert.equal([...w.rows.values()].find((x) => x.trigger === 'schedule')!.status, 'completed');
    assert.deepEqual(await w.lib.runDueBackups(w.deps), { ran: 0, failed: 0 }, 'not due again until the interval passes');
  });

  await t.test('failures back off 1h, 2h, 4h... and the policy auto-disables after 5 in a row, with an audit entry', async () => {
    const w = await world();
    await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 24, retention: 3 }, w.deps, actor);
    w.sw.uploadFailsOn = 'workspace.tar.gz';
    const expectHours = [1, 2, 4, 8];
    for (let i = 0; i < 4; i++) {
      await w.lib.runDueBackups(w.deps);
      const p = w.policies.get(DEP)!;
      assert.equal(p.consecutiveFailures, i + 1);
      assert.equal(p.enabled, true);
      assert.equal(p.nextRunAt!.getTime() - w.clock.t.getTime(), expectHours[i] * 3600_000);
      w.clock.t = new Date(p.nextRunAt!);
    }
    await w.lib.runDueBackups(w.deps);
    const p = w.policies.get(DEP)!;
    assert.equal(p.enabled, false);
    assert.equal(p.nextRunAt, null);
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.policy_disabled')));
  });

  await t.test('a conflict (something already running) is retried in 30 minutes and is not counted as a failure', async () => {
    const w = await world();
    await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 24, retention: 3 }, w.deps, actor);
    await w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps); // occupies the deployment
    const r = await w.lib.runDueBackups(w.deps);
    assert.deepEqual(r, { ran: 0, failed: 0 });
    const p = w.policies.get(DEP)!;
    assert.equal(p.consecutiveFailures, 0);
    assert.equal(p.nextRunAt!.getTime(), w.clock.t.getTime() + 30 * 60_000);
  });

  await t.test('does nothing when backups are not configured', async () => {
    const w = await world();
    await w.lib.setBackupPolicy(DEP, { enabled: true, intervalHours: 24, retention: 3 }, w.deps, actor);
    w.sw.configured = false;
    assert.deepEqual(await w.lib.runDueBackups(w.deps), { ran: 0, failed: 0 });
    assert.ok(!w.calls.some((c) => c.startsWith('gh.')));
  });
});

test('purge for deleted deployments', async (t) => {
  await t.test('removes every backup (GitHub release + record) of a deleted deployment, including failed ones', async () => {
    const w = await world();
    await runBackup(w, 'manual');
    await runBackup(w, 'schedule');
    w.sw.uploadFailsOn = 'workspace.tar.gz';
    await runBackup(w, 'manual'); // a failed record
    w.sw.uploadFailsOn = null;
    assert.equal(w.releases.size, 2);
    w.dep.status = 'deleted';
    const r = await w.lib.purgeDeletedDeploymentBackups(w.deps, { deploymentId: DEP });
    assert.deepEqual(r, { purged: 3, failed: 0, skipped: 0 });
    assert.equal(w.rows.size, 0);
    assert.equal(w.releases.size, 0, 'nothing is left in GitHub');
    assert.ok(w.audits.some((a) => a.startsWith('deployment.backup.purged')));
  });

  await t.test('a GitHub failure keeps the record so the sweep can retry, and the retry then succeeds', async () => {
    const w = await world();
    await runBackup(w, 'manual');
    w.dep.status = 'deleted';
    w.sw.ghDeleteFails = true;
    assert.deepEqual(await w.lib.purgeDeletedDeploymentBackups(w.deps, { deploymentId: DEP }), { purged: 0, failed: 1, skipped: 0 });
    assert.equal(w.rows.size, 1, 'record kept: it is the only pointer to the release');
    w.sw.ghDeleteFails = false;
    await w.lib.runDueBackups(w.deps); // the periodic sweep
    assert.equal(w.rows.size, 0);
    assert.equal(w.releases.size, 0);
  });

  await t.test('a backup still running when the deployment was deleted is skipped, then purged once it has finished', async () => {
    const w = await world();
    const started = await w.lib.startBackup(DEP, { trigger: 'manual' }, w.deps);
    w.dep.status = 'deleted';
    assert.deepEqual(await w.lib.purgeDeletedDeploymentBackups(w.deps, { deploymentId: DEP }), { purged: 0, failed: 0, skipped: 1 });
    await w.lib.executeBackup(started.id, w.deps); // finishes after the delete (the race)
    assert.equal(w.releases.size, 1, 'it published a release for a deleted deployment');
    await w.lib.runDueBackups(w.deps);
    assert.equal(w.rows.size, 0);
    assert.equal(w.releases.size, 0, 'the sweep cleaned it up');
  });

  await t.test('the sweep never touches backups of live deployments, and does nothing when backups are not configured', async () => {
    const w = await world();
    await runBackup(w, 'manual');
    await w.lib.runDueBackups(w.deps);
    assert.equal(w.rows.size, 1);
    w.dep.status = 'deleted';
    w.sw.configured = false;
    await w.lib.runDueBackups(w.deps);
    assert.equal(w.rows.size, 1, 'without a token it does not turn into a stream of failures');
  });
});
