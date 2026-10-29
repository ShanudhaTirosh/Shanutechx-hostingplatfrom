# Technical Specification & Architectural Design: Docker Persistent Volume Provisioning (Feature 7)

**Document Version**: 1.0.0  
**Date**: 2026-10-28  
**Author**: Specification Miner (`teamwork_spec_miner_m2_1`)  
**Target Milestone**: Milestone 2: Container Management & Build System  
**Feature Scope**: Feature 7 — Docker Persistent Volume Provisioning  
**Authoritative Sources**:
- `apps/api/src/routes/volumes.ts` (lines 1–86)
- `services/node-agent/src/docker.js` (lines 14–115, 426–461)
- `services/node-agent/src/index.js` (lines 344–398, 477–565)
- `services/node-agent/src/backup.js` (lines 37–42, 98–106)
- `services/node-agent/src/nodeEngine.js` (lines 460–495)
- `apps/api/src/lib/nodeAgentClient.ts` (lines 24–44, 46–159, 679–700)
- `packages/db/prisma/schema.prisma` (lines 678–690)
- `tests/e2e/tier1-features/m2-container-build.test.ts` (lines 33–96)
- `tests/e2e/tier3-interactions/volume-container-persistence.test.ts` (lines 27–83)
- `tests/e2e/infra/test-server.ts` (lines 235–242)

---

## 1. Executive Summary & Defect Analysis

