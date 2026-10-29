# Handoff Report: Feature 7 — Docker Persistent Volume Provisioning Specification

**Role**: Specification Miner (`teamwork_spec_miner_m2_1`)  
**Milestone**: Milestone 2: Container Management & Build System  
**Date**: 2026-10-28  
**Working Directory**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_spec_miner_m2_1`  
**Parent Conversation ID**: `3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`  

---

## 1. Observation

Direct code inspection of the authoritative files revealed the following exact state:

1. **`apps/api/src/routes/volumes.ts` (lines 42–67)**:
   ```typescript
   // POST /api/deployments/:id/volumes — Attach new persistent volume
   volumesRouter.post('/deployments/:id/volumes', async (req: AuthedRequest, res) => {
     const deployment = await loadOwnedDeployment(req, req.params.id);
     if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

     const parsed = createVolumeSchema.safeParse(req.body);
     if (!parsed.success) {
       return res.status(400).json({ error: parsed.error.flatten() });
     }

     const hostPath = `/var/lib/shanutechx/volumes/${deployment.id}/${parsed.data.name}`;

     const volume = await prisma.deploymentVolume.create({
       data: {
         deploymentId: deployment.id,
         name: parsed.data.name,
         hostPath,
         containerPath: parsed.data.containerPath,
         sizeGb: parsed.data.sizeGb,
       },
     });

     logger.info({ deploymentId: deployment.id, volumeName: volume.name, hostPath }, 'Attached persistent volume');

     res.status(201).json({ ok: true, volume });
   });
   ```
   **Observation**: `volumes.ts` computes `hostPath` and creates a row in PostgreSQL (`prisma.deploymentVolume.create`), but never invokes `node-agent` or any volume provisioning API.

2. **`services/node-agent/src/docker.js` (lines 14–34, 80–89)**:
   ```javascript
   async function runContainer({
     deploymentId,
     imageTag,
     internalPort,
     subdomain,
     rootDomain,
     deploymentsRootDomain,
     envVars = {},
     cpuLimit = 1, // cores
     memLimitMb = 512,
     routingMode = 'proxied',
     exposureMode = 'ssl_with_proxy',
     startCommand = null,
     frameworkPreset = 'auto',
     publishedPort = null,
     agentPort = undefined,
     agentSecret = undefined,
     privateNetworkName = undefined,
     containerAlias = undefined,
   }) {
     ...
     HostConfig: {
       PortBindings: portBindings,
       NanoCpus: cpuLimit * 1e9,
       Memory: memLimitMb * 1024 * 1024,
       RestartPolicy: { Name: 'unless-stopped' },
       NetworkMode: networks[0] || 'bridge',
       SecurityOpt: ['no-new-privileges:true'],
     },
     User: '1000:1000', // never run customer code as root
   ```
   **Observation**: `runContainer` parameter list does not include `volumes`. `HostConfig` does not include `Binds`. `User: '1000:1000'` enforces non-root container execution, requiring host mount directories to be writable by UID/GID 1000.

3. **`services/node-agent/src/index.js` (lines 366–377)**:
   ```javascript
   app.post('/agent/volumes', async (req, res) => {
     const { name, driver, labels } = req.body || {};
     if (!name) return res.status(400).json({ error: 'name is required' });
     try {
       const vol = await createVolume(name, driver, labels);
       logger.info({ name }, 'Volume created');
       res.status(201).json(vol);
     } catch (err) {
       logger.error({ err }, 'Failed to create volume');
       res.status(500).json({ error: err.message });
     }
   });
   ```
   **Observation**: `POST /agent/volumes` only expects `{ name, driver, labels }` for Docker named volume creation. It does not handle deployment volume parameters (`deploymentId`, `volumeName`, `hostPath`).

4. **`tests/e2e/tier1-features/m2-container-build.test.ts` (lines 58–67)**:
   ```typescript
   it('7.3: Node agent POST /agent/volumes provisions host volume path', async () => {
     const res = await server.client.post('/agent/volumes', {
       deploymentId,
       name: 'shared-assets',
       hostPath: `/var/lib/shanutechx/volumes/${deploymentId}/shared-assets`,
     });
     assertStatus(res, 201);
     assert.equal(res.data.success, true);
     assert.ok(res.data.path.includes(deploymentId));
   });
   ```
   **Observation**: The project's authoritative test assertions require `POST /agent/volumes` to accept `{ deploymentId, name, hostPath }` and return `{ success: true, path, name }` with HTTP 201.

5. **`apps/api/src/lib/nodeAgentClient.ts` (lines 82–108)**:
   In `buildAndRun()`, `params: BuildAndRunParams` does not query `prisma.deploymentVolume` and does not forward `volumes` to the `/agent/deployments/:id/build-and-run` endpoint.

---

## 2. Logic Chain

1. **Inference 1 (Disconnected Volume Defect)**: Based on Observation 1 and Observation 2, persistent volume metadata saved in PostgreSQL is completely disconnected from Docker Engine. Because `runContainer` lacks `HostConfig.Binds`, any container created runs with an ephemeral filesystem, directly violating requirement R2 and Acceptance Criteria 36.
2. **Inference 2 (API Contract Alignment)**: Based on Observation 3, 4, and `PROJECT.md:68`, `POST /agent/volumes` in `node-agent` must be enhanced to support dual-mode operation:
   - When `deploymentId` is present: Validate path confinement under `/var/lib/shanutechx/volumes/<deploymentId>/`, create the directory on the host (`fs.promises.mkdir` with mode `0o777`), set `chmod 0777` / `chown 1000:1000`, optionally create a Docker named volume, and return `{ success: true, path, name }` (HTTP 201).
   - When `deploymentId` is omitted: Fall back to existing `createVolume(name, driver, labels)` for Docker Dashboard management compatibility.
3. **Inference 3 (Atomic Control Plane Workflow)**: Based on Observation 1 and 4, `apps/api/src/routes/volumes.ts` must call `callNodeAgent(deployment.node, '/agent/volumes', 'POST', ...)` *before* creating the database record. If the node agent fails (offline node, disk full), the API must return HTTP 502 without creating an orphaned database row.
4. **Inference 4 (Non-root Permissions and Security Jail)**: Based on Observation 2 (`User: '1000:1000'`), if the host directory is created by Docker daemon default mechanisms, it is owned by `root:root (0755)`, which causes immediate permission denial when the non-root application container attempts to write. Creating the host directory with `0777` in `POST /agent/volumes` and `runContainer` resolves this issue. Restricting host paths to exclude `/var/run/docker.sock`, `/proc`, `/sys`, `/etc`, and `/dev` prevents host filesystem escapes.
5. **Inference 5 (Automatic Rebuild/Restart Persistence)**: Based on Observation 5, `nodeAgentClient.ts:buildAndRun` must automatically query `prisma.deploymentVolume` for the deployment (if `volumes` is not passed) and relay it in the payload. Node-agent's `build-and-run` handler then forwards `volumes` to `runContainer`, guaranteeing that all code deployments automatically mount attached volumes.

---

## 3. Caveats

1. **Host Directory vs Docker Named Volumes**: The platform uses host directory bind mounts (`/var/lib/shanutechx/volumes/<deploymentId>/<name>`) as the primary persistence mechanism (which matches `backup.js` volume snapshotting and `PROJECT.md:68`). Optionally registering a named Docker volume (`vol-<deploymentId>-<name>`) provides visibility in `docker volume ls` without changing the bind behavior.
2. **Container Hot-Mounting**: In Docker Engine, an already running container cannot receive a new volume bind mount without recreation. The specification documents that attaching a volume takes effect on next deployment restart or redeployment.
3. **No Code Implemented**: As Specification Miner, no application source files or node-agent scripts were modified. Complete implementation instructions and verified snippets are provided in `analysis.md`.

---

## 4. Conclusion

Feature 7 (Docker Persistent Volume Provisioning) has been fully investigated, probed, and specified across the control plane, node agent daemon, and container runtime:
1. `apps/api/src/routes/volumes.ts` is specified to validate duplicate mounts, verify compute node availability, call `node-agent` via `callNodeAgent`, and persist `prisma.deploymentVolume` only upon confirmed node provisioning.
2. `services/node-agent/src/index.js` `POST /agent/volumes` is specified to handle `{ deploymentId, volumeName, hostPath }`, validate path containment, create host directories with `0777` permissions for UID `1000:1000`, and return `{ success: true, path, name }`.
3. `services/node-agent/src/docker.js:runContainer` is specified to accept `volumes`, sanitize paths against restricted system files, and configure `HostConfig.Binds: [ '${hostPath}:${containerPath}:${mode || "rw"}' ]`.
4. `apps/api/src/lib/nodeAgentClient.ts:buildAndRun` is specified to automatically query and propagate attached volumes into deployment payloads.

---

## 5. Verification Method

To independently verify the specification and future implementation:

1. **Static Analysis & Type Checking**:
   ```powershell
   npm run build:sdk
   npm --prefix apps/api run build
   ```
2. **Unit Tests**:
   Verify node-agent volume path safety and read-only RBAC guards:
   ```powershell
   node --test tests/unit/nodeAgentBackupHttp.test.ts
   node --test tests/unit/deploymentFamilyReadOnly.test.ts
   ```
3. **E2E Feature Verification**:
   Run the dedicated Milestone 2 persistent volume tests:
   ```powershell
   npx ts-node tests/e2e/tier1-features/m2-container-build.test.ts
   npx ts-node tests/e2e/tier3-interactions/volume-container-persistence.test.ts
   ```
   - Test `7.1`: Verifies `POST /api/deployments/:id/volumes` creates and attaches persistent volume.
   - Test `7.2`: Verifies `GET /api/deployments/:id/volumes` lists volumes.
   - Test `7.3`: Verifies Node Agent `POST /agent/volumes` provisions host volume path and returns `{ success: true, path }`.
   - Test `T3.8`: Verifies running container with volume bind mounts mounts host path to container path.
   - Test `T3.9`: Verifies container restart preserves persistent volume binding without data wipe.
