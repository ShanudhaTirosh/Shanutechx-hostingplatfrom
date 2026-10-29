import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';

/**
 * Empirical Adversarial & Stress Testing for services/node-agent/src/repo.js
 *
 * Exercises git fetch failure scenarios, fallback branch mechanics (main <-> master),
 * custom branch handling, diagnostic retention, credential redaction, and regex matching.
 */

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-adversarial-'));
process.env.AGENT_WORKSPACES_DIR = path.join(ROOT, 'workspaces');
fs.mkdirSync(process.env.AGENT_WORKSPACES_DIR, { recursive: true });

async function loadRepo() {
  const mod: any = await import('../../services/node-agent/src/repo.js');
  return mod.default ?? mod;
}

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

/** Creates a bare git repository with a specific branch name and initial commit */
function createBareRepo(repoDir: string, branchName: string, initialContent = 'v1') {
  const seed = path.join(ROOT, `seed-${path.basename(repoDir)}`);
  fs.mkdirSync(seed, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', branchName], { cwd: seed });
  execFileSync('git', ['config', 'user.email', 'test@shanutechx.internal'], { cwd: seed });
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: seed });
  fs.writeFileSync(path.join(seed, 'version.txt'), initialContent);
  execFileSync('git', ['add', '-A'], { cwd: seed });
  execFileSync('git', ['commit', '-q', '-m', `init-${branchName}`], { cwd: seed });
  execFileSync('git', ['clone', '-q', '--bare', seed, repoDir]);
  fs.rmSync(seed, { recursive: true, force: true });
}