### 1.1 The "Disconnected Volume" Defect
The platform currently provides persistent volume management UI routes in `apps/api/src/routes/volumes.ts` and volume models in Prisma (`DeploymentVolume`). However, audit and codebase inspection reveals a complete disconnect between the control plane and actual Docker compute nodes:
1. **Control Plane Disconnect**: `POST /api/deployments/:id/volumes` creates a database record in PostgreSQL (`prisma.deploymentVolume.create`), but **never contacts** `node-agent` to provision host directories or Docker volumes on the target compute node.
2. **Missing Agent Support**: In `services/node-agent/src/index.js:366`, `POST /agent/volumes` only expects `{ name, driver, labels }` for standalone Docker volumes; it does not handle deployment volume directories (`{ deploymentId, volumeName, hostPath }`).
3. **No Volume Mounts in Container Creation**: In `services/node-agent/src/docker.js:14-115`, `runContainer()` accepts **no volume parameters** and omits `HostConfig.Binds`.
4. **Build Pipeline Blindness**: `apps/api/src/lib/nodeAgentClient.ts:buildAndRun` does not query or forward persistent volume configurations to the node agent.
5. **Consequence**: Users believe they have attached persistent storage, but containers run completely ephemeral; any container restart, redeploy, or crash loses all application state stored in the mount path.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | API / Volumes | `GET /api/deployments/:id/volumes` | List all configured persistent volumes for an owned deployment | `id` (deployment ID via URL param), Auth Bearer/Session token | `{ volumes: DeploymentVolume[] }` (HTTP 200) | `404 Deployment not found` if not owned or missing | `apps/api/src/routes/volumes.ts:24` |
| 2 | API / Volumes | `POST /api/deployments/:id/volumes` | Attach new persistent volume: provisions directory on compute node and persists DB record | `id` (URL), body: `{ name: string, containerPath: string, sizeGb?: number }` | `{ ok: true, volume: DeploymentVolume }` (HTTP 201) | `400` validation failure; `404` deployment missing; `409` name/path conflict; `502` node agent error | `apps/api/src/routes/volumes.ts:43`, `tests/e2e/tier1-features/m2-container-build.test.ts:33` |
| 3 | API / Volumes | `DELETE /api/deployments/:id/volumes/:volumeId` | Detach persistent volume from deployment and delete DB metadata | `id`, `volumeId` (URL params) | `{ ok: true }` (HTTP 200) | `404` deployment or volume not found | `apps/api/src/routes/volumes.ts:70`, `tests/e2e/tier1-features/m2-container-build.test.ts:83` |
| 4 | Node Agent / Volumes | `POST /agent/volumes` | Provision host storage directory and/or Docker volume for a deployment | `{ deploymentId: string, name?: string, volumeName?: string, hostPath?: string, sizeGb?: number }` | `{ success: true, path: string, name: string }` (HTTP 201) | `400` missing name or unsafe hostPath; `401` bad agent secret; `500` mkdir/chown failure | `PROJECT.md:68`, `tests/e2e/infra/test-server.ts:235`, `tests/e2e/tier1-features/m2-container-build.test.ts:58` |
| 5 | Node Agent / Volumes | `GET /agent/volumes` | List Docker and provisioned volumes on compute node | Query / None, `x-agent-secret` header | `{ volumes: any[] }` (HTTP 200) | `401` unauthorized, `500` docker failure | `services/node-agent/src/index.js:346` |
| 6 | Node Agent / Volumes | `GET /agent/volumes/:name` | Inspect details of a Docker volume on compute node | `name` (URL param), `x-agent-secret` | Volume inspection object (HTTP 200) | `404` not found, `500` error | `services/node-agent/src/index.js:356` |
| 7 | Node Agent / Volumes | `DELETE /agent/volumes/:name` | Remove Docker volume or host directory on compute node | `name` (URL param), `x-agent-secret` | `{ ok: true }` (HTTP 200) | `404` not found, `500` error | `services/node-agent/src/index.js:379` |
| 8 | Node Agent / Volumes | `POST /agent/volumes/prune` | Prune unused Docker volumes | None, `x-agent-secret` | Prune results `{ VolumesDeleted: string[], SpaceReclaimed: number }` (HTTP 200) | `500` docker failure | `services/node-agent/src/index.js:389` |
| 9 | Docker Engine / Lifecycle | `runContainer` Volume Binding | Mount persistent host paths into container via `HostConfig.Binds` | Parameter `volumes: Array<{ hostPath: string, containerPath: string, mode?: 'rw' \| 'ro' }>` | Returns `{ containerId, containerName }` | Skips restricted paths; logs warning if host directory cannot be prepared | `services/node-agent/src/docker.js:14`, `PROJECT.md:70` |
| 10 | API / Client | `buildAndRun` Volume Propagation | Automatically load and inject configured volumes into deployment payload | `params: BuildAndRunParams` with optional `volumes` array | Relays to agent NDJSON stream | Falls back to empty volume array if DB query fails | `apps/api/src/lib/nodeAgentClient.ts:82` |
| 11 | API / Client | `run-image` Volume Propagation | Direct Docker image deployment mounts configured persistent volumes | Payload to `/agent/deployments/:id/run-image` includes `volumes` | Container started with volume binds | Logs warning and falls back to `buildAndRun` | `apps/api/src/routes/dockerDeployments.ts:122` |
| 12 | Node Agent / Backup | Deployment Volume Backup | Create tar.gz archive of volumes located in `/var/lib/shanutechx/volumes/<deploymentId>/` | `{ deploymentId, backupId, volumes: [{ name, hostPath }] }` | Generates `volume-<name>.tar.gz` with SHA-256 | Rejects volume paths outside allowed directory (`volume_path_denied`) | `services/node-agent/src/backup.js:152` |

---

