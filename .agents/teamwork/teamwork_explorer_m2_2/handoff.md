# Handoff Report: Milestone 2 — Feature 8 (Direct Image Deployment) & Feature 9 (Build Secrets Protection)

**Date**: 2026-10-28  
**Author**: `teamwork_explorer_m2_2`  
**Working Directory**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m2_2\`  
**Target Milestone**: Milestone 2 (Container Management & Build System)  
**Parent Agent ID**: `3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`  

---

## 1. Observation

### Observation 1.1: Missing Route and Catastrophic Fallback in `dockerDeployments.ts`
- **File & Lines**: `apps/api/src/routes/dockerDeployments.ts:121-141`
- **Verbatim Code**:
  ```typescript
  // Run container via node-agent
  const result = await callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`, 'POST', {
    image,
    deploymentId: deployment.id,
    subdomain,
    internalPort,
    envVars: envVars || {},
    exposureMode: effectiveExposureMode,
    cpuLimit,
    memLimitMb: memoryLimit,
  }).catch(async (err) => {
    logger.warn({ err, deploymentId: deployment.id }, 'run-image node-agent endpoint failed, trying buildAndRun fallback');
    return buildAndRun(selectedNode, {
      deploymentId: deployment.id,
      repoUrl: `image://${image}`,
      subdomain,
      internalPort,
      envVars,
      exposureMode: effectiveExposureMode,
    }, () => {});
  });
  ```
- **File & Lines in Node Agent**: `services/node-agent/src/index.js:477-571`
  - Express routes in `services/node-agent/src/index.js` define `POST /agent/deployments/:deploymentId/build-and-run` (line 482) and `POST /agent/deployments/:deploymentId/cancel-build` (line 575).
  - The route `POST /agent/deployments/:id/run-image` is completely missing.
  - In `services/node-agent/src/repo.js:14-25`, `prepareWorkspace` invokes `git clone image://${image}`, which immediately throws: `fatal: Unable to find remote helper for 'image'`.

### Observation 1.2: Secret Leaking via `--build-arg` in Docker Build
- **File & Lines**: `services/node-agent/src/build.js:242-248`
- **Verbatim Code**:
  ```javascript
  const dockerArgs = ['build', '-t', imageTag, '.'];
  for (const [key, value] of Object.entries(envVars)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }

  await run('docker', dockerArgs, { cwd: workspaceDir, onData });
  log('Docker Engine build succeeded!');
  return { imageTag, builder: dockerfileInfo.isGenerated ? 'smart-dockerfile' : 'dockerfile' };
  ```
- **Behavior**: Every key/value in `envVars` (including database passwords, tokens, API keys) is serialized as `--build-arg` command line arguments and baked into intermediate image layers.

### Observation 1.3: Tag Mangling in `pullImage`
- **File & Lines**: `services/node-agent/src/docker.js:391-395`
- **Verbatim Code**:
  ```javascript
  async function pullImage(imageName, tag = 'latest') {
    const fullName = `${imageName}:${tag}`;
    return new Promise((resolve, reject) => {
      docker.pull(fullName, (err, stream) => {
  ```
- **Behavior**: When passed an image that already has a tag (e.g. `redis:7-alpine`), `fullName` becomes `redis:7-alpine:latest`, causing Docker daemon pull failures (`invalid reference format`).

### Observation 1.4: Omission of Volume Mounts and Port Arrays in `runContainer`
- **File & Lines**: `services/node-agent/src/docker.js:14-89`
- `runContainer` parameter list does not include `volumes` or `ports`.
- In `containerConfig.HostConfig` (lines 80–87), `Binds` is omitted entirely.
- In `apps/api/src/routes/volumes.ts:52-62`, persistent volumes are saved to Prisma (`deploymentVolume`), but never mounted into Docker containers.

### Observation 1.5: E2E Test Contract Requirements
- **File & Lines**: `tests/e2e/tier1-features/m2-container-build.test.ts:98-152, 215-229`
  - Test 8.1: `POST /agent/deployments/:id/run-image` accepts `{ image, envVars, ports }`, returns `201`, `containerId`, `status: 'running'`, `image`.
  - Test 8.2: Injects environment variables and returns `deploymentId`.
  - Test 8.3: Attaches volume bind mounts (`volumes: [{ hostPath, containerPath, mode: 'rw' }]`).
  - Test 8.4: Passes resource limits (`resources: { cpuLimit, memoryLimitMb }`).
  - Test 8.5: Missing `image` returns `400` with `{ error: 'image is required' }`.
  - Boundary Test T2.8 (`limits-and-validation.test.ts:105`): Missing body returns `400`.
  - Test 9.5: Specification requires that runtime environment secrets (`DB_PASSWORD`, `API_SECRET`) must never appear in `docker build --build-arg`.

---

## 2. Logic Chain

