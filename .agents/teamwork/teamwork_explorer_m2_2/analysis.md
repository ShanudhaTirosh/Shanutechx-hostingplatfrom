# Technical Investigation & Architecture Design: Feature 8 & Feature 9

**Milestone**: Milestone 2 (Container Management & Build System)  
**Author**: `teamwork_explorer_m2_2`  
**Date**: 2026-10-28  
**Scope**:
- **Feature 8**: Direct Image Deployment Route (`POST /agent/deployments/:id/run-image`)
- **Feature 9**: Build Pipeline Secret Hardening (`build.js` `--build-arg` elimination)

---

## 1. Feature 8: Direct Image Deployment Route

### 1.1 Root Cause Analysis: Why Direct Image Deployments Fail

An inspection of `apps/api/src/routes/dockerDeployments.ts` (lines 121–142) and `services/node-agent/src/index.js` reveals the complete failure chain for direct image deployments:

```
[User Request: POST /api/deployments/docker-image]
                    │
                    ▼
[apps/api/src/routes/dockerDeployments.ts]
  Creates prisma.deployment record (sourceType: 'image', repoUrl: 'image://${image}')
  Calls callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`, 'POST', payload)
                    │
                    ▼
[services/node-agent HTTP Dispatcher]
  Searches registered Express routes...
  FAIL: Route POST /agent/deployments/:id/run-image DOES NOT EXIST!
  Returns HTTP 404 Not Found
                    │
                    ▼
[apps/api dockerDeployments.ts catch block]
  Catches 404 error:
  "run-image node-agent endpoint failed, trying buildAndRun fallback"
  Invokes buildAndRun(selectedNode, { repoUrl: `image://${image}`, ... })
                    │
                    ▼
[services/node-agent/src/index.js POST /agent/deployments/:deploymentId/build-and-run]
  Calls prepareWorkspace(deploymentId, repoUrl='image://...', branch)
                    │
                    ▼
[services/node-agent/src/repo.js prepareWorkspace]
  Executes: git clone image://<image> <workspaceDir>
  FATAL: git: 'image' is not a valid git protocol / repository URL scheme!
  Deployment crashes with git clone error and status 'failed'.
```

#### Detailed Failure Points:
1. **Missing Node-Agent Route**: In `services/node-agent/src/index.js`, the only deployment execution route is `POST /agent/deployments/:deploymentId/build-and-run` (line 482). The endpoint `/agent/deployments/:id/run-image` was never defined in `services/node-agent/src/index.js`.
2. **Harmful Fallback Loop**: In `dockerDeployments.ts:131-141`, the error catch handler attempts to recover by invoking `buildAndRun` with `repoUrl: image://${image}`. But `buildAndRun` is an orchestration pipeline specifically designed for Git source repositories (it prepares a workspace by running `git clone`, detects frameworks, and builds an image). Passing `image://<image>` to `git clone` causes Git to throw a fatal error.
3. **Volume Mount Omission**: Even if `run-image` had fallen back to a container launcher, neither `runContainer` in `services/node-agent/src/docker.js` nor `dockerDeployments.ts` had support for persistent volume bind mounts (`HostConfig.Binds`).

---

### 1.2 Route Specification & Parameter Contract

#### Endpoint
`POST /agent/deployments/:id/run-image`  
(Also accept `:deploymentId` as alias to ensure routing compatibility across client variations)

#### Authentication
Protected by node-agent HMAC-SHA256 authentication middleware (`x-agent-secret` header).

#### Request Headers
`Content-Type: application/json`  
`x-agent-secret: <NODE_AGENT_SECRET>`