## 3. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | `POST /api/deployments/:id/volumes` | Deployment has no assigned compute node (`deployment.node == null`) | Reject with HTTP 400 Bad Request: `{"error": "Deployment is not assigned to a compute node"}`. Do not attempt node-agent call or DB insertion. |
| 2 | `POST /api/deployments/:id/volumes` | Volume name contains path traversal or special characters (`../../etc`, `name/with/slashes`) | Zod schema validation regex `/^[a-zA-Z0-9_\-]+$/` (min 2, max 64) rejects with HTTP 400. Node agent also rejects with HTTP 400. |
| 3 | `POST /api/deployments/:id/volumes` | `containerPath` is a relative path (e.g. `data/uploads`) | Zod schema `.startsWith('/')` rejects with HTTP 400 Bad Request. |
| 4 | `POST /api/deployments/:id/volumes` | `containerPath` attempts to mount over critical system paths (`/`, `/proc`, `/sys`, `/etc`, `/var/run/docker.sock`) | Reject with HTTP 400 Bad Request (`"Container mount path cannot target system directories"`). |
| 5 | `POST /api/deployments/:id/volumes` | Duplicate volume name for the same deployment | Query `prisma.deploymentVolume` finds existing record with same `name` under `deploymentId`; returns HTTP 409 Conflict. |
| 6 | `POST /api/deployments/:id/volumes` | Duplicate container mount path for the same deployment | Query `prisma.deploymentVolume` finds existing record with same `containerPath` under `deploymentId`; returns HTTP 409 Conflict. |
| 7 | `POST /api/deployments/:id/volumes` | Node agent is unreachable, offline, or returns 500 error | `callNodeAgent` throws; `volumesRouter.post` catches error, logs with deployment context, and returns HTTP 502 Bad Gateway. **No database record is created** (prevents orphan/ghost DB records). |
| 8 | `POST /agent/volumes` | Host volume directory does not exist prior to provisioning | Node agent creates directory recursively (`fs.promises.mkdir(targetPath, { recursive: true, mode: 0o777 })`). |
| 9 | `POST /agent/volumes` | Host directory permissions for non-root container user (`1000:1000`) | Containers run with `User: '1000:1000'`. If directory is created as `root:root (0755)`, the container crashes with `EACCES: permission denied`. Node agent executes `chmod 0o777` and attempts `chown 1000:1000`. |
| 10 | `POST /agent/volumes` | Pre-existing directory from prior deployment or restart | `mkdir` with `{ recursive: true }` succeeds silently without throwing `EEXIST`; returns HTTP 201 with existing path. |
| 11 | `POST /agent/volumes` | `hostPath` provided in body attempts directory traversal outside allowed deployment root | Node agent validates `path.resolve(hostPath)` against `path.resolve(VOLUMES_ROOT, deploymentId)`. If outside, rejects with HTTP 400 `Invalid or unsafe volume hostPath`. |
| 12 | `services/node-agent/src/docker.js:runContainer` | `volumes` parameter is `undefined`, `null`, or empty array `[]` | `HostConfig.Binds` is set to `[]` (empty array); container runs normally with ephemeral root filesystem. |
| 13 | `services/node-agent/src/docker.js:runContainer` | `volumes` array contains string format `"hostPath:containerPath:mode"` or object format `{ hostPath, containerPath, mode }` | Normalizes both formats gracefully; defaults mode to `'rw'` if omitted. |
| 14 | `services/node-agent/src/docker.js:runContainer` | `volumes` item attempts to mount `/var/run/docker.sock` or host root `/` | `runContainer` checks against `RESTRICTED_HOST_PATHS`; skips restricted binds and emits a security warning to logger. |
| 15 | `apps/api/src/routes/volumes.ts` | Detaching volume via `DELETE /api/deployments/:id/volumes/:volumeId` while container is running | DB record is removed; host files remain preserved on disk. When the deployment is next redeployed or restarted, the bind mount is excluded from container creation. |
| 16 | Container Redeploy / Rebuild | Deployment redeployed after code push or manual trigger | `buildAndRun` queries `prisma.deploymentVolume` for the deployment and sends all volumes in payload; new container binds same host path; data is preserved. |

---

## 4. Technical Design & Interface Contracts

### 4.1 Node Agent Endpoint: `POST /agent/volumes`
File: `services/node-agent/src/index.js`

#### Wire Contract
- **HTTP Method**: `POST`
- **Path**: `/agent/volumes`
- **Authentication**: `x-agent-secret` header (HMAC timing-safe checked)
- **Request Body (Deployment Host Directory Mode)**:
  ```json
  {
    "deploymentId": "cly1234567890abcdef",
    "name": "pgdata",
    "volumeName": "pgdata",
    "hostPath": "/var/lib/shanutechx/volumes/cly1234567890abcdef/pgdata",
    "sizeGb": 20
  }
  ```
- **Response Body (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "path": "/var/lib/shanutechx/volumes/cly1234567890abcdef/pgdata",
    "name": "pgdata",
    "deploymentId": "cly1234567890abcdef"
  }
  ```
- **Request Body (Docker Named Volume Fallback Mode)**:
  ```json
  {
    "name": "custom-docker-volume",
    "driver": "local",
    "labels": { "managed-by": "shanutechx" }
  }
  ```
- **Response Body (HTTP 201 Created)**:
  ```json
  {
    "Name": "custom-docker-volume",
    "Driver": "local",
    "Scope": "local",
    "Mountpoint": "/var/lib/docker/volumes/custom-docker-volume/_data"
  }
  ```

#### Detailed Handler Implementation Specification
```javascript
const VOLUMES_ROOT = process.env.AGENT_VOLUMES_DIR || '/var/lib/shanutechx/volumes';

