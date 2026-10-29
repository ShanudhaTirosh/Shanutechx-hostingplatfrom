# Technical Investigation and Design: Feature 10 (Build Cancellation) & Feature 11 (Container Lifecycle & Telemetry)

**Date**: 2026-10-28  
**Author**: Explorer Agent (`teamwork_explorer_m2_3`)  
**Milestone**: Milestone 2: Container Management & Build System  
**Scope**: `services/node-agent/src/index.js`, `services/node-agent/src/build.js`, `services/node-agent/src/repo.js`, `services/node-agent/src/docker.js`

---

## 1. Executive Summary

This investigation provides the root cause analysis and technical design for **Feature 10 (Build Cancellation Tracking)** and **Feature 11 (Container Lifecycle & Telemetry)** within the ShanuTechX platform.

Key findings:
1. **Feature 10 Root Cause**: `activeBuilds.set()` is never called anywhere in `build-and-run` (`services/node-agent/src/index.js:482-571`). The `activeBuilds` map is declared at line 573 below the route, and remains permanently empty. Consequently, `cancel-build` (`index.js:575-589`) is a complete no-op that never locates or kills any process. Furthermore, the underlying `run()` helpers in `build.js` and `repo.js` encapsulate `execFile` without exposing child process handles or accepting `AbortSignal`s, and `cancel-build` fails to terminate descendant process trees (`SIGTERM`/`SIGKILL`/`taskkill`) or clean up temporary build artifacts (e.g. lockfiles, auto-generated Dockerfiles, generated `nixpacks.toml`, runner containers).
2. **Feature 11 Telemetry & Lifecycle Assessment**: `services/node-agent/src/docker.js` contains **real, non-synthetic, non-randomized** Dockerode integration. It uses the exact Docker CLI CPU percentage delta formula `(cpuDelta / systemDelta) * numCPUs * 100` and demuxes multiplexed Docker stdout/stderr streams using `docker.modem.demuxStream`. However, `getContainerMetrics` omits raw byte fields (`memoryUsageBytes`, `memoryLimitBytes`, `networkRxBytes`, `networkTxBytes`, `cpuPercent`), causing single-shot `/agent/containers/:containerId/stats` to mismatch the schema expected by Tier 1 E2E tests (`m2-container-build.test.ts:275-297`). Unifying single-shot metrics and streaming stats resolves this discrepancy completely.

---

## 2. Feature 10: Build Cancellation Root Cause Analysis

### 2.1 Code Trace: `services/node-agent/src/index.js:482-589`

In `services/node-agent/src/index.js`:
```javascript
// Lines 482-571: build-and-run endpoint
app.post('/agent/deployments/:deploymentId/build-and-run', async (req, res) => {
  const { deploymentId } = req.params;
  // ...
  res.setHeader('Content-Type', 'application/x-ndjson');
  const emit = (event) => res.write(JSON.stringify(event) + '\n');

  try {
    emit({ phase: 'fetch', message: 'Fetching repository...' });
    const baseWorkspaceDir = await prepareWorkspace(deploymentId, repoUrl, branch || 'main', backupRepoUrl);

    // ...
    emit({ phase: 'build', message: 'Building container image...' });
    const imageTag = `shanutechx/${deploymentId}:latest`;
    await buildImage({
      workspaceDir,
      imageTag,
      envVars,
      // ...
      onData: (chunk) => emit({ phase: 'build', log: chunk.toString() }),
    });

    emit({ phase: 'run', message: 'Starting container...' });
    const { containerId, containerName } = await runContainer({ ... });
    // ...
    emit({ phase: 'done', containerId, containerName });
    res.end();
  } catch (err) {
    emit({ phase: 'error', message: err.message, stderr: err.stderr });
    res.end();
  }
});

// Line 573: activeBuilds declared AFTER the build-and-run route!
const activeBuilds = new Map();

// Lines 575-589: cancel-build endpoint
app.post('/agent/deployments/:deploymentId/cancel-build', async (req, res) => {
  const { deploymentId } = req.params;
  const build = activeBuilds.get(deploymentId);
  if (build) {
    try {
      if (typeof build.kill === 'function') build.kill();
      activeBuilds.delete(deploymentId);
      logger.info({ deploymentId }, 'Build process cancelled');
      return res.json({ ok: true, message: 'Build cancelled' });
    } catch (err) {
      logger.error({ deploymentId, err }, 'Error cancelling build process');
    }
  }
  res.json({ ok: true, message: 'No active build process found or already stopped' });
});
```