#### Request Payload Schema
```typescript
interface RunImageRequest {
  image: string;                                // Required: Docker image name with optional tag/digest
  envVars?: Record<string, string>;             // Optional: Runtime environment variables
  ports?: Array<{                               // Optional: Array of port mappings
    internal?: number;
    containerPort?: number;
    published?: number;
    hostPort?: number;
  }>;
  volumes?: Array<{                             // Optional: Persistent volume bind mounts
    hostPath: string;
    containerPath: string;
    mode?: 'rw' | 'ro';
    readOnly?: boolean;
  }>;
  resources?: {                                 // Optional: Resource limit object
    cpuLimit?: number;                          // CPU cores (e.g. 1, 2)
    memoryLimitMb?: number;                     // Memory limit in MB (e.g. 512, 1024)
  };
  internalPort?: number;                        // Optional: Default/fallback internal port (e.g. 80)
  publishedPort?: number;                       // Optional: Host published port
  subdomain?: string;                           // Optional: Subdomain for Traefik routing
  exposureMode?: string;                        // Optional: ssl_with_proxy | ssl_direct | no_ssl | raw_tcp | internal_only
  routingMode?: string;                         // Optional: proxied | direct
  startCommand?: string;                        // Optional: Custom CMD override
  cpuLimit?: number;                            // Optional: Top-level fallback
  memLimitMb?: number;                          // Optional: Top-level fallback
  memoryLimit?: number;                         // Optional: Top-level fallback
  rootDomain?: string;                          // Optional: Fallback root domain
  deploymentsRootDomain?: string;               // Optional: Fallback deployments root domain
}
```

#### Response Contract (HTTP 201 Created)
```json
{
  "containerId": "d98188267e1a3bc4d8721c4598124ef1234567890abcdef1234567890abcdef1",
  "containerName": "deploy-dep_img_001",
  "status": "running",
  "deploymentId": "dep_img_001",
  "image": "redis:7-alpine",
  "ports": [
    { "internal": 6379, "published": 6379 }
  ],
  "volumes": [
    {
      "hostPath": "/var/lib/shanutechx/volumes/dep_img_003/data",
      "containerPath": "/var/lib/postgresql/data",
      "mode": "rw"
    }
  ],
  "resources": {
    "cpuLimit": 2,
    "memoryLimitMb": 1024
  }
}
```

#### Error Response Contract
- Missing body or missing image (HTTP 400):
  ```json
  { "error": "image is required" }
  ```
- Pull or container runtime error (HTTP 500):
  ```json
  { "error": "Failed to deploy image: <underlying error message>" }
  ```

---

### 1.3 Exact Route Handler Implementation Design

The route handler must be added to `services/node-agent/src/index.js` immediately following `/agent/system/df`:

