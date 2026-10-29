# Forensic Audit Report: Milestone 2 — Container Management & Build System

## 1. Observation
### Target & Scope
- **Work Product**: Milestone 2 codebase changes across `apps/api/` and `services/node-agent/`
- **Integrity Mode**: `development` (per `ORIGINAL_REQUEST.md` line 7)
- **Profile**: General Project
- **Audit Verdict**: **CLEAN**

### Source Code Inspection
Direct inspection was conducted on all 7 files touched in Milestone 2:
1. `apps/api/src/routes/volumes.ts`:
   - Enforces directory traversal protection (`..`) and checks that container paths start with `/`.
   - Prohibits targeting system root paths: `FORBIDDEN_CONTAINER_PATHS = new Set(['/', '/proc', '/sys', '/dev', '/etc', '/var/run', '/var/run/docker.sock'])`.
   - Prevents duplicate volume names or mount paths per deployment via Prisma query before provisioning.
   - Verifies node assignment and invokes `callNodeAgent(node, '/agent/volumes', 'POST', ...)` before recording the volume in the database.
   - Returns 502 with diagnostic details if node-agent provisioning fails.
2. `apps/api/src/lib/nodeAgentClient.ts`:
   - Added `volumes` parameter to `BuildAndRunParams`.
   - Automatically queries `prisma.deploymentVolume` for the deployment when `volumes` is not provided in parameters, mapping entries to `{ hostPath, containerPath, mode: 'rw' }` and embedding them into the build payload.
3. `apps/api/src/routes/dockerDeployments.ts`:
   - Retrieves `prisma.deploymentVolume` records for the deployment and passes the volume binds to `POST /agent/deployments/:id/run-image`.
   - Erroneous git clone fallback removed; on node-agent failure, marks deployment as `failed` and returns HTTP 502 with diagnostic detail.
4. `services/node-agent/src/repo.js`:
   - Plumbed `signal` (AbortSignal) and `onProcess` child process callback through `run()` via `execFile`.
   - Updated `prepareWorkspace` to pass `opts` (`signal`, `onProcess`) to all Git commands (`clone`, `fetch`, `reset`), enabling immediate process termination upon cancellation.
   - Credentials redacted from error messages, stderr, and stdout.
5. `services/node-agent/src/build.js`:
   - **Zero Secret Leakage Verified**: `executeDockerBuild` and `buildImage` filter out runtime `envVars`. Runtime `envVars` are NEVER passed as `--build-arg` or to nixpacks/railpack. Only declared `buildArgs` or environment keys explicitly prefixed with `BUILD_ARG_` are injected at build time.
   - Plumbed `signal`, `onProcess`, `onFileCreated`, and `onRunnerContainer` through all build tiers (Railpack, Nixpacks, containerized Nixpacks runner, and Docker Engine).
6. `services/node-agent/src/docker.js`:
   - **Zero Fake/Synthetic Telemetry Verified**: Grepped for `Math.random` — 0 matches found in `docker.js`.
   - `runContainer`: mounts volumes into `HostConfig.Binds`, rejects restricted system paths, ensures host directory permissions (`0777`) for non-root containers (`User: '1000:1000'`), maps ports, applies CPU (`NanoCpus`) and memory limits.
   - `pullImage`: preserves explicit tags (`redis:7-alpine`) and digests (`@sha256:...`).
   - `getContainerMetrics` & `streamContainerStats`: calculates real CPU utilization delta against system delta and online CPUs (`(cpuDelta / systemDelta) * onlineCpus * 100`), calculates memory usage excluding inactive file cache (`usage - inactive_file`), calculates block I/O bytes and network I/O bytes from raw Docker stats.
   - Added export `streamContainerLogs: streamLogs`.
7. `services/node-agent/src/index.js`:
   - Cross-platform process tree termination via `terminateProcessTree(pid)` (`taskkill /PID <pid> /T /F` on Windows; process group SIGTERM/SIGKILL on POSIX).
   - `ActiveBuildSession` tracks running child process, workspace dir, generated files, and runner containers; registered in `activeBuilds` map during `build-and-run` with `finally` cleanup.
   - `POST /agent/volumes`: validates volume name and deploymentId regex, enforces directory traversal restrictions, creates directory with `0777` permissions, and creates Docker named volume via `docker.createVolume`.
   - `POST /agent/deployments/:id/run-image`: checks local Docker cache via `docker.inspectImage`, pulls via `docker.pullImage` if absent, launches via `runContainer` with binds and ports, returns 201 with containerId and containerName.
   - `POST /agent/deployments/:id/cancel-build`: checks `activeBuilds.get(deploymentId)`, returns 404 if not found; calls `session.kill()` (aborts signal, kills child process tree, removes runner container, cleans up generated files and stale git locks), returns 200 `{ ok: true, cancelled: true, deploymentId }`.
   - `/agent/containers/:id/stats`: fetches genuine live metrics via `getContainerMetrics`.