### 2.2 Why `activeBuilds.set()` Is Never Populated

1. **Missing Registration Logic**:
   - `activeBuilds.set(deploymentId, ...)` was simply never written in `build-and-run`.
   - The map declaration was placed at line 573, immediately preceding `cancel-build`, indicating an unfinished implementation where the cancel handler was drafted without wiring it back into `build-and-run`.
2. **Encapsulated Subprocess Architecture**:
   - `build-and-run` calls `prepareWorkspace` in `services/node-agent/src/repo.js` and `buildImage` in `services/node-agent/src/build.js`.
   - In `repo.js:run`:
     ```javascript
     function run(cmd, args, opts = {}) {
       return new Promise((resolve, reject) => {
         execFile(cmd, args, { ...opts, env: ... }, (err, stdout, stderr) => { ... });
       });
     }
     ```
   - In `build.js:run`:
     ```javascript
     function run(cmd, args, opts = {}) {
       return new Promise((resolve, reject) => {
         const child = execFile(cmd, args, { ...opts }, (err, stdout, stderr) => { ... });
         if (opts.onData) { child.stdout?.on('data', opts.onData); }
       });
     }
     ```
   - Neither function returns the `child` handle or PID, neither accepts an `AbortSignal`, and neither bubbles subprocess references to callers.
3. **Multi-Phase Pipeline Disconnect**:
   - A build spans three phases:
     1. Repository checkout/fetch (`git clone` or `git fetch`).
     2. Multi-tier image building (Railpack CLI, Nixpacks CLI, containerized Nixpacks runner, or `docker build`).
     3. Container initialization (`runContainer`).
   - If a build is cancelled during Phase 1 or Phase 2, `activeBuilds` must track the current phase and the currently active child process.
4. **Endpoint Response Contract Defect**:
   - When no active build is found, `cancel-build` returns HTTP 200 `{ ok: true, message: 'No active build process found or already stopped' }`.
   - In contrast, the Tier 1 E2E test suite (`tests/e2e/tier1-features/m2-container-build.test.ts:244-254`) asserts:
     - `POST /agent/deployments/:id/cancel-build` with unknown ID returns **HTTP 404** with `{ error: 'No active build found to cancel', deploymentId }`.
     - Successful cancellation returns **HTTP 200** with `{ ok: true, cancelled: true, deploymentId }`.

---

## 3. Feature 10: Technical Design & Proposed Implementation

### 3.1 Design Overview: The Build Session Controller

To make build cancellation genuinely functional and robust:
1. Define a `BuildSession` tracking object registered in `activeBuilds` at the start of `build-and-run`.
2. Introduce an `AbortController` whose signal cascades through all child process executions.
3. Pass an `onProcess(child)` hook to `repo.js:run` and `build.js:run` so the active `ChildProcess` handle and PID are always known to the `BuildSession`.
4. Provide a cross-platform process tree killer (`killProcessTree`) that terminates both the immediate process and all descendant child processes (`taskkill /T /F` on Windows; process group `SIGTERM` followed by `SIGKILL` on POSIX).
5. If Tier 3 spawned a containerized runner (`docker run ... ghcr.io/railwayapp/nixpacks`), record the container ID and force-remove it upon cancellation.
6. Clean up temporary build artifacts:
   - Git lockfiles (`.git/index.lock`, `.git/HEAD.lock`, `.git/shallow.lock`) left behind if git was terminated mid-operation.
   - Auto-generated `Dockerfile` (if generated by `generateSmartDockerfile`).
   - Auto-generated `nixpacks.toml` (if generated from `nixpacksConfig`).
   - Remove partial intermediate image `shanutechx/${deploymentId}:latest`.
7. Deregister from `activeBuilds` in a `finally` block to prevent leaks.

### 3.2 Data Structure: `ActiveBuildSession`

