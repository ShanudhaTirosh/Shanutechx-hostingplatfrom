import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

// The agent module reads its directories from env at load time, so point them at a sandbox first.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-backup-test-'));
process.env.AGENT_WORKSPACES_DIR = path.join(ROOT, 'workspaces');
process.env.AGENT_VOLUMES_DIR = path.join(ROOT, 'volumes');
process.env.AGENT_BACKUPS_DIR = path.join(ROOT, 'backups');

const DEP = 'cdep0000000001';
const BID = 'cbak0000000001';

async function loadBackup() {
  const mod: any = await import('../../services/node-agent/src/backup.js');
  return mod.default ?? mod;
}
async function loadTar() {
  const mod: any = await import('tar');
  return mod.default ?? mod;
}

function write(p: string, content: string | Buffer) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/** Hand-builds a .tar.gz so we can include entries a well-behaved tar would never emit. */
async function craftArchive(entries: Array<{ path: string; type?: string; linkpath?: string; data?: string }>): Promise<{ buf: Buffer; sha256: string }> {
  const tar = await loadTar();
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const data = Buffer.from(e.data ?? '');
    const header = Buffer.alloc(512);
    new tar.Header({
      path: e.path,
      type: e.type ?? 'File',
      linkpath: e.linkpath,
      mode: 0o644,
      size: e.type && e.type !== 'File' ? 0 : data.length,
      mtime: new Date(),
    }).encode(header, 0);
    blocks.push(header);
    if (!e.type || e.type === 'File') {
      blocks.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
    }
  }
  blocks.push(Buffer.alloc(1024));
  const buf = zlib.gzipSync(Buffer.concat(blocks));
  return { buf, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

function tree(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      const st = fs.lstatSync(p);
      out.push(path.relative(dir, p) + (st.isDirectory() ? '/' : st.isSymbolicLink() ? '@' : ''));
      if (st.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return out.sort();
}

test('node-agent backup / restore', async (t) => {
  const b = await loadBackup();
  const wsDir = path.join(process.env.AGENT_WORKSPACES_DIR!, DEP);
  const volDir = path.join(process.env.AGENT_VOLUMES_DIR!, DEP, 'data');
  t.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  await t.test('backs up workspace + volume, excludes node_modules/.git, and never dereferences symlinks', async () => {
    write(path.join(wsDir, 'index.js'), 'console.log("hi")');
    write(path.join(wsDir, 'src/a.txt'), 'A');
    write(path.join(wsDir, 'node_modules/big/x.js'), 'x'.repeat(1000));
    write(path.join(wsDir, '.git/config'), '[core]');
    write(path.join(wsDir, '.next/cache/c.bin'), 'cache');
    write(path.join(volDir, 'db.sqlite'), 'sqlite-bytes');

    // A malicious/careless workspace symlink pointing at a secret outside the workspace.
    const secret = path.join(ROOT, 'host-secret.txt');
    write(secret, 'TOP-SECRET-HOST-DATA');
    fs.symlinkSync(secret, path.join(wsDir, 'leak'));

    const res = await b.createBackup({ deploymentId: DEP, backupId: BID, volumes: [{ name: 'data', hostPath: volDir }], includeWorkspace: true });
    assert.deepEqual(res.components.map((c: any) => c.file).sort(), ['volume-data.tar.gz', 'workspace.tar.gz']);

    const wsArchive = fs.readFileSync(path.join(b.BACKUPS_DIR, BID, 'workspace.tar.gz'));
    const tarText = zlib.gunzipSync(wsArchive).toString('latin1');
    assert.ok(tarText.includes('index.js'));
    assert.ok(!tarText.includes('node_modules'), 'node_modules excluded');
    assert.ok(!tarText.includes('.git/config'), '.git excluded');
    assert.ok(!tarText.includes('.next/cache'), '.next/cache excluded');
    assert.ok(!tarText.includes('TOP-SECRET-HOST-DATA'), 'symlink target contents must never enter a backup');

    for (const c of res.components) {
      const onDisk = fs.readFileSync(path.join(b.BACKUPS_DIR, BID, c.file));
      assert.equal(c.sizeBytes, onDisk.length);
      assert.equal(c.sha256, crypto.createHash('sha256').update(onDisk).digest('hex'));
    }
  });

  await t.test('restore replaces current contents with the backup and removes files that were not in it', async () => {
    const ws = (await b.openBackupFile(BID, 'workspace.tar.gz'));
    const comp = JSON.parse(JSON.stringify({}));
    void comp;
    const buf = fs.readFileSync(path.join(b.BACKUPS_DIR, BID, 'workspace.tar.gz'));
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    ws.stream.destroy();

    // Damage the workspace after the backup was taken.
    write(path.join(wsDir, 'index.js'), 'CORRUPTED');
    write(path.join(wsDir, 'added-later.txt'), 'new file');

    const out = await b.restoreComponent({ deploymentId: DEP, kind: 'workspace', stream: Readable.from([buf]), sha256: sha });
    assert.equal(out.ok, true);
    assert.ok(out.warnings.some((w: string) => /skipped symlink .*leak/.test(w)), 'the absolute symlink is reported, not silently dropped or corrupted');
    assert.ok(!fs.existsSync(path.join(wsDir, 'leak')) && !(() => { try { fs.lstatSync(path.join(wsDir, 'leak')); return true; } catch { return false; } })(), 'absolute symlink is not restored (node-tar would corrupt it)');
    assert.equal(fs.readFileSync(path.join(wsDir, 'index.js'), 'utf8'), 'console.log("hi")');
    assert.ok(!fs.existsSync(path.join(wsDir, 'added-later.txt')), 'files created after the backup are gone');
    assert.equal(fs.readFileSync(path.join(wsDir, 'src/a.txt'), 'utf8'), 'A');
    assert.ok(!fs.readdirSync(wsDir).some((n) => n.startsWith('.restore-staging') || n.startsWith('.pre-restore')), 'no staging leftovers');
  });

  await t.test('restore into a volume works and is confined to the volume directory', async () => {
    const buf = fs.readFileSync(path.join(b.BACKUPS_DIR, BID, 'volume-data.tar.gz'));
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    write(path.join(volDir, 'db.sqlite'), 'garbage');
    await b.restoreComponent({ deploymentId: DEP, kind: 'volume', name: 'data', hostPath: volDir, stream: Readable.from([buf]), sha256: sha });
    assert.equal(fs.readFileSync(path.join(volDir, 'db.sqlite'), 'utf8'), 'sqlite-bytes');

    await assert.rejects(
      b.restoreComponent({ deploymentId: DEP, kind: 'volume', name: 'data', hostPath: '/etc', stream: Readable.from([buf]), sha256: sha }),
      /outside the allowed volumes directory/
    );
    await assert.rejects(
      b.restoreComponent({ deploymentId: DEP, kind: 'volume', name: 'data', hostPath: path.join(process.env.AGENT_VOLUMES_DIR!, DEP, '..', 'other'), stream: Readable.from([buf]), sha256: sha }),
      /outside the allowed volumes directory/
    );
  });

  await t.test('a tampered archive fails the checksum and changes nothing', async () => {
    const buf = fs.readFileSync(path.join(b.BACKUPS_DIR, BID, 'workspace.tar.gz'));
    const goodSha = crypto.createHash('sha256').update(buf).digest('hex');
    const tampered = Buffer.from(buf);
    tampered[tampered.length - 20] ^= 0xff;
    const before = tree(wsDir);
    await assert.rejects(b.restoreComponent({ deploymentId: DEP, kind: 'workspace', stream: Readable.from([tampered]), sha256: goodSha }), (e: any) => e.code === 'checksum_mismatch');
    assert.deepEqual(tree(wsDir), before);
  });

  const hostile: Array<[string, Array<{ path: string; type?: string; linkpath?: string; data?: string }>]> = [
    ['a ".." path that climbs out of the target', [{ path: '../escaped.txt', data: 'pwned' }]],
    ['an absolute path', [{ path: '/tmp/agent-abs-escape.txt', data: 'pwned' }]],
    ['a device node', [{ path: 'dev-null', type: 'CharacterDevice' }]],
    // s1 -> "." looks harmless, and "l -> s1/.." normalises lexically to a directory inside the root, so both pass
    // the symlink filter. Physically, though, l resolves to the PARENT of the extraction root, so writing l/pwn.txt
    // must be caught by node-tar's refusal to extract through a symlink.
    ['a write THROUGH a chain of symlinks that escapes only physically', [
      { path: 's1', type: 'SymbolicLink', linkpath: '.' },
      { path: 'l', type: 'SymbolicLink', linkpath: 's1/..' },
      { path: 'l/pwn.txt', data: 'pwned' },
    ]],
  ];
  for (const [name, entries] of hostile) {
    await t.test(`rejects an archive containing ${name}`, async () => {
      fs.mkdirSync(path.join(ROOT, 'outside'), { recursive: true });
      const { buf, sha256 } = await craftArchive(entries);
      const before = tree(wsDir);
      let threw = false;
      try {
        await b.restoreComponent({ deploymentId: DEP, kind: 'workspace', stream: Readable.from([buf]), sha256 });
      } catch {
        threw = true;
      }
      // Regardless of how it is handled, nothing may have been written outside the target.
      assert.ok(!fs.existsSync(path.join(ROOT, 'escaped.txt')), 'no file written above the target');
      assert.ok(!fs.existsSync('/tmp/agent-abs-escape.txt'), 'absolute path not honoured');
      assert.ok(!fs.existsSync(path.join(ROOT, 'outside', 'pwn.txt')), 'did not write through the symlink');
      assert.ok(!fs.existsSync(path.join(wsDir, 'pwn.txt')), 'did not write into the restore target via a symlink either');
      assert.ok(threw, 'restore must fail loudly');
      assert.deepEqual(tree(wsDir), before, 'target is untouched after a rejected archive');
    });
  }

  await t.test('skips absolute and escaping symlinks with a warning instead of failing the whole restore, and keeps safe ones', async () => {
    const { buf, sha256 } = await craftArchive([
      { path: 'keep.txt', data: 'kept' },
      { path: 'abs', type: 'SymbolicLink', linkpath: '/etc/passwd' },
      { path: 'up', type: 'SymbolicLink', linkpath: '../../elsewhere' },
      { path: 'dir/deep-up', type: 'SymbolicLink', linkpath: '../../../x' },
      { path: 'safe-rel', type: 'SymbolicLink', linkpath: 'keep.txt' },
      { path: 'dir/safe-up', type: 'SymbolicLink', linkpath: '../keep.txt' },
    ]);
    const out = await b.restoreComponent({ deploymentId: DEP, kind: 'workspace', stream: Readable.from([buf]), sha256 });
    assert.equal(out.ok, true);
    assert.equal(fs.readFileSync(path.join(wsDir, 'keep.txt'), 'utf8'), 'kept');
    assert.equal(fs.readlinkSync(path.join(wsDir, 'safe-rel')), 'keep.txt');
    assert.equal(fs.readlinkSync(path.join(wsDir, 'dir/safe-up')).replace(/\\/g, '/'), '../keep.txt', 'in-tree relative link with ".." is preserved exactly');
    for (const name of ['abs', 'up', 'dir/deep-up']) {
      let exists = true;
      try { fs.lstatSync(path.join(wsDir, name)); } catch { exists = false; }
      assert.equal(exists, false, `${name} must not be restored`);
    }
    assert.equal(out.warnings.filter((w: string) => w.startsWith('skipped symlink')).length, 3);
  });

  await t.test('isEscapingSymlink classifies targets correctly', () => {
    const e = b.isEscapingSymlink;
    assert.equal(e('./a', '/etc/x'), true);
    assert.equal(e('./a', '../x'), true);
    assert.equal(e('./d/a', '../x'), false);
    assert.equal(e('./d/a', '../../x'), true);
    assert.equal(e('./d/a', '../d/./b'), false);
    assert.equal(e('./a', 'b/../../c'), true);
    assert.equal(e('./a', ''), true);
  });

  await t.test('enforces the size ceiling while streaming', async () => {
    const big = crypto.randomBytes(200_000);
    await assert.rejects(
      b.restoreComponent({ deploymentId: DEP, kind: 'workspace', stream: Readable.from([big]), sha256: 'a'.repeat(64), maxBytes: 1000 }),
      (e: any) => e.code === 'too_large'
    );
  });

  await t.test('volume outside the volumes root is skipped, and an empty backup fails clearly', async () => {
    const empty = 'cdep0000000002';
    await assert.rejects(
      b.createBackup({ deploymentId: empty, backupId: 'cbak0000000002', volumes: [{ name: 'x', hostPath: '/etc' }], includeWorkspace: true }),
      (e: any) => e.code === 'nothing_to_backup'
    );
    assert.ok(!fs.existsSync(path.join(b.BACKUPS_DIR, 'cbak0000000002')), 'spool dir cleaned up on failure');
  });

  await t.test('rejects path-traversal ids and file names', async () => {
    await assert.rejects(b.createBackup({ deploymentId: '../x', backupId: BID }), (e: any) => e.code === 'invalid_id');
    await assert.rejects(b.openBackupFile(BID, '../../etc/passwd'), (e: any) => e.code === 'invalid_file');
  });

  await t.test('removeBackup and pruneStaleSpool clean up', async () => {
    await b.removeBackup(BID);
    assert.ok(!fs.existsSync(path.join(b.BACKUPS_DIR, BID)));
    fs.mkdirSync(path.join(b.BACKUPS_DIR, 'orphan-old'), { recursive: true });
    const old = new Date(Date.now() - 10 * 3600_000);
    fs.utimesSync(path.join(b.BACKUPS_DIR, 'orphan-old'), old, old);
    assert.equal(await b.pruneStaleSpool(6 * 3600_000), 1);
  });
});