app.post('/agent/volumes', async (req, res) => {
  const { deploymentId, hostPath, driver, labels, sizeGb } = req.body || {};
  const name = req.body?.name || req.body?.volumeName;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  // Sanitize volume name
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    return res.status(400).json({ error: 'Invalid volume name' });
  }

  try {
    // Mode 1: Deployment persistent volume (host directory + optional docker registration)
    if (deploymentId) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(deploymentId)) {
        return res.status(400).json({ error: 'Invalid deploymentId' });
      }

      const allowedRoot = path.resolve(VOLUMES_ROOT, deploymentId) + path.sep;
      const targetPath = hostPath ? path.resolve(hostPath) : path.resolve(VOLUMES_ROOT, deploymentId, name);

      // Path traversal security check
      if (!(targetPath + path.sep).startsWith(allowedRoot) && targetPath !== path.resolve(VOLUMES_ROOT, deploymentId, name)) {
        logger.warn({ deploymentId, hostPath, targetPath }, 'Volume path traversal attempt rejected');
        return res.status(400).json({ error: 'Volume path is outside the allowed volumes directory' });
      }

      // Ensure directory exists on host
      await fs.promises.mkdir(targetPath, { recursive: true, mode: 0o777 });

      // Enforce write permissions for container user (1000:1000)
      try { await fs.promises.chmod(targetPath, 0o777); } catch (_) {}
      try { await fs.promises.chown(targetPath, 1000, 1000); } catch (_) {}

      // Optionally register named Docker volume for engine visibility
      try {
        await createVolume(`vol-${deploymentId}-${name}`, driver || 'local', {
          deploymentId,
          volumeName: name,
          ...(labels || {}),
        });
      } catch (_volErr) {
        // Non-fatal if Docker named volume already exists
      }

      logger.info({ deploymentId, name, targetPath }, 'Provisioned persistent volume on compute node');
      return res.status(201).json({
        success: true,
        path: targetPath,
        name,
        deploymentId,
      });
    }

    // Mode 2: Docker Engine named volume (for Arcane / Docker dashboard)
    const vol = await createVolume(name, driver, labels);
    logger.info({ name }, 'Docker volume created');
    res.status(201).json(vol);
  } catch (err) {
    logger.error({ err, name, deploymentId }, 'Failed to create volume');
    res.status(500).json({ error: err.message });
  }
});
```

---

### 4.2 Control Plane Route Integration: `apps/api/src/routes/volumes.ts`

#### Wire Contract
- **POST `/api/deployments/:id/volumes`**:
  - Request: `{ name: "uploads", containerPath: "/app/uploads", sizeGb: 10 }`
  - Validates `deployment.node` is present.
  - Checks duplicate name / mount path in `prisma.deploymentVolume`.
  - Calls `callNodeAgent(deployment.node, '/agent/volumes', 'POST', payload)`.
  - Inserts record into `prisma.deploymentVolume`.
  - Returns `{ ok: true, volume }` (HTTP 201).

#### Detailed Handler Implementation Specification
```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource, accessActionForRequest } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { useForOwnRoutes } from '../lib/routerGuard';
import { callNodeAgent } from '../lib/nodeAgentClient';

export const volumesRouter = Router();

useForOwnRoutes(volumesRouter, requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req, undefined, undefined, accessActionForRequest(req)))) return null;
  return deployment;
}

const createVolumeSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  containerPath: z.string().min(1).max(255).startsWith('/'),
  sizeGb: z.number().int().min(1).max(500).default(5),
});

const FORBIDDEN_CONTAINER_PATHS = new Set([
  '/',
  '/proc',
  '/sys',
  '/dev',
  '/etc',
  '/var/run',
  '/var/run/docker.sock',
]);