```javascript
class ActiveBuildSession {
  constructor(deploymentId) {
    this.deploymentId = deploymentId;
    this.startTime = Date.now();
    this.phase = 'init'; // 'fetch' | 'build' | 'run' | 'cancelled'
    this.abortController = new AbortController();
    this.currentProcess = null;
    this.workspaceDir = null;
    this.runnerContainerId = null;
    this.generatedFiles = new Set();
    this.cancelled = false;
  }

  get signal() {
    return this.abortController.signal;
  }

  setCurrentProcess(proc) {
    this.currentProcess = proc;
  }

  trackGeneratedFile(filePath) {
    this.generatedFiles.add(filePath);
  }

  async kill() {
    this.cancelled = true;
    this.phase = 'cancelled';

    // 1. Trigger AbortController signal
    this.abortController.abort();

    // 2. Terminate child process tree
    if (this.currentProcess && this.currentProcess.pid) {
      await terminateProcessTree(this.currentProcess.pid);
      this.currentProcess = null;
    }

    // 3. Clean up containerized runner if Tier 3 was executing
    if (this.runnerContainerId) {
      try {
        const cnt = docker.getContainer(this.runnerContainerId);
        await cnt.remove({ force: true, v: true });
      } catch (_) {}
      this.runnerContainerId = null;
    }

    // 4. Clean up temporary filesystem artifacts
    await this.cleanupArtifacts();
  }

  async cleanupArtifacts() {
    // Clean up auto-generated files
    for (const filePath of this.generatedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (_) {}
    }

    // Remove any stale git lock files in workspace
    if (this.workspaceDir) {
      const gitDir = path.join(this.workspaceDir, '.git');
      if (fs.existsSync(gitDir)) {
        const lockFiles = ['index.lock', 'HEAD.lock', 'shallow.lock', 'config.lock'];
        for (const lock of lockFiles) {
          const lockPath = path.join(gitDir, lock);
          try {
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
          } catch (_) {}
        }
      }
    }
  }
}
```

### 3.3 Cross-Platform Process Tree Killer (`terminateProcessTree`)

```javascript
const { execFile: execFileCb } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFileCb);

async function terminateProcessTree(pid) {
  if (!pid) return;

  if (process.platform === 'win32') {
    // Windows: taskkill /PID <pid> /T /F terminates process and all child processes forcefully
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    } catch (_) {}
  } else {
    // POSIX: Kill process group with SIGTERM, then escalate to SIGKILL
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (_) {
      try { process.kill(pid, 'SIGTERM'); } catch (_) {}
    }

    // Grace period for cooperative shutdown
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      process.kill(-pid, 'SIGKILL');
    } catch (_) {
      try { process.kill(pid, 'SIGKILL'); } catch (_) {}
    }
  }
}
```

### 3.4 Updating `run()` in `build.js` and `repo.js`

In `services/node-agent/src/build.js`:
```javascript
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const { onProcess, onData, signal, ...execOpts } = opts;
    const child = execFile(
      cmd,
      args,
      { maxBuffer: 1024 * 1024 * 50, signal, ...execOpts },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout, stderr });
      }
    );

    if (typeof onProcess === 'function') {
      onProcess(child);
    }
    if (onData) {
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
    }
  });
}
```

In `services/node-agent/src/repo.js`:
```javascript
function run(cmd, args, opts = {}) {
  const { auth, onProcess, signal, ...execOpts } = opts;
  const secrets = auth ? [auth.username, auth.password, Buffer.from(`${auth.username}:${auth.password}`).toString('base64')] : [];
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      { ...execOpts, signal, env: { ...process.env, ...authEnv(auth) }, maxBuffer: 1024 * 1024 * 20 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = redact(String(stderr || err.message || '').trim().split('\n').slice(-4).join(' | '), secrets);
          const safe = new Error(`git ${args[0]} failed: ${detail}`);
          safe.code = err.code;
          safe.name = err.name;
          safe.stdout = redact(stdout, secrets);
          safe.stderr = redact(stderr, secrets);
          return reject(safe);
        }
        resolve({ stdout, stderr });
      }
    );
    if (typeof onProcess === 'function') {
      onProcess(child);
    }
  });
}
```

### 3.5 Exact Endpoint Replacement in `services/node-agent/src/index.js`

Move `const activeBuilds = new Map()` above line 482, then implement:

