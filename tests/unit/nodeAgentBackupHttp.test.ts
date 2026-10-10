import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Boots the REAL node agent and drives the backup routes over HTTP. The unit tests in nodeAgentBackup.test.ts call
 * the module directly; this exists because an HTTP-only bug (swallowed error responses after the upload body was
 * consumed, which hung callers forever) is invisible to them. Every request has a hard timeout so a regression
 * fails in seconds instead of hanging the suite.
 */

const SECRET = 'x'.repeat(32);
const DEP = 'cdep0000000001';
const BID = 'cbak0000000001';
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

async function craft(entries: Array<{ path: string; data: string }>): Promise<Buffer> {
  const tar: any = (await import('tar')).default ?? (await import('tar'));
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const header = Buffer.alloc(512);
    const data = Buffer.from(e.data);
    new tar.Header({ path: e.path, type: 'File', mode: 0o644, size: data.length, mtime: new Date() }).encode(header, 0);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

test('node agent backup routes (real HTTP)', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-http-'));
  const ws = path.join(root, 'workspaces', DEP);
  const vol = path.join(root, 'volumes', DEP, 'data');
  fs.mkdirSync(ws, { recursive: true });
  fs.mkdirSync(vol, { recursive: true });
  fs.writeFileSync(path.join(ws, 'app.txt'), 'original');
  fs.writeFileSync(path.join(vol, 'db.bin'), 'dbdata');

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let logs = '';
  const child: ChildProcess = spawn(process.execPath, [path.resolve('services/node-agent/src/index.js')], {
    env: {
      ...process.env,
      NODE_AGENT_SECRET: SECRET,
      AGENT_PORT: String(port),
      AGENT_BIND_HOST: '127.0.0.1',
      AGENT_WORKSPACES_DIR: path.join(root, 'workspaces'),
      AGENT_VOLUMES_DIR: path.join(root, 'volumes'),
      AGENT_BACKUPS_DIR: path.join(root, 'backups'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => (logs = (logs + d).slice(-4000)));
  child.stderr?.on('data', (d) => (logs = (logs + d).slice(-4000)));
  t.after(() => {
    try { child.kill(); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  const call = (p: string, init: RequestInit = {}, auth = true) =>
    fetch(base + p, {
      ...init,
      headers: { ...(auth ? { 'x-agent-secret': SECRET } : {}), ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(10_000),
    });

  // Wait for readiness.
  let ready = false;
  for (let i = 0; i < 75 && !ready; i++) {
    try {
      ready = (await call('/agent/backups/capabilities')).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(ready, `agent did not start. Logs:\n${logs}`);

  await t.test('requires the shared secret', async () => {
    assert.equal((await call('/agent/backups/capabilities', {}, false)).status, 401);
    assert.deepEqual(await (await call('/agent/backups/capabilities')).json(), { backups: 1, restore: 1 });
  });

  let wsComp: { sizeBytes: number; sha256: string };
  let wsBytes: Buffer;
  await t.test('creates a backup and serves the archive with the recorded size and checksum', async () => {
    const res = await call(`/agent/deployments/${DEP}/backup/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ backupId: BID, volumes: [{ name: 'data', hostPath: vol }] }),
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.deepEqual(body.components.map((c: any) => c.file).sort(), ['volume-data.tar.gz', 'workspace.tar.gz']);
    wsComp = body.components.find((c: any) => c.kind === 'workspace');

    const dl = await call(`/agent/backups/${BID}/files/workspace.tar.gz`);
    assert.equal(dl.status, 200);
    assert.equal(dl.headers.get('content-length'), String(wsComp.sizeBytes));
    wsBytes = Buffer.from(await dl.arrayBuffer());
    assert.equal(sha(wsBytes), wsComp.sha256);
  });

  const restore = (query: string, body: Buffer) =>
    call(`/agent/deployments/${DEP}/backup/restore?${query}`, { method: 'POST', headers: { 'content-type': 'application/gzip' }, body });

  await t.test('REGRESSION: a checksum mismatch returns 422 (does not hang) and changes nothing', async () => {
    fs.writeFileSync(path.join(ws, 'app.txt'), 'CORRUPT');
    const res = await restore(`kind=workspace&sha256=${'a'.repeat(64)}`, wsBytes);
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as any).code, 'checksum_mismatch');
    assert.equal(fs.readFileSync(path.join(ws, 'app.txt'), 'utf8'), 'CORRUPT', 'a rejected restore must not touch the workspace');
  });

  await t.test('REGRESSION: an archive rejected after upload returns 422 (does not hang)', async () => {
    const evil = await craft([{ path: '../escaped.txt', data: 'pwned' }]);
    const res = await restore(`kind=workspace&sha256=${sha(evil)}`, evil);
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as any).code, 'unsafe_archive');
    assert.ok(!fs.existsSync(path.join(root, 'workspaces', 'escaped.txt')));
    assert.equal(fs.readFileSync(path.join(ws, 'app.txt'), 'utf8'), 'CORRUPT');
  });

  await t.test('restores with the correct checksum', async () => {
    fs.writeFileSync(path.join(ws, 'extra.txt'), 'added later');
    const res = await restore(`kind=workspace&sha256=${wsComp.sha256}`, wsBytes);
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(fs.readFileSync(path.join(ws, 'app.txt'), 'utf8'), 'original');
    assert.ok(!fs.existsSync(path.join(ws, 'extra.txt')));
  });

  await t.test('refuses a volume path outside the volumes root, and bad ids / file names', async () => {
    const res = await restore(`kind=volume&name=data&hostPath=${encodeURIComponent('/etc')}&sha256=${wsComp.sha256}`, wsBytes);
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as any).code, 'volume_path_denied');
    const bad = await call(`/agent/deployments/${DEP}/backup/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backupId: '../../etc' }) });
    assert.equal(bad.status, 400);
    assert.equal((await call(`/agent/backups/${BID}/files/..%2F..%2Fetc%2Fpasswd`)).status, 400);
  });

  await t.test('DELETE removes the spool directory', async () => {
    assert.equal((await call(`/agent/backups/${BID}`, { method: 'DELETE' })).status, 200);
    assert.ok(!fs.existsSync(path.join(root, 'backups', BID)));
    assert.equal((await call(`/agent/backups/${BID}/files/workspace.tar.gz`)).status, 404);
  });
});