### Independent Test Execution Results
All test suites were executed independently from the terminal:
1. `npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts`:
   - **25 tests passed**, 0 failed, 0 skipped, 0 cancelled (duration: 9658 ms, exit code 0).
2. `npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts`:
   - **15 tests passed**, 0 failed, 0 skipped, 0 cancelled (duration: 70485 ms, exit code 0).
3. `npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts`:
   - **5 tests passed**, 0 failed, 0 skipped, 0 cancelled (duration: 54618 ms, exit code 0).
4. `npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts`:
   - **5 tests passed**, 0 failed, 0 skipped, 0 cancelled (duration: 11730 ms, exit code 0).
5. `npx tsx --test tests/unit/nodeAgentRepoAdversarial.test.ts`:
   - **8 tests passed**, 0 failed, 0 skipped, 0 cancelled (duration: 14172 ms, exit code 0).

**Total Verified**: 58 tests passed, 0 failed, 0 skipped.

---

## 2. Logic Chain
1. *Absence of Hardcoded Cheats*:
   - Static analysis of touched files shows no hardcoded test IDs, fixed strings matching test expectations, or facade returns.
   - Input validation in API routes strictly rejects invalid payloads (non-slash paths, paths containing `..`, system directories, negative or excessive storage limits, missing parameters).
   - In `dockerDeployments.ts`, the previously broken fallback path that attempted `git clone image://...` was completely replaced by structured error logging, status marking as `failed`, and returning 502 with actual error diagnostics.
2. *Verification of Build Pipeline Secret Isolation*:
   - In `build.js`, `executeDockerBuild` only serializes keys that exist in `buildArgs` or start with `BUILD_ARG_`. The entire runtime `envVars` object is isolated to runtime container execution (`runContainer` Docker `Env: [...]`), preventing secrets from leaking into `docker history` or build logs.
3. *Verification of Real Telemetry*:
   - In `docker.js`, zero calls to `Math.random()` exist. All calculations for `cpuPercent`, `memoryUsageBytes`, `networkRxBytes`, `networkTxBytes`, `blockReadBytes`, and `blockWriteBytes` are mathematically derived from raw Dockerode container stats.
4. *Verification of Process Cancellation*:
   - `ActiveBuildSession` correctly terminates child processes across both Windows (`taskkill /PID /T /F`) and POSIX (`SIGTERM` -> `SIGKILL` on process group), cleans up temporary generated build files (`Dockerfile`, `nixpacks.toml`), and removes stale `.git/*.lock` files so subsequent builds do not hang.
5. *Empirical Verification*:
   - All 5 test suites were executed independently and confirmed to pass with exit code 0 and genuine assertions.

---

## 3. Caveats
- The unit test suite `tests/unit/deploymentFamilyReadOnly.test.ts` (outside Milestone 2 file boundary) fails due to uncompleted features assigned to Milestones 4 and 5 (`apps/api/src/routes/deployments.ts` and `apps/api/src/lib/cloudflare.ts`). This is expected and documented in the project plan.
- Testing in E2E suites uses the `test-server.ts` in-memory harness that mocks Prisma and Node agent responses for high-speed automated validation; however, the actual node-agent source code was directly audited and verified to interact authentically with the real filesystem and Docker Engine API (Dockerode).

---

## 4. Conclusion
**Audit Verdict: CLEAN**

Milestone 2 (Container Management & Build System) has satisfied all forensic integrity criteria:
- Authentic Docker volume provisioning with directory traversal and system path guards.
- Genuine direct image deployment route (`run-image`) without fake fallback logic.
- Robust secret isolation in the build engine preventing runtime secrets in build arguments.
- Real cross-platform build cancellation and artifact cleanup.
- Authentic Docker telemetry with 0 fake or random values.
- 100% pass rate across 58 independent test cases.

The work product is approved for milestone acceptance.

---

## 5. Verification Method
To independently reproduce the audit verification, run the following commands:

```bash
# 1. Static check for Math.random in docker.js
powershell -Command "Select-String -Path 'services/node-agent/src/docker.js' -Pattern 'Math.random'"
# Expected output: (empty, 0 matches)

# 2. Tier 1: Container & Build System features (25 tests)
npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts

# 3. Tier 2: Boundary conditions & input validation (15 tests)
npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts

# 4. Tier 3: Volume provisioning & persistence interactions (5 tests)
npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts

# 5. Tier 3: Auth & deployment lifecycle interactions (5 tests)
npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts

# 6. Unit: Adversarial repo branch fetch & error retention (8 tests)
npx tsx --test tests/unit/nodeAgentRepoAdversarial.test.ts
```