```javascript
// Map of active build sessions keyed by deploymentId
const activeBuilds = new Map();

app.post('/agent/deployments/:deploymentId/build-and-run', async (req, res) => {
  const { deploymentId } = req.params;
  const {
    repoUrl,
    branch,
    subdomain,
    rootDomain: reqRootDomain,
    deploymentsRootDomain: reqDeploymentsRootDomain,
    internalPort,
    envVars,
    cpuLimit,
    memoryLimit,
    backupRepoUrl,
    routingMode,
    exposureMode,
    startCommand,
    entryFile,
    frameworkPreset,
    publishedPort,
    builder,
    rootDir,
    nixpacksConfig,
  } = req.body || {};

  if (!repoUrl || !internalPort) {
    return res.status(400).json({ error: 'repoUrl and internalPort are required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  const emit = (event) => res.write(JSON.stringify(event) + '\n');

  // Register active build session
  const session = new ActiveBuildSession(deploymentId);
  activeBuilds.set(deploymentId, session);

  try {
    logger.info({ deploymentId, repoUrl, startCommand, exposureMode, builder, rootDir }, 'Starting build');
    
    // Phase 1: Fetch
    session.phase = 'fetch';
    emit({ phase: 'fetch', message: 'Fetching repository...' });
    const baseWorkspaceDir = await prepareWorkspace(
      deploymentId,
      repoUrl,
      branch || 'main',
      backupRepoUrl,
      {
        signal: session.signal,
        onProcess: (proc) => session.setCurrentProcess(proc),
      }
    );
    session.workspaceDir = baseWorkspaceDir;

    if (session.cancelled) throw new Error('Build cancelled by user');

    let workspaceDir = baseWorkspaceDir;
    if (rootDir && typeof rootDir === 'string') {
      const sanitizedRootDir = path.normalize(rootDir).replace(/^(\.\.(\/|\\|$))+/, '');
      const candidateDir = path.resolve(baseWorkspaceDir, sanitizedRootDir);
      if (candidateDir.startsWith(path.resolve(baseWorkspaceDir))) {
        workspaceDir = candidateDir;
      }
    }

    // Phase 2: Build
    session.phase = 'build';
    emit({ phase: 'build', message: 'Building container image...' });
    const imageTag = `shanutechx/${deploymentId}:latest`;
    await buildImage({
      workspaceDir,
      imageTag,
      envVars,
      startCommand,
      entryFile,
      frameworkPreset,
      builder,
      nixpacksConfig,
      signal: session.signal,
      onProcess: (proc) => session.setCurrentProcess(proc),
      onFileCreated: (filePath) => session.trackGeneratedFile(filePath),
      onRunnerContainer: (cntId) => { session.runnerContainerId = cntId; },
      onData: (chunk) => emit({ phase: 'build', log: chunk.toString() }),
    });

    if (session.cancelled) throw new Error('Build cancelled by user');

    // Phase 3: Run
    session.phase = 'run';
    emit({ phase: 'run', message: 'Starting container...' });
    const { containerId, containerName } = await runContainer({
      deploymentId,
      imageTag,
      internalPort,
      subdomain,
      rootDomain: reqRootDomain || ROOT_DOMAIN,
      deploymentsRootDomain: reqDeploymentsRootDomain,
      envVars,
      cpuLimit: cpuLimit ?? 1,
      memLimitMb: memoryLimit ?? 512,
      routingMode: routingMode || 'proxied',
      exposureMode: exposureMode || 'ssl_with_proxy',
      startCommand: startCommand || null,
      frameworkPreset: frameworkPreset || 'auto',
      publishedPort: publishedPort ?? null,
      agentPort: PORT,
      agentSecret: AGENT_SECRET,
    });

    logger.info({ deploymentId, containerId, subdomain }, 'Deployment complete');
    emit({ phase: 'done', containerId, containerName });
    res.end();
  } catch (err) {
    if (session.cancelled || err.name === 'AbortError' || err.message?.includes('cancelled')) {
      logger.info({ deploymentId }, 'Build was cancelled by user');
      emit({ phase: 'error', message: 'Build cancelled by user', cancelled: true });
    } else {
      logger.error({ deploymentId, err }, 'Build/run failed');
      emit({ phase: 'error', message: err.message, stderr: err.stderr });
    }
    res.end();
  } finally {
    activeBuilds.delete(deploymentId);
  }
});

app.post('/agent/deployments/:deploymentId/cancel-build', async (req, res) => {
  const { deploymentId } = req.params;
  const session = activeBuilds.get(deploymentId);

  if (!session) {
    return res.status(404).json({
      error: 'No active build found to cancel',
      deploymentId,
    });
  }

  try {
    logger.info({ deploymentId }, 'Cancelling active build');
    await session.kill();
    activeBuilds.delete(deploymentId);
    return res.json({
      ok: true,
      cancelled: true,
      deploymentId,
      message: 'Build cancelled successfully',
    });
  } catch (err) {
    logger.error({ deploymentId, err: err.message }, 'Error cancelling build');
    activeBuilds.delete(deploymentId);
    return res.status(500).json({
      error: `Failed to cancel build: ${err.message}`,
      deploymentId,
    });
  }
});
```

