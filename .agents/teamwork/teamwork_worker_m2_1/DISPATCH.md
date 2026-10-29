## 2026-10-28T15:16:44Z
You are the Milestone 2 Implementation Worker (`teamwork_worker_m2_1`).
Your parent is the Project Orchestrator (`3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`).
Your working directory is `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_worker_m2_1\`.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Objective
Implement and verify all 5 features of Milestone 2 (Container Management & Build System):
1. **Feature 7 (Docker Persistent Volume Provisioning)**:
   - `apps/api/src/routes/volumes.ts`: Validate node assignment, duplicate names/paths, invoke `callNodeAgent(deployment.node, '/agent/volumes', 'POST', { deploymentId, name, hostPath, sizeGb })`, and save database record only upon successful node provisioning. Add directory traversal protection (`!p.includes('..')`).
   - `services/node-agent/src/index.js`: Implement `POST /agent/volumes` supporting `{ deploymentId, volumeName, hostPath }`, sanitize path under `/var/lib/shanutechx/volumes/<deploymentId>/`, create host directory with `0777` permissions (for non-root `1000:1000` write access), and return `{ success: true, path, name }` (HTTP 201).
   - `services/node-agent/src/docker.js`: In `runContainer`, accept `volumes` parameter, validate against forbidden paths (`/var/run/docker.sock`, `/proc`, `/sys`), format `HostConfig.Binds: [ '${vol.hostPath}:${vol.containerPath}:${vol.mode || "rw"}' ]`.
   - `apps/api/src/lib/nodeAgentClient.ts`: In `buildAndRun`, query `prisma.deploymentVolume` and forward `volumes` in deployment payloads so redeployments mount volumes.

2. **Feature 8 (Direct Image Deployment Route)**:
   - `services/node-agent/src/index.js`: Implement `POST /agent/deployments/:id/run-image`. Validate body (HTTP 400 with `{ error: 'image is required' }` if missing), inspect image cache with `docker.getImage(image).inspect()`, pull if missing using resilient `pullImage`, bind persistent volumes (`HostConfig.Binds`), map exposed ports, enforce CPU/memory limits, start container via `docker.runContainer`, and return HTTP 201 `{ containerId, containerName, status: 'running', deploymentId, image, ports, volumes, resources }`.
   - `services/node-agent/src/docker.js`: Update `pullImage` to avoid appending `:latest` when an image already specifies a tag or digest. Update `runContainer` to accept `ports` and configure `PortBindings` and `ExposedPorts`.
   - `apps/api/src/routes/dockerDeployments.ts`: Clean up error handling.

3. **Feature 9 (Build Secrets Protection)**:
   - `services/node-agent/src/build.js`: In `executeDockerBuild`, remove the loop that iterates over runtime `envVars` and injects `--build-arg`. Only inject declared `buildArgs` or variables explicitly prefixed with `BUILD_ARG_`. Runtime secrets must remain strictly in container execution memory (`runContainer` Docker Engine `Env: [...]`), never baked into image layer history.

4. **Feature 10 (Build Cancellation Tracking)**:
   - `services/node-agent/src/index.js`: Register active build sessions in `activeBuilds.set(deploymentId, session)` at the start of `POST /agent/deployments/:deploymentId/build-and-run` and clean up upon completion/failure.
   - `services/node-agent/src/build.js` & `repo.js`: Plumb `opts.signal` (AbortSignal) and `opts.onProcess(child)` into `run()` so callers can track and kill the child process.
   - Implement cross-platform process tree termination (`terminateProcessTree`: `taskkill /T /F` on Windows; process group `SIGTERM`/`SIGKILL` on POSIX) and clean up workspace git lock files (`.git/index.lock`), auto-generated Dockerfiles, and `nixpacks.toml`.
   - In `POST /agent/deployments/:deploymentId/cancel-build`: Return HTTP 404 `{ error: 'No active build found to cancel', deploymentId }` if absent/already stopped, and HTTP 200 `{ ok: true, cancelled: true, deploymentId }` if cancelled.

5. **Feature 11 (Container Lifecycle & Telemetry)**:
   - `services/node-agent/src/docker.js`: Unify `getContainerMetrics` and `streamContainerStats` to return raw byte metrics (`memoryUsageBytes`, `memoryLimitBytes`, `networkRxBytes`, `networkTxBytes`, `cpuPercent`) alongside formatted MB metrics so `/agent/containers/:id/stats` complies with E2E test assertions. Ensure genuine Dockerode stats are preserved.

### Exclusive Write Boundaries
You have exclusive write ownership of:
- `services/node-agent/src/index.js`
- `services/node-agent/src/docker.js`
- `services/node-agent/src/build.js`
- `services/node-agent/src/repo.js`
- `apps/api/src/routes/volumes.ts`
- `apps/api/src/lib/nodeAgentClient.ts`
- `apps/api/src/routes/dockerDeployments.ts`
DO NOT modify files outside this list unless strictly necessary for integration.

### Authoritative Reference Files (READ FIRST)
1. `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\ORIGINAL_REQUEST.md` (Verbatim user request)
2. `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\orchestrator\PROJECT.md` (Architecture & contracts)
3. `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_spec_miner_m2_1\analysis.md` & `handoff.md` (Feature 7 specs & code)
4. `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m2_2\analysis.md` & `handoff.md` (Features 8 & 9 specs & code)
5. `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m2_3\analysis.md` & `handoff.md` (Features 10 & 11 specs & code)

### Verification Requirements
Execute real test commands and document exact terminal outputs in `handoff.md`:
1. `npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts`
2. `npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts`
3. `npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts`
4. `npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts`
5. `npm run test:unit`

### Deliverables
- Maintain `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_worker_m2_1\progress.md` with timestamps.
- Write full 5-component `handoff.md` (Observation, Logic Chain, Caveats, Conclusion, Verification Method) in your folder.
- Communicate results back to parent (`3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`) using `send_message`.

## 2026-10-28T15:27:49Z
**Context**: Milestone 2 Implementation
**Content**: Status check from orchestrator. Please report your current progress on Features 7–11 and update your progress.md with your latest timestamp and completed steps.
**Action**: Reply with brief status update and update progress.md.