// POST /api/deployments/:id/volumes — Attach new persistent volume
volumesRouter.post('/deployments/:id/volumes', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = createVolumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, containerPath, sizeGb } = parsed.data;

  // Validate container mount path is not a critical system directory
  const normalizedContainerPath = containerPath.replace(/\/+$/, '');
  if (FORBIDDEN_CONTAINER_PATHS.has(normalizedContainerPath)) {
    return res.status(400).json({ error: 'Container mount path cannot target system directories' });
  }

  // Prevent duplicate volume names or mount paths for the same deployment
  const existing = await prisma.deploymentVolume.findFirst({
    where: {
      deploymentId: deployment.id,
      OR: [
        { name },
        { containerPath },
      ],
    },
  });
  if (existing) {
    return res.status(409).json({
      error: existing.name === name
        ? `Volume with name '${name}' already exists for this deployment`
        : `Container mount path '${containerPath}' is already in use by another volume`,
    });
  }

  // Ensure deployment has an assigned compute node
  if (!deployment.node) {
    return res.status(400).json({ error: 'Deployment is not assigned to a compute node' });
  }

  const hostPath = `/var/lib/shanutechx/volumes/${deployment.id}/${name}`;

  // Call node-agent to provision host directory and verify node storage
  try {
    await callNodeAgent(deployment.node, '/agent/volumes', 'POST', {
      deploymentId: deployment.id,
      name,
      volumeName: name,
      hostPath,
      sizeGb,
    });
  } catch (err: any) {
    logger.error({ err, deploymentId: deployment.id, volumeName: name }, 'Failed to provision volume on node-agent');
    return res.status(502).json({ error: `Node agent volume provisioning failed: ${err.message}` });
  }

  // Persist metadata in database only after node agent confirms provisioning
  const volume = await prisma.deploymentVolume.create({
    data: {
      deploymentId: deployment.id,
      name,
      hostPath,
      containerPath,
      sizeGb,
    },
  });

  logger.info({ deploymentId: deployment.id, volumeName: volume.name, hostPath }, 'Attached persistent volume');

  res.status(201).json({ ok: true, volume });
});

// DELETE /api/deployments/:id/volumes/:volumeId — Detach persistent volume
volumesRouter.delete('/deployments/:id/volumes/:volumeId', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const volume = await prisma.deploymentVolume.findFirst({
    where: { id: req.params.volumeId, deploymentId: deployment.id },
  });

  if (!volume) return res.status(404).json({ error: 'Persistent volume not found' });

  await prisma.deploymentVolume.delete({ where: { id: volume.id } });

  logger.info({ deploymentId: deployment.id, volumeId: volume.id }, 'Detached persistent volume');

  res.json({ ok: true });
});
```

---

### 4.3 Container Volume Mount Specification in `services/node-agent/src/docker.js`

#### Updated Function Signature
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
  volumes = [], // <--- Added parameter: Array<{ hostPath, containerPath, mode? }>
})
```

#### Mount Configuration & Security Filter
```javascript
  const RESTRICTED_HOST_PATHS = [
    '/var/run/docker.sock',
    '/proc',
    '/sys',
    '/etc',
    '/dev',
    '/root',
    '/',
  ];

  const binds = [];
  if (Array.isArray(volumes)) {
    for (const vol of volumes) {
      if (!vol) continue;
      const hostPath = typeof vol === 'string' ? vol.split(':')[0] : vol.hostPath;
      const containerPath = typeof vol === 'string' ? vol.split(':')[1] : vol.containerPath;
      const mode = (typeof vol === 'string' ? vol.split(':')[2] : (vol.mode || (vol.readOnly ? 'ro' : 'rw'))) || 'rw';

      if (!hostPath || !containerPath) continue;

      // Normalize and sanitize paths
      const normalizedHost = path.normalize(hostPath).replace(/\\/g, '/');
      const lowerHost = normalizedHost.toLowerCase();

      // Enforce restricted path policy
      const isRestricted = RESTRICTED_HOST_PATHS.some((p) => lowerHost === p || lowerHost.startsWith(p + '/'));
      if (isRestricted) {
        logger.warn({ hostPath, deploymentId }, 'Security violation: skipped mounting restricted host path');
        continue;
      }

      // Ensure directory exists on host with full write permissions for container user (1000:1000)
      try {
        fs.mkdirSync(hostPath, { recursive: true, mode: 0o777 });
        try { fs.chmodSync(hostPath, 0o777); } catch (_) {}
      } catch (mkdirErr) {
        logger.warn({ mkdirErr, hostPath }, 'Failed to ensure host volume directory before mount');
      }

      binds.push(`${hostPath}:${containerPath}:${mode}`);
    }
  }

  const containerConfig = {
    name: containerName,
    Image: imageTag,
    Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    Labels: labels,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds, // <--- Configured HostConfig.Binds
      NanoCpus: cpuLimit * 1e9,
      Memory: memLimitMb * 1024 * 1024,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: networks[0] || 'bridge',
      SecurityOpt: ['no-new-privileges:true'],
    },
    User: '1000:1000', // never run customer code as root
  };
```