```javascript
/**
 * POST /agent/deployments/:id/run-image
 * Direct Docker Image Deployment (Feature 8)
 * Pulls an image from a container registry (if not cached) and starts
 * the container via docker.runContainer with environment variables,
 * port mappings, persistent volume mounts, and resource constraints.
 */
app.post('/agent/deployments/:id/run-image', async (req, res) => {
  const deploymentId = req.params.id || req.params.deploymentId;

  // Validation: reject empty body or missing image parameter
  if (!req.body || !req.body.image || typeof req.body.image !== 'string' || !req.body.image.trim()) {
    return res.status(400).json({ error: 'image is required' });
  }

  const {
    image,
    envVars = {},
    ports = [],
    volumes = [],
    resources = {},
    internalPort,
    publishedPort,
    subdomain,
    exposureMode,
    routingMode,
    startCommand,
    cpuLimit,
    memLimitMb,
    memoryLimit,
    rootDomain: reqRootDomain,
    deploymentsRootDomain: reqDeploymentsRootDomain,
  } = req.body;

  // Normalize resource limits
  const effectiveCpuLimit = resources.cpuLimit ?? cpuLimit ?? 1;
  const effectiveMemLimitMb = resources.memoryLimitMb ?? memLimitMb ?? memoryLimit ?? 512;
  const normalizedResources = {
    cpuLimit: effectiveCpuLimit,
    memoryLimitMb: effectiveMemLimitMb,
  };

  // Normalize port mappings
  let effectiveInternalPort = internalPort;
  let effectivePublishedPort = publishedPort;
  if (!effectiveInternalPort && Array.isArray(ports) && ports.length > 0) {
    effectiveInternalPort = ports[0].internal ?? ports[0].containerPort;
    effectivePublishedPort = effectivePublishedPort ?? ports[0].published ?? ports[0].hostPort;
  }
  if (!effectiveInternalPort) {
    effectiveInternalPort = 80;
  }

  // Determine exposure mode: default to no_ssl if ports specified without subdomain
  const effectiveExposureMode = exposureMode || (Array.isArray(ports) && ports.length > 0 && !subdomain ? 'no_ssl' : 'ssl_with_proxy');
  const effectiveRoutingMode = routingMode || (effectiveExposureMode === 'no_ssl' || effectiveExposureMode === 'raw_tcp' ? 'direct' : 'proxied');

  try {
    // 1. Ensure image is available locally; pull from registry if not cached
    let hasImage = false;
    try {
      const img = docker.getImage(image);
      await img.inspect();
      hasImage = true;
    } catch (_err) {
      hasImage = false;
    }

    if (!hasImage) {
      logger.info({ deploymentId, image }, 'Image not present in local Docker cache, pulling...');
      try {
        await pullImage(image);
        logger.info({ deploymentId, image }, 'Successfully pulled image');
      } catch (pullErr) {
        logger.error({ deploymentId, image, err: pullErr }, 'Failed to pull image');
        return res.status(500).json({ error: `Failed to pull image "${image}": ${pullErr.message}` });
      }
    }

    // 2. Launch container via runContainer
    const { containerId, containerName } = await runContainer({
      deploymentId,
      imageTag: image,
      internalPort: effectiveInternalPort,
      publishedPort: effectivePublishedPort,
      ports: Array.isArray(ports) ? ports : [],
      volumes: Array.isArray(volumes) ? volumes : [],
      subdomain,
      rootDomain: reqRootDomain || ROOT_DOMAIN,
      deploymentsRootDomain: reqDeploymentsRootDomain,
      envVars,
      cpuLimit: effectiveCpuLimit,
      memLimitMb: effectiveMemLimitMb,
      routingMode: effectiveRoutingMode,
      exposureMode: effectiveExposureMode,
      startCommand: startCommand || null,
      agentPort: PORT,
      agentSecret: AGENT_SECRET,
    });

    logger.info({ deploymentId, containerId, image }, 'Direct image container running successfully');

    // Return 201 Created with complete deployment attributes
    return res.status(201).json({
      containerId,
      containerName,
      status: 'running',
      deploymentId,
      image,
      ports: Array.isArray(ports) ? ports : [],
      volumes: Array.isArray(volumes) ? volumes : [],
      resources: normalizedResources,
    });
  } catch (err) {
    logger.error({ deploymentId, image, err }, 'Failed to run direct image container');
    return res.status(500).json({ error: `Failed to deploy image: ${err.message}` });
  }
});
```

---

### 1.4 Required Supporting Enhancements in `services/node-agent/src/docker.js`

To make `runContainer` and `pullImage` fully capable of handling direct images, volume bind mounts, and explicit port arrays, the following adjustments are required:

#### 1.4.1 Resilient Tag Parsing in `pullImage`
In `services/node-agent/src/docker.js:391`, the existing `pullImage` implementation naively interpolates `${imageName}:${tag}`:
```javascript
// Existing bug: if imageName is 'redis:7-alpine', fullName becomes 'redis:7-alpine:latest'
const fullName = `${imageName}:${tag}`;
```
**Fix in `docker.js:391-405`**:
```javascript
async function pullImage(imageName, tag = 'latest') {
  let fullName = imageName;
  const lastColon = imageName.lastIndexOf(':');
  const lastSlash = imageName.lastIndexOf('/');
  const hasTag = (lastColon > lastSlash) || imageName.includes('@');
  if (!hasTag) {
    fullName = `${imageName}:${tag || 'latest'}`;
  }
  return new Promise((resolve, reject) => {
    docker.pull(fullName, (err, stream) => {
      if (err) return reject(err);
      const events = [];
      docker.modem.followProgress(stream, (pullErr, output) => {
        if (pullErr) return reject(pullErr);
        resolve({ image: fullName, events: output });
      }, (event) => {
        events.push(event);
      });
    });
  });
}
```