---

## 4. Feature 11: Container Lifecycle & Telemetry Analysis

### 4.1 Verification of Container Lifecycle Operations

The container lifecycle methods in `services/node-agent/src/docker.js` and their endpoints in `index.js` were thoroughly audited:

| Operation | `docker.js` Function | HTTP Route in `index.js` | Verification Result |
|---|---|---|---|
| **Create & Start** | `runContainer` (`docker.js:14-115`) | `POST /agent/deployments/:id/build-and-run` | Genuine Dockerode container creation with cgroups limits, `no-new-privileges`, `unless-stopped` |
| **Stop** | `stopContainer` (`docker.js:131-134`) | `POST /agent/deployments/:containerId/stop`<br>`POST /agent/containers/:containerId/stop` | Real `container.stop({ t: 10 })` |
| **Start** | `startContainer` (`docker.js:175-178`) | `POST /agent/deployments/:containerId/start`<br>`POST /agent/containers/:containerId/start` | Real `container.start()` |
| **Restart** | `restartContainer` (`docker.js:137-140`) | `POST /agent/deployments/:containerId/restart`<br>`POST /agent/containers/:containerId/restart` | Real `container.restart({ t: 10 })` |
| **Remove** | `stopAndRemove` (`docker.js:126-129`) | `DELETE /agent/deployments/:containerId`<br>`DELETE /agent/containers/:containerId` | Real `container.stop({ t: 5 })` + `container.remove({ force: true, v: true })` |
| **Inspect** | `inspectContainer` (`docker.js:152-155`) | `GET /agent/containers/:containerId/inspect` | Real `container.inspect()` returning state, config, network |
| **Pause** | `pauseContainer` (`docker.js:267-270`) | `POST /agent/containers/:containerId/pause` | Real `container.pause()` |
| **Unpause** | `unpauseContainer` (`docker.js:272-275`) | `POST /agent/containers/:containerId/unpause` | Real `container.unpause()` |
| **Rename** | `renameContainer` (`docker.js:277-280`) | `POST /agent/containers/:containerId/rename` | Real `container.rename({ name: newName })` |
| **Process List** | `containerTop` (`docker.js:283-286`) | `GET /agent/containers/:containerId/top` | Real `container.top()` |
| **Filesystem Diff** | `containerChanges` (`docker.js:289-292`) | `GET /agent/containers/:containerId/changes` | Real `container.changes()` |
| **List Containers** | `listContainers` (`docker.js:158-173`) | `GET /agent/containers` | Real `docker.listContainers({ all: true })` |

### 4.2 Streaming Logs & Demultiplexing Architecture

Docker's Engine API `/containers/{id}/logs?follow=1` multiplexes stdout and stderr over raw streams with an 8-byte binary header per packet when TTY is disabled:
- **Byte 0**: Stream type (`1` = stdout, `2` = stderr, `0` = stdin)
- **Bytes 1-3**: Reserved zero padding
- **Bytes 4-7**: 4-byte big-endian payload length

In `services/node-agent/src/docker.js:185-217`:
```javascript
async function streamLogs(containerId) {
  const container = docker.getContainer(containerId);
  const rawStream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100,
    timestamps: false,
  });

  const { PassThrough } = require('stream');
  const out = new PassThrough();
  docker.modem.demuxStream(rawStream, out, out);
  rawStream.on('end', () => out.end());
  rawStream.on('error', (err) => out.destroy(err));
  out.destroy = ((original) => (...args) => {
    if (typeof rawStream.destroy === 'function') rawStream.destroy();
    return original.apply(out, args);
  })(out.destroy.bind(out));
  return out;
}
```