---

### 4.4 Automated End-to-End Pipeline Wiring: `apps/api/src/lib/nodeAgentClient.ts`

To ensure volumes are automatically attached whenever a deployment is created, rebuilt, or restarted, `buildAndRun()` must query persistent volumes from `prisma.deploymentVolume` when not passed explicitly:

```typescript
export interface BuildAndRunParams {
  deploymentId: string;
  repoUrl: string;
  branch?: string;
  subdomain?: string;
  rootDomain?: string;
  deploymentsRootDomain?: string;
  internalPort: number;
  envVars?: Record<string, string>;
  cpuLimit?: number;
  memoryLimit?: number;
  storageLimit?: number;
  backupRepoUrl?: string;
  startCommand?: string;
  entryFile?: string;
  frameworkPreset?: string;
  exposureMode?: string;
  publishedPort?: number;
  builder?: string;
  rootDir?: string | null;
  nixpacksConfig?: any;
  volumes?: Array<{ hostPath: string; containerPath: string; mode?: 'ro' | 'rw' }>; // <--- Added
}
```

Inside `buildAndRun`:
```typescript
  // Load persistent volumes for this deployment if not provided
  let volumes = params.volumes;
  if (!volumes) {
    try {
      const { prisma } = await import('./prisma');
      const dbVolumes = await prisma.deploymentVolume.findMany({
        where: { deploymentId: params.deploymentId },
      });
      volumes = dbVolumes.map((v) => ({
        hostPath: v.hostPath,
        containerPath: v.containerPath,
        mode: 'rw' as const,
      }));
    } catch {
      volumes = [];
    }
  }

  const payload = {
    ...params,
    repoUrl,
    exposureMode: exposure.exposureMode,
    publishedPort: exposure.publishedPort,
    deploymentsRootDomain: params.deploymentsRootDomain || env.deploymentsRootDomain,
    rootDomain: params.rootDomain || env.rootDomain,
    volumes, // <--- Relayed to node-agent
  };
```

In `services/node-agent/src/index.js` (`POST /agent/deployments/:deploymentId/build-and-run`):
```javascript
  const {
    volumes,
    ...
  } = req.body || {};

  ...

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
    volumes: Array.isArray(volumes) ? volumes : [], // <--- Relayed to runContainer
  });
```

---

## 5. Security Architecture & Threat Model

1. **Host Isolation**: Customer volume mounts are strictly jailed to `/var/lib/shanutechx/volumes/<deploymentId>/<volumeName>`. Attempts to pass paths containing `..` or targeting sensitive host mounts (`/var/run/docker.sock`, `/etc`, `/proc`, `/sys`) are rejected by both API and node-agent.
2. **Container Privilege Minimization**: Containers run with `User: '1000:1000'` and `SecurityOpt: ['no-new-privileges:true']`. Volumes mounted with `0777` or owned by `1000:1000` allow full application data writes without granting root privileges on the host filesystem.
3. **Tenant Boundary Protection**: RBAC ownership validation (`canAccessResource(deployment.userId, req)`) precedes all volume operations. Customer A cannot inspect, attach, or delete volumes belonging to Customer B.
4. **Node Agent Gate**: All API-to-Node-Agent volume provisioning requests are secured with `x-agent-secret` using HMAC-SHA256 timing-safe comparison.
