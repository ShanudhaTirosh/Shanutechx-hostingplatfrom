# Handoff Report: Milestone 2 — Feature 10 (Build Cancellation) & Feature 11 (Container Lifecycle & Telemetry)

**Agent**: `teamwork_explorer_m2_3`  
**Milestone**: Milestone 2: Container Management & Build System  
**Date**: 2026-10-28  
**Parent Conversation ID**: `3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`  
**Handoff Type**: Hard (Investigation & Technical Design Complete)

---

## 1. Observation

1. **`activeBuilds` Map Never Populated in `build-and-run`**:
   - Location: `services/node-agent/src/index.js:482-589`.
   - Observation: `const activeBuilds = new Map()` is declared at line 573, immediately preceding `cancel-build` (line 575) and after `build-and-run` (lines 482-571).
   - In `build-and-run` (lines 482-571), there is zero interaction with `activeBuilds` (`activeBuilds.set()` and `activeBuilds.delete()` are never invoked).
   - In `cancel-build` (lines 575-589):
     ```javascript
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
     ```
   - Because `activeBuilds.set()` is never called, `activeBuilds.get(deploymentId)` is always `undefined`. Calling `POST /agent/deployments/:deploymentId/cancel-build` always returns `No active build process found or already stopped` without taking any action.

2. **Subprocess Encapsulation and Lack of Cancellation Hooks in `build.js` and `repo.js`**:
   - Location: `services/node-agent/src/build.js:5-25` and `services/node-agent/src/repo.js:65-87`.
   - In `build.js:5-25`:
     ```javascript
     function run(cmd, args, opts = {}) {
       return new Promise((resolve, reject) => {
         const child = execFile(cmd, args, { ...opts, maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => { ... });
         if (opts.onData) {
           child.stdout?.on('data', opts.onData);
           child.stderr?.on('data', opts.onData);
         }
       });
     }
     ```
   - The returned Promise only resolves or rejects upon child process exit. The `child` process handle and PID are not returned or surfaced to the caller.
   - Neither function accepts an `AbortSignal` or an `onProcess` callback, preventing callers from referencing or terminating the active process.

3. **Status Code and Response Schema Discrepancy for `cancel-build`**:
   - Location: `tests/e2e/tier1-features/m2-container-build.test.ts:244-254`.
   - The test asserts:
     ```typescript
     it('10.2: Cancelling a non-existent or already finished build returns 404 with diagnostic error', async () => {
       const res = await server.client.post('/agent/deployments/dep_does_not_exist/cancel-build');
       assertStatus(res, 404);
       assert.ok(res.data.error.includes('No active build found'));
     });

     it('10.3: Cancel build endpoint response includes deploymentId and cancellation status', async () => {
       const res = await server.client.post('/agent/deployments/dep_test_cancel/cancel-build');
       assert.equal(typeof res.data, 'object');
       assert.equal(res.data.deploymentId, 'dep_test_cancel');
     });
     ```
   - `services/node-agent/src/index.js:588` currently returns HTTP 200 `{ ok: true, message: 'No active build process found or already stopped' }`, failing both the status 404 requirement and the `deploymentId` property expectation.

4. **Process Tree Termination and Artifact Cleanup Deficiencies**:
   - Simply calling `child.kill()` terminates only the top-level process. When builders (e.g., `railpack`, `nixpacks`, `npm`, `cargo`, `docker`) spawn child sub-processes, orphaned descendant processes remain active.
   - Furthermore, terminating a process mid-flight can leave orphaned git lock files (`.git/index.lock`), auto-generated `Dockerfile`s, or auto-generated `nixpacks.toml` in the workspace directory.

5. **Dockerode Log Streaming & Demultiplexing in `docker.js`**:
   - Location: `services/node-agent/src/docker.js:185-217`.
   - `streamLogs` correctly demuxes multiplexed Docker stdout and stderr frames via `docker.modem.demuxStream(rawStream, out, out)`.
   - In `index.js:619-680`, `streamLogs` is wired to the SSE endpoint `GET /agent/deployments/:containerId/logs/stream`.
   - However, in `getContainerLogs` (`docker.js:141-150`), static snapshots read the raw Buffer without demuxing, which can preserve raw 8-byte frame headers if TTY is false.

6. **Dockerode Resource Telemetry & Calculations in `docker.js`**:
   - Location: `services/node-agent/src/docker.js:223-261` (`getContainerMetrics`) and `docker.js:298-371` (`streamContainerStats`).
   - Genuineness: Codebase grep for `Math.random` across `services/node-agent/src/` returned **0 matches**. All telemetry derives directly from Dockerode `container.stats()`.
   - CPU% Formula: Implements the exact standard Docker CLI formula `(cpuDelta / systemDelta) * numCPUs * 100`.
   - Schema Mismatch: `getContainerMetrics` omits raw byte fields (`memoryUsageBytes`, `memoryLimitBytes`, `networkRxBytes`, `networkTxBytes`, `cpuPercent`), which are required by `m2-container-build.test.ts:275-297`.