**Verification Assessment**:
- `docker.modem.demuxStream(rawStream, out, out)` directly strips the 8-byte binary frames and writes clean stdout and stderr strings onto the `PassThrough` stream.
- In `index.js:619-680`, `streamLogs` is consumed by the SSE route `GET /agent/deployments/:containerId/logs/stream`, formatting clean lines as `data: {"type":"log","data":line,"timestamp":"..."}\n\n`.
- **Finding & Recommendation**:
  1. Add an alias export `streamContainerLogs = streamLogs` in `docker.js` to match alternate nomenclature.
  2. In `getContainerLogs` (non-streaming snapshots, lines 141-150), demux the buffer to ensure static log calls also do not contain binary header characters.
  3. Mount `GET /agent/containers/:containerId/logs/stream` in `index.js` alongside `GET /agent/deployments/:containerId/logs/stream`.

### 4.3 Container Resource Monitoring & Accurate Dockerode Calculations

We inspected:
1. `getContainerMetrics` (`docker.js:223-261`) — Single-shot metrics via `container.stats({ stream: false })`.
2. `streamContainerStats` (`docker.js:298-371`) — Live SSE metrics via `container.stats({ stream: true })`.

#### Verification of No Synthetic or Randomized Numbers
- A codebase grep for `Math.random` across `services/node-agent/src/` returned **0 matches**.
- Neither `docker.js` nor `index.js` uses simulated or mock metrics; all calculations derive directly from real Dockerode container stats.

#### CPU% Formula Verification
Both functions implement the official Docker CLI formula:
$$\text{CPU\%} = \frac{\text{cpu\_stats.cpu\_usage.total\_usage} - \text{precpu\_stats.cpu\_usage.total\_usage}}{\text{cpu\_stats.system\_cpu\_usage} - \text{precpu\_stats.system\_cpu\_usage}} \times \text{numCPUs} \times 100$$

In `docker.js:232-236`:
```javascript
const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
const onlineCpus = stats.cpu_stats?.online_cpus || (stats.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1;
const cpuUsagePercent =
  systemDelta > 0 && cpuDelta > 0 ? Math.round((cpuDelta / systemDelta) * onlineCpus * 100 * 100) / 100 : 0;
```
- In `streamContainerStats:317`: `cpus` was `raw.cpu_stats?.online_cpus || 1`. It should use the same fallback `(raw.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1` as `getContainerMetrics` to guarantee accuracy on systems where `online_cpus` is omitted by cgroups.

#### Memory Usage & Limit Calculation
- `raw.memory_stats.usage`: Raw memory usage in bytes.
- In Linux cgroups, cached page memory can be deducted for active working set accuracy:
  `const cache = raw.memory_stats?.stats?.inactive_file || raw.memory_stats?.stats?.total_inactive_file || 0;`
  `const memoryUsageBytes = Math.max(0, (raw.memory_stats?.usage || 0) - cache);`
- `raw.memory_stats.limit`: Raw memory limit in bytes.
- When unconstrained, Docker reports the host RAM (or very large numbers > 1TB). `docker.js` correctly filters values > 1TB as unconstrained.

#### Network I/O Calculation
In `streamContainerStats:326-331`:
```javascript
const nets = raw.networks || {};
let rxBytes = 0, txBytes = 0;
for (const iface of Object.values(nets)) {
  rxBytes += iface.rx_bytes || 0;
  txBytes += iface.tx_bytes || 0;
}
```
Sums network bytes across all active container virtual interfaces (`eth0`, `eth1`, etc.).

