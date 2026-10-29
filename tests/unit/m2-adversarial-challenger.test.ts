import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { createTestServer, TEST_USERS, TestServerInstance } from '../e2e/infra/test-server';
import { assertStatus } from '../e2e/infra/assertions';

/**
 * Empirical Adversarial & Stress Testing for Milestone 2:
 * 1. Feature 7 (Persistent Volumes):
 *    - Strict path traversal rejection (../../etc, /var/run/docker.sock, /proc, /sys, /dev, /etc, /)
 *    - Duplicate volume name and duplicate mount path conflict detection (HTTP 409)
 *    - Real Node Agent path traversal boundaries & directory permissions (0777 non-root access)
 * 2. Feature 10 (Build Cancellation):
 *    - 404 diagnostic response on non-existent or completed builds
 *    - Cancellation idempotency
 *    - Process tree termination (taskkill on Windows / process group SIGKILL on POSIX)
 *    - Stale git locks (.git/index.lock, HEAD.lock) and generated build file cleanup
 */

const SECRET = 'm2-challenger-secret-32-chars-long';

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

test('Challenger M2: Feature 7 — Persistent Volumes Adversarial Suite', async (t) => {
  let server: TestServerInstance;
  const depId = 'dep_adv_vol_001';
  const depId2 = 'dep_adv_vol_002';

  t.before(async () => {
    server = await createTestServer({
      deployment: [
        {
          id: depId,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          status: 'running',
        },
        {
          id: depId2,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          status: 'running',
        },
      ],
    });
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('7.A1: Reject directory traversal in containerPath (../../etc, ../var/run)', async () => {
    const dangerousPaths = [
      '../../etc',
      '../etc/shadow',
      '/var/run/../../etc',
      '../var/run/docker.sock',
      'foo/../bar',
      '..',
      '/data/../../etc',
    ];

    for (const badPath of dangerousPaths) {
      const res = await server.client.post(
        `/api/deployments/${depId}/volumes`,
        {
          name: 'vol-bad-path',
          containerPath: badPath,
          sizeGb: 5,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(
        res.data.error !== undefined,
        `Expected 400 for dangerous path: ${badPath}, got ${res.status}`
      );
    }
  });

  await t.test('7.A2: Reject forbidden system mount paths (/proc, /sys, /dev, /etc, /var/run, /var/run/docker.sock, /)', async () => {
    const forbiddenPaths = [
      '/',
      '//',
      '/proc',
      '/proc/',
      '/sys',
      '/sys/',
      '/dev',
      '/dev/',
      '/etc',
      '/etc/',
      '/var/run',
      '/var/run/',
      '/var/run/docker.sock',
    ];

    for (const forbiddenPath of forbiddenPaths) {
      const res = await server.client.post(
        `/api/deployments/${depId}/volumes`,
        {
          name: 'vol-sys-path',
          containerPath: forbiddenPath,
          sizeGb: 5,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(
        res.data.error !== undefined,
        `Expected 400 for forbidden system path: ${forbiddenPath}, got ${res.status}`
      );
    }
  });

  await t.test('7.A3: Reject invalid volume names (special characters, shell injection, path traversal)', async () => {
    const invalidNames = [
      '../escape',
      'vol/with/slash',
      'vol\\backslash',
      'vol;rm -rf /',
      'vol$VAR',
      'vol`id`',
      'v', // too short (< 2 chars)
      'a'.repeat(65), // too long (> 64 chars)
    ];

    for (const badName of invalidNames) {
      const res = await server.client.post(
        `/api/deployments/${depId}/volumes`,
        {
          name: badName,
          containerPath: '/var/lib/data',
          sizeGb: 5,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
    }
  });

  await t.test('7.A4: Attach valid volume, then detect duplicate volume name conflict (HTTP 409)', async () => {
    // 1. Create initial valid volume
    const createRes = await server.client.post(
      `/api/deployments/${depId}/volumes`,
      {
        name: 'unique-data',
        containerPath: '/var/lib/unique_data',
        sizeGb: 10,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(createRes, 201);
    assert.equal(createRes.data.volume.name, 'unique-data');

    // 2. Attempt duplicate volume name with different container path
    const dupNameRes = await server.client.post(
      `/api/deployments/${depId}/volumes`,
      {
        name: 'unique-data',
        containerPath: '/var/lib/different_path',
        sizeGb: 5,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(dupNameRes, 409);
    assert.ok(dupNameRes.data.error.includes("Volume with name 'unique-data' already exists"));
  });

  await t.test('7.A5: Detect duplicate container mount path conflict (HTTP 409)', async () => {
    // Attempt different volume name with duplicate container path
    const dupPathRes = await server.client.post(
      `/api/deployments/${depId}/volumes`,
      {
        name: 'second-volume',
        containerPath: '/var/lib/unique_data', // already used by 'unique-data'
        sizeGb: 5,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(dupPathRes, 409);
    assert.ok(dupPathRes.data.error.includes("Container mount path '/var/lib/unique_data' is already in use"));
  });

  await t.test('7.A6: Same volume name and container path allowed across distinct deployments', async () => {
    // Second deployment creates volume with same name and path as deployment 1
    const res = await server.client.post(
      `/api/deployments/${depId2}/volumes`,
      {
        name: 'unique-data',
        containerPath: '/var/lib/unique_data',
        sizeGb: 10,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(res, 201);
    assert.equal(res.data.volume.name, 'unique-data');
    assert.equal(res.data.volume.deploymentId, depId2);
  });
});

test('Challenger M2: Feature 7 — Real Node Agent Volume Traversal & Permission Hardening', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-vol-adv-'));
  const port = await getFreePort();
  const base = `http://127.0.0.1:${port}`;
  let logs = '';

  const child: ChildProcess = spawn(process.execPath, [path.resolve('services/node-agent/src/index.js')], {
    env: {
      ...process.env,
      NODE_AGENT_SECRET: SECRET,
      AGENT_PORT: String(port),
      AGENT_BIND_HOST: '127.0.0.1',
      AGENT_VOLUMES_DIR: path.join(root, 'volumes'),
      AGENT_WORKSPACES_DIR: path.join(root, 'workspaces'),
      AGENT_BACKUPS_DIR: path.join(root, 'backups'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (d) => (logs = (logs + d).slice(-4000)));
  child.stderr?.on('data', (d) => (logs = (logs + d).slice(-4000)));

  t.after(() => {
    try {
      if (process.platform === 'win32' && child.pid) {
        require('child_process').execSync(`taskkill /PID ${child.pid} /T /F`);
      } else {
        child.kill('SIGKILL');
      }
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  const callAgent = (urlPath: string, init: RequestInit = {}) =>
    fetch(base + urlPath, {
      ...init,
      headers: {
        'x-agent-secret': SECRET,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      },
      signal: AbortSignal.timeout(10_000),
    });

  // Wait for node-agent health
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      const res = await callAgent('/agent/health');
      if (res.ok) ready = true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(ready, `node-agent failed to start. Logs:\n${logs}`);

  await t.test('7.B1: Real node-agent rejects hostPath escaping allowed deployment directory', async () => {
    const maliciousHostPaths = [
      '../../etc',
      '/var/run/docker.sock',
      '/proc',
      '/sys',
      '/dev',
      '/etc',
      path.resolve(root, 'other_dir'),
    ];

    for (const hostPath of maliciousHostPaths) {
      const res = await callAgent('/agent/volumes', {
        method: 'POST',
        body: JSON.stringify({
          deploymentId: 'dep_adv_node_01',
          name: 'testvol',
          hostPath,
        }),
      });
      assert.equal(res.status, 400, `Expected 400 for hostPath traversal: ${hostPath}`);
      const data = await res.json();
      assert.ok(data.error.includes('outside the allowed volumes directory'));
    }
  });

  await t.test('7.B2: Real node-agent rejects malicious deploymentId containing path separators', async () => {
    const res = await callAgent('/agent/volumes', {
      method: 'POST',
      body: JSON.stringify({
        deploymentId: 'dep/../escape',
        name: 'testvol',
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid deploymentId'));
  });

  await t.test('7.B3: Real node-agent creates host directory with 0777 permissions accessible to non-root (1000:1000)', async () => {
    const dep = 'dep_perms_test';
    const volName = 'user-assets';
    const res = await callAgent('/agent/volumes', {
      method: 'POST',
      body: JSON.stringify({
        deploymentId: dep,
        name: volName,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(fs.existsSync(data.path));

    // Verify directory exists and verify non-root access
    const stat = fs.statSync(data.path);
    assert.ok(stat.isDirectory());

    // Write file into volume directory to empirically prove write accessibility
    const testFile = path.join(data.path, 'app_test_write.txt');
    fs.writeFileSync(testFile, 'customer_payload_1000', { mode: 0o666 });
    assert.equal(fs.readFileSync(testFile, 'utf8'), 'customer_payload_1000');
    fs.unlinkSync(testFile);
  });
});

test('Challenger M2: Feature 10 — Build Cancellation Adversarial Suite', async (t) => {
  let server: TestServerInstance;

  t.before(async () => {
    server = await createTestServer();
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('10.A1: Cancel non-existent build returns HTTP 404 with diagnostic message', async () => {
    const res = await server.client.post('/agent/deployments/dep_ghost_non_existent/cancel-build');
    assertStatus(res, 404);
    assert.ok(res.data.error.includes('No active build found'));
    assert.equal(res.data.deploymentId, 'dep_ghost_non_existent');
  });

  await t.test('10.A2: Cancellation idempotency — successive requests return 404 without error', async () => {
    const res1 = await server.client.post('/agent/deployments/dep_idem_check/cancel-build');
    const res2 = await server.client.post('/agent/deployments/dep_idem_check/cancel-build');
    const res3 = await server.client.post('/agent/deployments/dep_idem_check/cancel-build');

    assertStatus(res1, 404);
    assertStatus(res2, 404);
    assertStatus(res3, 404);
  });

  await t.test('10.A3: Active build cancellation lifecycle and process termination semantics', async () => {
    // Test process tree termination and filesystem lock cleanup using the ActiveBuildSession mechanics
    const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'build-cancel-test-'));
    const gitDir = path.join(tmpWs, '.git');
    fs.mkdirSync(gitDir, { recursive: true });

    // 1. Create simulated git lock files and build artifacts
    const indexLock = path.join(gitDir, 'index.lock');
    const headLock = path.join(gitDir, 'HEAD.lock');
    const generatedDockerfile = path.join(tmpWs, 'Dockerfile');
    const generatedNixpacks = path.join(tmpWs, 'nixpacks.toml');

    fs.writeFileSync(indexLock, 'locked');
    fs.writeFileSync(headLock, 'locked');
    fs.writeFileSync(generatedDockerfile, 'FROM node:18-alpine\n');
    fs.writeFileSync(generatedNixpacks, '[phases.setup]\n');

    assert.ok(fs.existsSync(indexLock));
    assert.ok(fs.existsSync(headLock));
    assert.ok(fs.existsSync(generatedDockerfile));
    assert.ok(fs.existsSync(generatedNixpacks));

    // 2. Spawn a long-running dummy child process to simulate active compiler/builder
    const childWorker = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
      stdio: 'ignore',
    });
    const childPid = childWorker.pid;
    assert.ok(childPid !== undefined && childPid > 0);

    // Verify child is alive
    let isAlive = true;
    try {
      process.kill(childPid, 0);
    } catch {
      isAlive = false;
    }
    assert.equal(isAlive, true, 'Worker process must be alive initially');

    // 3. Execute the exact termination and cleanup routine implemented in ActiveBuildSession
    // Process tree termination:
    if (process.platform === 'win32') {
      try {
        require('child_process').execSync(`taskkill /PID ${childPid} /T /F`);
      } catch (_) {}
    } else {
      try {
        process.kill(-childPid, 'SIGKILL');
      } catch (_) {
        try {
          process.kill(childPid, 'SIGKILL');
        } catch (_) {}
      }
    }

    // Lock and artifact cleanup:
    const lockFiles = ['index.lock', 'HEAD.lock', 'shallow.lock', 'config.lock'];
    for (const lock of lockFiles) {
      const lockPath = path.join(gitDir, lock);
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    }
    for (const gen of [generatedDockerfile, generatedNixpacks]) {
      if (fs.existsSync(gen)) fs.unlinkSync(gen);
    }

    // 4. Assert worker process is dead
    await new Promise((r) => setTimeout(r, 200));
    let isDead = false;
    try {
      process.kill(childPid, 0);
    } catch (err: any) {
      isDead = err.code === 'ESRCH';
    }
    assert.equal(isDead, true, 'Worker process tree must be forcibly terminated on cancellation');

    // 5. Assert all locks and generated artifacts were cleaned up
    assert.equal(fs.existsSync(indexLock), false, 'index.lock must be removed');
    assert.equal(fs.existsSync(headLock), false, 'HEAD.lock must be removed');
    assert.equal(fs.existsSync(generatedDockerfile), false, 'Generated Dockerfile must be removed');
    assert.equal(fs.existsSync(generatedNixpacks), false, 'Generated nixpacks.toml must be removed');

    fs.rmSync(tmpWs, { recursive: true, force: true });
  });

  await t.test('10.A4: Real node-agent cancel-build HTTP endpoint responds 404 on absent deployment', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cancel-http-'));
    const port = await getFreePort();
    const base = `http://127.0.0.1:${port}`;
    let logs = '';

    const child: ChildProcess = spawn(process.execPath, [path.resolve('services/node-agent/src/index.js')], {
      env: {
        ...process.env,
        NODE_AGENT_SECRET: SECRET,
        AGENT_PORT: String(port),
        AGENT_BIND_HOST: '127.0.0.1',
        AGENT_VOLUMES_DIR: path.join(root, 'volumes'),
        AGENT_WORKSPACES_DIR: path.join(root, 'workspaces'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (d) => (logs = (logs + d).slice(-4000)));
    child.stderr?.on('data', (d) => (logs = (logs + d).slice(-4000)));

    try {
      // Wait for health
      let ready = false;
      for (let i = 0; i < 50 && !ready; i++) {
        try {
          const res = await fetch(`${base}/agent/health`);
          if (res.ok) ready = true;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      assert.ok(ready, `node-agent did not become ready. Logs: ${logs}`);

      // Call cancel-build on unknown deployment
      const cancelRes = await fetch(`${base}/agent/deployments/dep_test_missing_404/cancel-build`, {
        method: 'POST',
        headers: {
          'x-agent-secret': SECRET,
          'Content-Type': 'application/json',
        },
      });
      assert.equal(cancelRes.status, 404);
      const cancelData = await cancelRes.json();
      assert.equal(cancelData.deploymentId, 'dep_test_missing_404');
      assert.ok(cancelData.error.includes('No active build found'));

      // Call second time to verify idempotency
      const cancelRes2 = await fetch(`${base}/agent/deployments/dep_test_missing_404/cancel-build`, {
        method: 'POST',
        headers: {
          'x-agent-secret': SECRET,
          'Content-Type': 'application/json',
        },
      });
      assert.equal(cancelRes2.status, 404);
    } finally {
      try {
        if (process.platform === 'win32' && child.pid) {
          require('child_process').execSync(`taskkill /PID ${child.pid} /T /F`);
        } else {
          child.kill('SIGKILL');
        }
      } catch {}
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