test('node-agent repo.js — Adversarial Branch Fetch & Error Retention', async (t) => {
  const repo = await loadRepo();

  t.after(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  await t.test('Adversarial 1: Primary "main" and fallback "master" both fail (unreachable remote)', async () => {
    const origin = path.join(ROOT, 'origin-main-fail.git');
    createBareRepo(origin, 'main', 'main-v1');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-01';
    // First deployment succeeds and sets up .git directory
    const wsDir = await repo.prepareWorkspace(dep, url, 'main');
    assert.equal(read(path.join(wsDir, 'version.txt')), 'main-v1');

    // Simulate remote becoming unreachable / deleted
    fs.renameSync(origin, origin + '.deleted');

    let capturedError: Error | null = null;
    try {
      await repo.prepareWorkspace(dep, url, 'main');
    } catch (err: any) {
      capturedError = err;
    }

    assert.ok(capturedError, 'Fetch failure must reject deployment');
    // 1. Mandatory Regex matching check
    assert.match(
      capturedError.message,
      /Could not fetch the latest code for branch "main"/,
      'Error message must match regex /Could not fetch the latest code for branch "main"/'
    );
    // 2. Mentions both branches attempted
    assert.ok(
      capturedError.message.includes('"main"') && capturedError.message.includes('"master"'),
      'Error message must mention both "main" and fallback "master"'
    );
    // 3. Retains underlying git diagnostic information
    assert.ok(
      capturedError.message.includes('failed:') || capturedError.message.includes('fatal:'),
      `Error must retain git diagnostic info: ${capturedError.message}`
    );
  });

  await t.test('Adversarial 2: Primary "master" and fallback "main" both fail', async () => {
    const origin = path.join(ROOT, 'origin-master-fail.git');
    createBareRepo(origin, 'master', 'master-v1');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-02';
    const wsDir = await repo.prepareWorkspace(dep, url, 'master');
    assert.equal(read(path.join(wsDir, 'version.txt')), 'master-v1');

    fs.renameSync(origin, origin + '.deleted');

    let capturedError: Error | null = null;
    try {
      await repo.prepareWorkspace(dep, url, 'master');
    } catch (err: any) {
      capturedError = err;
    }

    // When branch is 'master', altBranch is 'main' -> "Could not fetch the latest code for branch "master" or "main": ..."
    assert.match(
      capturedError.message,
      /Could not fetch the latest code for branch "master" or "main"/,
      'Error message must match regex /Could not fetch the latest code for branch "master" or "main"/'
    );
    assert.ok(
      capturedError.message.includes('"main"'),
      'Must include fallback branch "main"'
    );
    assert.ok(
      capturedError.message.includes('failed:') || capturedError.message.includes('fatal:'),
      `Error must retain git diagnostic info: ${capturedError.message}`
    );
  });

  await t.test('Adversarial 2b: Default branch parameter (omitted) defaults to "main" and matches regex', async () => {
    const origin = path.join(ROOT, 'origin-default-fail.git');
    createBareRepo(origin, 'main', 'default-v1');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-02b';
    const wsDir = await repo.prepareWorkspace(dep, url); // branch omitted -> defaults to 'main'
    assert.equal(read(path.join(wsDir, 'version.txt')), 'default-v1');

    fs.renameSync(origin, origin + '.deleted');

    let capturedError: Error | null = null;
    try {
      await repo.prepareWorkspace(dep, url);
    } catch (err: any) {
      capturedError = err;
    }

    assert.ok(capturedError, 'Fetch failure must reject deployment');
    assert.match(
      capturedError.message,
      /Could not fetch the latest code for branch "main"/,
      'Default branch must match regex /Could not fetch the latest code for branch "main"/'
    );
    assert.ok(
      capturedError.message.includes('failed:') || capturedError.message.includes('fatal:'),
      `Error must retain git diagnostic info: ${capturedError.message}`
    );
  });

  await t.test('Adversarial 3: Non-default custom branch fetch failure stops deploy with diagnostic', async () => {
    const origin = path.join(ROOT, 'origin-custom-fail.git');
    createBareRepo(origin, 'release-2026', 'rel-v1');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-03';
    const wsDir = await repo.prepareWorkspace(dep, url, 'release-2026');
    assert.equal(read(path.join(wsDir, 'version.txt')), 'rel-v1');

    fs.renameSync(origin, origin + '.deleted');

    let capturedError: Error | null = null;
    try {
      await repo.prepareWorkspace(dep, url, 'release-2026');
    } catch (err: any) {
      capturedError = err;
    }

    assert.ok(capturedError, 'Fetch failure on custom branch must reject deployment');
    assert.match(
      capturedError.message,
      /Could not fetch the latest code for branch "release-2026", so the deploy was stopped instead of rebuilding old code\./,
      'Custom branch failure must stop deploy'
    );
    assert.ok(
      capturedError.message.includes('failed:') || capturedError.message.includes('fatal:'),
      'Must preserve diagnostic message'
    );
  });

  await t.test('Adversarial 4: Requested "main", remote only has "master" -> fallback fetch succeeds', async () => {
    const origin = path.join(ROOT, 'origin-only-master.git');
    createBareRepo(origin, 'master', 'master-only-content');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-04';
    // Clone with master first
    const wsDir = await repo.prepareWorkspace(dep, url, 'master');
    assert.equal(read(path.join(wsDir, 'version.txt')), 'master-only-content');

    // Add a new commit to master in the bare remote
    const updateSeed = path.join(ROOT, 'seed-update');
    execFileSync('git', ['clone', '-q', origin, updateSeed]);
    fs.writeFileSync(path.join(updateSeed, 'version.txt'), 'master-updated-v2');
    execFileSync('git', ['add', '-A'], { cwd: updateSeed });
    execFileSync('git', ['commit', '-q', '-m', 'v2'], { cwd: updateSeed });
    execFileSync('git', ['push', '-q', 'origin', 'master'], { cwd: updateSeed });
    fs.rmSync(updateSeed, { recursive: true, force: true });

    // Customer configured deployment with branch = "main" (even though remote only has "master")
    // prepareWorkspace must attempt "main", fail, then fallback to "master" and succeed!
    const updatedWs = await repo.prepareWorkspace(dep, url, 'main');
    assert.equal(read(path.join(updatedWs, 'version.txt')), 'master-updated-v2');
  });

  await t.test('Adversarial 5: Requested "master", remote only has "main" -> fallback fetch succeeds', async () => {
    const origin = path.join(ROOT, 'origin-only-main.git');
    createBareRepo(origin, 'main', 'main-only-content');
    const url = `file://${origin}`;

    const dep = 'dep-adv-fetch-05';
    const wsDir = await repo.prepareWorkspace(dep, url, 'main');
    assert.equal(read(path.join(wsDir, 'version.txt')), 'main-only-content');

    // Add new commit to main in bare remote
    const updateSeed = path.join(ROOT, 'seed-update-main');
    execFileSync('git', ['clone', '-q', origin, updateSeed]);
    fs.writeFileSync(path.join(updateSeed, 'version.txt'), 'main-updated-v2');
    execFileSync('git', ['add', '-A'], { cwd: updateSeed });
    execFileSync('git', ['commit', '-q', '-m', 'v2'], { cwd: updateSeed });
    execFileSync('git', ['push', '-q', 'origin', 'main'], { cwd: updateSeed });
    fs.rmSync(updateSeed, { recursive: true, force: true });

    // Customer configured branch = "master", remote only has "main"
    const updatedWs = await repo.prepareWorkspace(dep, url, 'master');
    assert.equal(read(path.join(updatedWs, 'version.txt')), 'main-updated-v2');
  });

  await t.test('Adversarial 6: Fetch failure with credentials must redact secret from error and config', async () => {
    const SECRET_PAT = 'ghp_ADV_SECRET_PAT_9876543210_XYZ';
    const fakeServer = http.createServer((req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="fake"' });
      res.end('Unauthorized');
    });

    await new Promise<void>((resolve) => fakeServer.listen(0, '127.0.0.1', () => resolve()));
    const port = (fakeServer.address() as AddressInfo).port;

    const dep = 'dep-adv-fetch-06';
    const wsDir = path.join(process.env.AGENT_WORKSPACES_DIR!, dep);
    fs.mkdirSync(wsDir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: wsDir });

    const authedUrl = `http://x-access-token:${SECRET_PAT}@127.0.0.1:${port}/test/repo.git`;

    let capturedErr: Error | null = null;
    try {
      await repo.prepareWorkspace(dep, authedUrl, 'main');
    } catch (e: any) {
      capturedErr = e;
    } finally {
      await new Promise<void>((r) => fakeServer.close(() => r()));
    }

    assert.ok(capturedErr, 'Fetch to 401 server must fail');
    assert.match(capturedErr.message, /Could not fetch the latest code for branch "main"/);
    // Secret verification
    assert.ok(!capturedErr.message.includes(SECRET_PAT), 'Secret PAT must not leak in error message');
    assert.ok(
      !capturedErr.message.includes(Buffer.from(`x-access-token:${SECRET_PAT}`).toString('base64')),
      'Base64 credential must not leak in error message'
    );

    const gitConfig = read(path.join(wsDir, '.git', 'config'));
    assert.ok(!gitConfig.includes(SECRET_PAT), 'Secret PAT must not be persisted in .git/config');
  });
});