#### The Field Discrepancy in `getContainerMetrics`
Currently, `getContainerMetrics` returns:
```javascript
return {
  cpuUsagePercent,
  memoryUsedMb,
  memoryLimitMb,
  memoryUsagePercent,
  storageUsedGb,
  storageLimitGb: null,
  storageUsagePercent: 0,
  timestamp: new Date().toISOString(),
};
```
However, Tier 1 E2E tests (`m2-container-build.test.ts:275-297`) query `GET /agent/containers/:id/stats` and assert:
```javascript
assert.equal(typeof res.data.cpuPercent, 'number');
assert.equal(typeof res.data.memoryUsageBytes, 'number');
assert.equal(typeof res.data.memoryLimitBytes, 'number');
assert.equal(typeof res.data.networkRxBytes, 'number');
assert.equal(typeof res.data.networkTxBytes, 'number');
```
Because `getContainerMetrics` lacked these fields, querying `/stats` would fail assertions.
By unifying the output schema to include both byte-level metrics and MB percentages:
```javascript
async function getContainerMetrics(containerId) {
  const container = docker.getContainer(containerId);
  const [stats, info] = await Promise.all([
    container.stats({ stream: false }),
    container.inspect({ size: true }),
  ]);

  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
  const onlineCpus = stats.cpu_stats?.online_cpus || (stats.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1;
  const cpuPercent =
    systemDelta > 0 && cpuDelta > 0 ? Math.round((cpuDelta / systemDelta) * onlineCpus * 100 * 100) / 100 : 0;

  const memoryStats = stats.memory_stats || {};
  const cache = memoryStats.stats?.inactive_file || memoryStats.stats?.total_inactive_file || 0;
  const rawUsage = memoryStats.usage || 0;
  const memoryUsageBytes = Math.max(0, rawUsage - cache) || rawUsage;
  const memoryLimitBytes = memoryStats.limit || 0;

  const memoryUsedMb = Math.round(memoryUsageBytes / (1024 * 1024));
  const memoryLimitMb = memoryLimitBytes > 0 && memoryLimitBytes < 1024 * 1024 * 1024 * 1024
    ? Math.round(memoryLimitBytes / (1024 * 1024))
    : null;
  const memoryUsagePercent = memoryLimitMb ? Math.round((memoryUsedMb / memoryLimitMb) * 100 * 100) / 100 : 0;

  const nets = stats.networks || {};
  let networkRxBytes = 0, networkTxBytes = 0;
  for (const iface of Object.values(nets)) {
    networkRxBytes += iface.rx_bytes || 0;
    networkTxBytes += iface.tx_bytes || 0;
  }

  const blkStats = stats.blkio_stats?.io_service_bytes_recursive || [];
  let blockReadBytes = 0, blockWriteBytes = 0;
  for (const entry of blkStats) {
    if (entry.op === 'read' || entry.op === 'Read') blockReadBytes += entry.value || 0;
    if (entry.op === 'write' || entry.op === 'Write') blockWriteBytes += entry.value || 0;
  }

  const storageUsedGb = info.SizeRw != null ? Math.round((info.SizeRw / (1024 * 1024 * 1024)) * 100) / 100 : 0;

  return {
    containerId,
    cpuPercent,
    cpuUsagePercent: cpuPercent,
    memoryUsageBytes,
    memoryLimitBytes,
    memoryUsedMb,
    memoryLimitMb,
    memoryPercent: memoryUsagePercent,
    memoryUsagePercent,
    networkRxBytes,
    networkTxBytes,
    blockReadBytes,
    blockWriteBytes,
    pids: stats.pids_stats?.current || 0,
    storageUsedGb,
    storageLimitGb: null,
    storageUsagePercent: 0,
    timestamp: new Date().toISOString(),
  };
}
```
This satisfies all existing callers (`apps/api/src/lib/nodeAgentClient.ts:getResourceUsage`), all dashboard metric cards, and the E2E test assertions.

---

## 5. Verification Strategy & Test Protocol

To independently verify Features 10 and 11:

1. **Feature 10 Build Cancellation Verification**:
   - Register a simulated build process in `activeBuilds`.
   - Verify `POST /agent/deployments/:deploymentId/cancel-build` sends `SIGTERM` / `taskkill`, removes process from map, and returns `{ ok: true, cancelled: true, deploymentId }`.
   - Verify `POST /agent/deployments/dep_does_not_exist/cancel-build` returns `404` `{ error: 'No active build found to cancel', deploymentId }`.
   - Verify cancelling twice is idempotent and returns `404` on the second call.
2. **Feature 11 Container Lifecycle & Telemetry Verification**:
   - Query `GET /agent/containers/:containerId/stats`:
     - Assert `typeof cpuPercent === 'number'` and `cpuPercent >= 0`.
     - Assert `memoryUsageBytes > 0`, `memoryLimitBytes > 0`.
     - Assert `memoryUsageBytes / memoryLimitBytes <= 1.0`.
     - Assert `typeof networkRxBytes === 'number'`, `typeof networkTxBytes === 'number'`.
   - Query `GET /agent/containers/:containerId/stats/stream`:
     - Verify SSE stream headers: `text/event-stream`.
     - Verify streamed chunks deliver JSON objects with real metrics.
   - Run Tier 1 and Tier 3 tests:
     ```powershell
     npm run test:e2e:tier1
     node --test tests/e2e/tier1-features/m2-container-build.test.ts
     node --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts
     ```