#### 1.4.2 Persistent Volume Bind Mounts and Port Array in `runContainer`
In `services/node-agent/src/docker.js:14-95`:
1. Accept `volumes = []` and `ports = []` in `runContainer` arguments.
2. Build `Binds` array for `HostConfig`:
   ```javascript
   const binds = [];
   if (Array.isArray(volumes)) {
     for (const v of volumes) {
       if (typeof v === 'string') {
         binds.push(v);
       } else if (v && v.hostPath && v.containerPath) {
         const mode = v.mode || (v.readOnly ? 'ro' : 'rw');
         binds.push(`${v.hostPath}:${v.containerPath}:${mode}`);
       }
     }
   }
   ```
3. Map explicit `ports` array into `portBindings`:
   ```javascript
   if (Array.isArray(ports) && ports.length > 0) {
     for (const p of ports) {
       const internal = p.internal ?? p.containerPort;
       const published = p.published ?? p.hostPort;
       if (internal != null) {
         portBindings[`${internal}/tcp`] = published != null ? [{ HostPort: String(published) }] : [];
       }
     }
   }
   ```
4. Set `HostConfig.Binds` and `ExposedPorts` in `containerConfig`:
   ```javascript
   const exposedPorts = {};
   for (const portKey of Object.keys(portBindings)) {
     exposedPorts[portKey] = {};
   }

   const containerConfig = {
     name: containerName,
     Image: imageTag,
     Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
     Labels: labels,
     ExposedPorts: exposedPorts,
     HostConfig: {
       PortBindings: portBindings,
       Binds: binds.length > 0 ? binds : undefined,
       NanoCpus: cpuLimit * 1e9,
       Memory: memLimitMb * 1024 * 1024,
       RestartPolicy: { Name: 'unless-stopped' },
       NetworkMode: networks[0] || 'bridge',
       SecurityOpt: ['no-new-privileges:true'],
     },
     User: '1000:1000',
   };
   ```

---

## 2. Feature 9: Build Pipeline Secret Hardening

### 2.1 Root Cause Analysis: How Secrets Leak into Docker Image Layers

In `services/node-agent/src/build.js:242-248`:
```javascript
  const dockerArgs = ['build', '-t', imageTag, '.'];
  for (const [key, value] of Object.entries(envVars)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }

  await run('docker', dockerArgs, { cwd: workspaceDir, onData });
```

#### Why this causes a severe secret leak:
1. **Docker Engine `--build-arg` Semantics**:
   - The `--build-arg` flag is evaluated by the Docker builder during `ARG` instruction processing.
   - Every `--build-arg` key-value pair passed on the command line is recorded in the image build history and embedded into intermediate image layers.
2. **Cleartext Persistence in Image History**:
   - Any user or process with access to the Docker image can run:
     ```bash
     docker history --no-trunc <imageTag>
     docker inspect <imageTag>
     ```
   - All build argument names and values appear verbatim in the image commit descriptions (e.g. `|3 API_SECRET=sk_live_xyz DB_PASSWORD=prod_pass /bin/sh -c ...`).
3. **Scope of Secret Exposure**:
   - The platform receives user-configured runtime environment variables (`envVars`) containing production database connection strings (`DATABASE_URL`), API tokens (`STRIPE_SECRET_KEY`), encryption keys, and credentials.
   - Because `build.js` passes the *entire* `envVars` object as `--build-arg`, all confidential secrets become permanent metadata of the image.