---

## 2. Logic Chain

1. **Step 1**: From Observation 1, because `activeBuilds.set()` is never called in `build-and-run`, the `activeBuilds` map remains permanently empty.
2. **Step 2**: When a cancellation request arrives at `POST /agent/deployments/:deploymentId/cancel-build`, `activeBuilds.get(deploymentId)` evaluates to `undefined`.
3. **Step 3**: The handler skips lines 579-586 and executes line 588, returning HTTP 200 without signaling the running build process.
4. **Step 4**: From Observation 2, even if `activeBuilds.set` were called with the return value of `buildImage`, `buildImage` returns only after the build has already finished or failed. The underlying `run()` function in `build.js` and `repo.js` hides the spawned `child_process.ChildProcess` instance inside a Promise closure and does not link an `AbortSignal`.
5. **Step 5**: Therefore, cancellation requires:
   - Introducing an `ActiveBuildSession` registered in `activeBuilds` at the start of `build-and-run`.
   - Plumbing an `AbortController.signal` and an `onProcess(child)` callback through `prepareWorkspace` and `buildImage`.
   - Implementing cross-platform process tree termination (`terminateProcessTree`: `taskkill /T /F` on Windows; process group `SIGTERM` followed by `SIGKILL` on POSIX).
   - Aligning `cancel-build` status and JSON response to return HTTP 404 with `{ error: 'No active build found to cancel', deploymentId }` when absent, and HTTP 200 `{ ok: true, cancelled: true, deploymentId }` when cancelled.
6. **Step 6**: From Observation 5 and 6, `services/node-agent/src/docker.js` connects to real Dockerode without synthetic metrics. However, single-shot `getContainerMetrics` omits byte-level memory and network fields expected by `GET /agent/containers/:containerId/stats`. Unifying the return payload of `getContainerMetrics` to include both byte-level metrics and MB percentages satisfies both `ResourceMetrics` and E2E test assertions.

---

## 3. Caveats

- **Host Platform Differences**: In local Windows development environments, child process termination uses `taskkill /PID <pid> /T /F`. In production Linux container environments, process group signaling (`process.kill(-pid, signal)`) is utilized. The proposed `terminateProcessTree` detects `process.platform === 'win32'` and handles both seamlessly.
- **Docker BuildKit Cancellation**: When `docker build` (or BuildKit) is killed, Docker Engine may take a brief moment to abort cached intermediate steps; force-cleaning partial images tagged `shanutechx/${deploymentId}:latest` ensures the slot is clear.
- **No Caveats Regarding Real Docker Data**: Verification confirmed Dockerode queries real container metrics without any mock data in `docker.js`.

---

## 4. Conclusion

1. **Feature 10 (Build Cancellation)** is non-functional in the current codebase because `activeBuilds.set()` is omitted, child processes are encapsulated inside unresolved Promises, and `cancel-build` does not terminate process trees or return expected HTTP 404/200 contract statuses.
2. The exact implementation specified in `analysis.md` (ActiveBuildSession, AbortController cascading, `onProcess` hooks in `build.js`/`repo.js`, `terminateProcessTree`, and artifact cleanup) resolves this defect completely.
3. **Feature 11 (Container Lifecycle & Telemetry)** is backed by real Dockerode methods and accurate delta calculations. Expanding `getContainerMetrics` to return raw byte metrics alongside MB values brings `/agent/containers/:id/stats` into 100% compliance with Tier 1 E2E tests and dashboard consumers.

---

## 5. Verification Method

To verify the findings and subsequent implementation:

1. **Run Tier 1 Container & Build Test Suite**:
   ```powershell
   node --test tests/e2e/tier1-features/m2-container-build.test.ts
   ```
   - Test 10.1: Verifies active build cancellation.
   - Test 10.2: Verifies cancelling non-existent build returns 404 with diagnostic error.
   - Test 10.3: Verifies cancel response includes `deploymentId` and cancellation status.
   - Test 10.4: Verifies build slot is freed in `activeBuilds`.
   - Test 10.5: Verifies idempotency of consecutive cancellations.
   - Tests 11.1-11.3: Verify live container resource metrics (`cpuPercent`, `memoryUsageBytes`, `memoryLimitBytes`, `networkRxBytes`, `networkTxBytes`).

2. **Run Tier 3 Cross-Feature Interaction Suite**:
   ```powershell
   node --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts
   ```
   - Test T3.4: Verifies build cancellation contract against the deployment lifecycle.

3. **Inspect Implementation Files**:
   - `services/node-agent/src/index.js`: Inspect `activeBuilds` registration, `build-and-run` lifecycle, and `cancel-build` handler.
   - `services/node-agent/src/build.js`: Inspect `run()` opts (`signal`, `onProcess`).
   - `services/node-agent/src/repo.js`: Inspect `run()` opts (`signal`, `onProcess`).
   - `services/node-agent/src/docker.js`: Inspect `streamLogs` and `getContainerMetrics`.