1. **Failure of Direct Image Deployments** (Referencing Observations 1.1, 1.3, 1.5):
   - When a user deploys a prebuilt Docker image (e.g. `redis:7-alpine` or `nginx:alpine`), `dockerDeployments.ts` invokes `callNodeAgent(..., '/agent/deployments/:id/run-image', 'POST', ...)`.
   - Because `services/node-agent/src/index.js` lacks any handler for `/agent/deployments/:id/run-image`, Express returns HTTP 404.
   - The `.catch()` block in `dockerDeployments.ts` attempts to recover by routing through `buildAndRun` with `repoUrl: 'image://${image}'`.
   - `buildAndRun` invokes `prepareWorkspace` in `services/node-agent/src/repo.js`, which tries `git clone image://...`.
   - Git fails fatally because `image://` is not a valid transport protocol.
   - **Conclusion**: Implementing `POST /agent/deployments/:id/run-image` in `services/node-agent/src/index.js` resolves this failure chain and eliminates the broken fallback.

2. **Image Pulling & Container Start Flow** (Referencing Observations 1.3, 1.4, 1.5):
   - Direct image deployments require pulling the specified container image if it does not already exist in the local Docker daemon image store.
   - Using `docker.getImage(image).inspect()`, the agent can check if the image is cached. If not found, it calls `pullImage(image)`.
   - `pullImage` in `docker.js` must be updated to avoid appending `:latest` when an image already specifies a tag or digest (e.g. `imageName.lastIndexOf(':') > imageName.lastIndexOf('/')`).
   - `runContainer` in `docker.js` must accept `volumes` and `ports`, populating `HostConfig.Binds` and `HostConfig.PortBindings`.
   - The route handler responds with HTTP 201 containing `{ containerId, containerName, status: 'running', deploymentId, image, ports, volumes, resources }`.

3. **Elimination of Secret Leaks in Docker Builds** (Referencing Observations 1.2, 1.5):
   - `--build-arg` flags passed to `docker build` are stored in the image configuration metadata and are visible in cleartext via `docker history --no-trunc <image>` and `docker inspect <image>`.
   - Runtime secrets (passwords, tokens, keys) belong strictly in container execution memory (`runContainer` Docker Engine `Env: [...]`), NOT in immutable image layers.
   - By creating a separate `buildArgs` parameter in `executeDockerBuild` and `buildImage`, and only forwarding explicitly declared build arguments (or variables prefixed with `BUILD_ARG_`), runtime secrets in `envVars` are excluded from the `docker build` argument list.

---

## 3. Caveats

1. **Host Directory Permissions for Volume Mounts**: When `volumes` binds host paths like `/var/lib/shanutechx/volumes/<id>/<name>`, the target directory on the node host must exist and have appropriate file permissions (owned by `1000:1000` or accessible by non-root containers) before container start.
2. **Private Container Registries**: The current design uses public Docker image names or credentials configured in Docker daemon's `~/.docker/config.json`. Private registry authentication parameters (username/password or auth tokens) can be added to `pullImage` options if private registry deployments are required.
3. **Build Cancellation (Feature 10)**: While observing `node-agent/src/index.js`, we confirmed `activeBuilds.set()` is missing in `build-and-run`. While Feature 10 is handled by peer explorer tasks, our `buildImage` signature design supports cancellation tokens.

---

## 4. Conclusion

1. **Feature 8 Design is Complete**:
   - The route `POST /agent/deployments/:id/run-image` has been designed with complete validation (400 on missing image/body), image existence inspection, resilient image pulling, volume bind mounting, port exposure mapping, resource limit enforcement, and 201 response formatting.
   - `services/node-agent/src/docker.js` is updated to support `volumes` (`HostConfig.Binds`), `ports` array mapping, and resilient tag parsing in `pullImage`.
2. **Feature 9 Design is Complete**:
   - `services/node-agent/src/build.js` is hardened by completely removing the loop that passed `envVars` into `--build-arg`.
   - A dedicated `buildArgs` parameter is established, with support for `BUILD_ARG_*` opt-in, ensuring zero secret leakage in Docker image layer history.

---

## 5. Verification Method

### 5.1 Independent Code Verification
1. Inspect `services/node-agent/src/index.js` to verify `POST /agent/deployments/:id/run-image` route handler is registered and handles body validation, image pull, and `runContainer`.
2. Inspect `services/node-agent/src/build.js:224-250` to verify `--build-arg` only processes `buildArgs` and `BUILD_ARG_*`, and never iterates over raw runtime `envVars`.
3. Inspect `services/node-agent/src/docker.js:391-405` to verify `pullImage` correctly handles tags without appending duplicate `:latest`.

### 5.2 Automated Test Execution
Run the following commands to verify:
```bash
# 1. Run unit test suite
npm run test:unit

# 2. Run Tier 1 Feature 8 and Feature 9 verification tests
npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts

# 3. Run Tier 2 boundary validation tests
npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts

# 4. Run Tier 3 volume persistence integration tests
npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts
```

### 5.3 Invalidation Conditions
- Any occurrence of runtime secret values (e.g. `DB_PASSWORD`, `API_SECRET`) in `docker build` arguments or image history.
- Any 404 response when calling `POST /agent/deployments/:id/run-image`.
- Any git clone attempt when deploying a container from a Docker image.