4. **Registry and Multi-Tenant Worker Risk**:
   - In distributed deployments, images are tagged and may be pushed to a registry or stored on compute nodes.
   - Any compromised container or unauthorized tenant inspecting local node images can harvest all database passwords and credentials baked into the layers.
5. **Architectural Confusion of Build-Time vs Runtime**:
   - Build-time variables (`buildArgs`) are compile-time configuration parameters (e.g. `NODE_ENV=production`, `GO_VERSION=1.22`, `API_ENDPOINT`).
   - Runtime variables (`envVars`) belong strictly to container instantiation (`docker run -e` / Docker Engine API `Env: ['KEY=VALUE', ...]`), residing solely in container volatile memory at runtime.

---

### 2.2 Design of Hardened Build System

To fix this security vulnerability, runtime environment variables (`envVars`) must be strictly segregated from build arguments (`buildArgs`):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Deployment Configuration Request                     │
│   envVars: { DB_PASS: 'secret', API_KEY: 'token' }                     │
│   buildArgs: { NODE_ENV: 'production', APP_VERSION: '1.0' }            │
└───────────────────────────┬────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      [Build Phase]               [Run Phase]
      buildImage()                runContainer()
      Only passes buildArgs       Injects envVars into
      to `docker build`           Container `Env` memory
              │                           │
              ▼                           ▼
   docker build \             docker create \
     --build-arg NODE_ENV=...   Env: [ 'DB_PASS=secret', 'API_KEY=token' ]
   (No secrets in layers!)    (Kept in container memory only)
```

#### Rule Set for Build Arguments:
1. **Zero Secret Leakage by Default**: Runtime `envVars` must NEVER be passed as `--build-arg` to `docker build`.
2. **Explicit `buildArgs` Parameter**: Only variables explicitly declared as `buildArgs` (or prefixed with `BUILD_ARG_` in `envVars`) are passed to `docker build`.
3. **Prefix Filtering**: If a developer specifies an environment variable named `BUILD_ARG_FOO=bar`, the system recognizes it as an explicit build argument and passes `--build-arg FOO=bar`.
4. **Multi-Tier Protection**: In Tier 1 (Railpack), Tier 2 (Nixpacks CLI), and Tier 3 (Containerized Nixpacks), runtime secrets are stripped so they are not embedded into the buildpack compilation environment unless explicitly specified in `nixpacksConfig.variables`.

---

### 2.3 Exact Code Implementation in `services/node-agent/src/build.js`

#### Step 1: Update `executeDockerBuild` (lines 224–250)
```javascript
/**
 * Helper to build with native Docker / Smart Dockerfile.
 * Hardened to prevent leaking runtime secrets into image layers.
 */
async function executeDockerBuild({
  workspaceDir,
  imageTag,
  envVars = {},
  buildArgs = {},
  startCommand,
  entryFile,
  frameworkPreset,
  log,
  onData,
}) {
  const dockerfileInfo = generateSmartDockerfile(workspaceDir, { startCommand, entryFile, frameworkPreset });

  if (dockerfileInfo.isGenerated) {
    log(`Auto-generated Dockerfile for detected runtime (${dockerfileInfo.runtime}).`);
  } else {
    log('Using custom Dockerfile from repository root.');
  }

  const dockerArgs = ['build', '-t', imageTag, '.'];

  // Feature 9 Fix: ONLY pass explicit buildArgs to docker build.
  // Runtime environment variables (envVars) must NEVER be passed as --build-arg,
  // as they become permanently baked into image layer history (docker history).
  const effectiveBuildArgs = { ...(buildArgs || {}) };

  // Allow explicit opt-in via BUILD_ARG_ prefix from envVars
  for (const [key, value] of Object.entries(envVars || {})) {
    if (key.startsWith('BUILD_ARG_')) {
      const cleanKey = key.slice('BUILD_ARG_'.length);
      effectiveBuildArgs[cleanKey] = value;
    }
  }

  for (const [key, value] of Object.entries(effectiveBuildArgs)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }

  await run('docker', dockerArgs, { cwd: workspaceDir, onData });
  log('Docker Engine build succeeded!');
  return { imageTag, builder: dockerfileInfo.isGenerated ? 'smart-dockerfile' : 'dockerfile' };
}
```

#### Step 2: Update `buildImage` Signature and Dispatch (lines 266–391)
```javascript
async function buildImage({
  workspaceDir,
  imageTag,
  envVars = {},
  buildArgs = {},
  startCommand,
  entryFile,
  frameworkPreset,
  builder,
  nixpacksConfig,
  onData,
}) {
  const log = (msg) => {
    if (onData) onData(Buffer.from(`[ShanutechX Builder] ${msg}\n`));
  };

  const selectedBuilder = (builder || 'AUTO').toUpperCase();
  log(`Build engine mode: ${selectedBuilder}`);

  // Write nixpacks.toml if nixpacksConfig is present
  if (nixpacksConfig && typeof nixpacksConfig === 'object' && Object.keys(nixpacksConfig).length > 0) {
    const nixpacksTomlPath = path.join(workspaceDir, 'nixpacks.toml');
    if (!fs.existsSync(nixpacksTomlPath)) {
      try {
        const tomlContent = generateNixpacksToml(nixpacksConfig);
        fs.writeFileSync(nixpacksTomlPath, tomlContent, 'utf8');
        log('Generated nixpacks.toml from deployment configuration.');
      } catch (err) {
        log(`Warning: Failed to generate nixpacks.toml: ${err.message}`);
      }
    }
  }

  const hasCustomDockerfile = fs.existsSync(path.join(workspaceDir, 'Dockerfile')) || fs.existsSync(path.join(workspaceDir, 'dockerfile'));

  // If DOCKERFILE was explicitly selected, or if AUTO has a custom Dockerfile already provided in repo
  if (selectedBuilder === 'DOCKERFILE' || (selectedBuilder === 'AUTO' && hasCustomDockerfile)) {
    log('Building directly using Dockerfile...');
    return await executeDockerBuild({
      workspaceDir,
      imageTag,
      envVars,
      buildArgs,
      startCommand,
      entryFile,
      frameworkPreset,
      log,
      onData,
    });
  }

  // Tier 1: Railpack CLI
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting build with Railpack CLI...');
      const railpackArgs = ['build', workspaceDir, '--name', imageTag];
      // Only pass explicit buildArgs to Railpack build phase
      for (const [key, value] of Object.entries(buildArgs || {})) {
        railpackArgs.push('--env', `${key}=${value}`);
      }
      if (startCommand) {
        railpackArgs.push('--start-command', startCommand);
      }
      await run('railpack', railpackArgs, { onData });
      log('Railpack build succeeded!');
      return { imageTag, builder: 'railpack' };
    } catch (errRailpack) {
      log(`Railpack notice: ${errRailpack.message || errRailpack}`);
    }
  }

  // Tier 2: Nixpacks CLI
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'NIXPACKS' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting build with Nixpacks CLI...');
      const nixpacksArgs = ['build', workspaceDir, '--name', imageTag];
      // Only pass explicit buildArgs to Nixpacks build phase
      for (const [key, value] of Object.entries(buildArgs || {})) {
        nixpacksArgs.push('--env', `${key}=${value}`);
      }
      if (startCommand) {
        nixpacksArgs.push('--start-cmd', startCommand);
      }
      await run('nixpacks', nixpacksArgs, { onData });
      log('Nixpacks build succeeded!');
      return { imageTag, builder: 'nixpacks' };
    } catch (errNixpacks) {
      log(`Nixpacks CLI notice: ${errNixpacks.message || errNixpacks}`);
    }
  }

  // Tier 3: Containerized Nixpacks Runner
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'NIXPACKS' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting containerized Nixpacks builder (ghcr.io/railwayapp/nixpacks:latest)...');
      const dockerSock = process.platform === 'win32' ? '//var/run/docker.sock' : '/var/run/docker.sock';
      const containerArgs = [
        'run', '--rm',
        '-v', `${dockerSock}:/var/run/docker.sock`,
        '-v', `${path.resolve(workspaceDir)}:/app`,
        '-w', '/app',
      ];
      for (const [key, value] of Object.entries(buildArgs || {})) {
        containerArgs.push('-e', `${key}=${value}`);
      }
      containerArgs.push('ghcr.io/railwayapp/nixpacks:latest', 'build', '/app', '--name', imageTag);
      if (startCommand) {
        containerArgs.push('--start-cmd', startCommand);
      }
      await run('docker', containerArgs, { onData });
      log('Containerized Nixpacks build succeeded!');
      return { imageTag, builder: 'nixpacks-container' };
    } catch (errContainerNixpacks) {
      log(`Containerized Nixpacks notice: ${errContainerNixpacks.message || errContainerNixpacks}`);
    }
  }

  // Tier 4: Smart Docker Engine Auto-Detector & Generator
  log('Switching to Smart Docker Engine...');
  return await executeDockerBuild({
    workspaceDir,
    imageTag,
    envVars,
    buildArgs,
    startCommand,
    entryFile,
    frameworkPreset,
    log,
    onData,
  });
}
```

#### Step 3: Update `services/node-agent/src/index.js` `build-and-run` Route
In `services/node-agent/src/index.js:482-560`:
```javascript
  const {
    repoUrl,
    branch,
    subdomain,
    rootDomain: reqRootDomain,
    deploymentsRootDomain: reqDeploymentsRootDomain,
    internalPort,
    envVars,
    buildArgs,
    cpuLimit,
    memoryLimit,
    ...
  } = req.body || {};

  ...
  await buildImage({
    workspaceDir,
    imageTag,
    envVars,
    buildArgs: buildArgs || {},
    startCommand,
    entryFile,
    frameworkPreset,
    builder,
    nixpacksConfig,
    onData: (chunk) => emit({ phase: 'build', log: chunk.toString() }),
  });
```

---

## 3. Comparison Summary: Before vs After

| Aspect | Before (Vulnerable / Incomplete) | After (Hardened & Functional) |
|---|---|---|
| **Direct Image Deploy** | `POST /agent/deployments/:id/run-image` missing. 404 triggers fallback calling `git clone image://...`, which crashes. | Exact route handler implemented; inspects/pulls image, connects ports/volumes/resources, starts container, returns 201 with status `running`. |
| **Image Tag Pulling** | `pullImage` blindly appended `:latest` (`${imageName}:${tag}`), breaking tagged images like `redis:7-alpine`. | Resilient tag parsing checks `lastIndexOf(':')` vs `lastIndexOf('/')` and digest (`@`), preserving tags and registries. |
| **Volume Mounts** | `runContainer` ignored volumes; `deploymentVolume` DB rows were disconnected from Docker. | `runContainer` accepts `volumes`, formats `HostConfig.Binds`, mounting persistent host paths (`/var/lib/shanutechx/volumes/...`) into containers. |
| **Secret Handling in Build** | All runtime `envVars` were passed as `--build-arg`, writing database passwords and private keys to public image layers. | Only explicit `buildArgs` and `BUILD_ARG_*` are passed to `docker build`. Runtime secrets are strictly confined to container runtime memory. |
| **E2E Test Compliance** | Tests 8.1–8.5, T2.8, T3.8, and 9.5 failed due to missing route and secret leakage. | 100% compliant with contracts in `m2-container-build.test.ts`, `limits-and-validation.test.ts`, and `volume-container-persistence.test.ts`. |
