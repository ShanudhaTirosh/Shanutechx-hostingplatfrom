# Comprehensive Architecture & Audit Report: Container Management, Build Pipelines, and Reverse Proxy/TLS (R2 & R5)

**Date**: 2026-10-28  
**Author**: Survey Explorer 2 (`teamwork_explorer_survey_2`)  
**Scope**: Requirements R2 (Container Management & Build System) and R5 (Reverse Proxy, TLS, Networking, and Hardening)  
**Target Repository**: `c:\Users\tiros\OneDrive\Desktop\shanutechx`  

---

## Executive Summary

An exhaustive investigation of the repository was conducted across `apps/api`, `services/node-agent`, `infra/`, `templates/`, `docker/`, and associated configuration and test suites.

The core architecture follows a **Control Plane & Distributed Node Agent** design:
1. **API Gateway / Control Plane (`apps/api`)**: Runs Express.js with Prisma ORM, BullMQ workers, and Redis. It handles authentication, role-based access control, tenant isolation, subdomain provisioning, secrets encryption, and proxies container operations to target nodes via `apps/api/src/lib/nodeAgentClient.ts`.
2. **Node Agent Daemon (`services/node-agent`)**: Runs on each compute host (or as a privileged Docker container). It integrates with the host Docker Engine via `dockerode`, runs the multi-tier build engine (`services/node-agent/src/build.js`), enforces container isolation (`services/node-agent/src/isolationEngine.js`), provides WAF checking via Traefik `forwardAuth` (`services/node-agent/src/waf.js`), manages Traefik custom domain routes (`services/node-agent/src/customDomain.js`), and manages Docker Compose stacks (`services/node-agent/src/nodeEngine.js`).
3. **Reverse Proxy & TLS Gateway**: Powered by Traefik (v2.11 in `infra/control-plane`, v3.1 in `infra/node-stack`, v3.0 in `docker-compose.prod.yml`). It handles SSL termination via Let's Encrypt (ACME HTTP challenge), container discovery via the Docker provider, and custom domains via the Dynamic File Provider.

While substantial production-grade code exists, our investigation uncovered **critical discrepancies, broken integration routes, simulated fallbacks, and volume mount disconnects** that must be resolved to achieve full production readiness.

---

## 1. Docker Engine API Integration & Container Management

### 1.1 Dockerode Integration & Socket Access Architecture
- **Location**: `services/node-agent/src/docker.js` (lines 1–5, 567–610) and `services/node-agent/src/nodeEngine.js` (lines 18–24).
- **Socket Connection**:
  ```javascript
  const Docker = require('dockerode');
  const docker = new Docker(process.env.DOCKER_SOCKET ? { socketPath: process.env.DOCKER_SOCKET } : undefined);
  ```
  If `DOCKER_SOCKET` is omitted, Dockerode defaults to `/var/run/docker.sock` on Linux/macOS and `//./pipe/docker_engine` on Windows.
- **Docker Socket Isolation & Security**:
  - Raw Docker socket access is strictly confined to the `node-agent` daemon. Neither customer containers nor client browsers ever get direct socket access.
  - In `services/node-agent/src/isolationEngine.js` (lines 38–53, 199–205), `validateAndHardenCompose` explicitly rejects any compose service mounting `/var/run/docker.sock` or `run/docker.sock`.
  - In `services/node-agent/src/docker.js` (lines 80–89), customer containers are launched with:
    ```javascript
    User: '1000:1000', // never run customer code as root
    HostConfig: {
      SecurityOpt: ['no-new-privileges:true'],
      NanoCpus: cpuLimit * 1e9,
      Memory: memLimitMb * 1024 * 1024,
      RestartPolicy: { Name: 'unless-stopped' },
    }
    ```
- **Control Plane Gateway Protection**:
  - `apps/api/src/routes/containers.ts` (lines 20–23) guards all container management endpoints with `useForOwnRoutes(containersRouter, requireAuth, requireAdminOrDev)` and validates all container IDs with `/^[a-zA-Z0-9_\-\.]{1,128}$/`.
  - Protected system containers (`traefik`, `postgresql`, `redis`, `shanutechx-agent`, `shanutechx-api`) are safeguarded against accidental deletion in `containers.ts:97-102`.
  - API-to-Node-Agent communication is authenticated via HMAC-SHA256 timing-safe comparison on `x-agent-secret` (`services/node-agent/src/index.js:64-92`).

### 1.2 Container Lifecycle Management
The following lifecycle methods are fully implemented in `services/node-agent/src/docker.js` and exposed via `services/node-agent/src/index.js`:
- **Create & Start**: `runContainer` (`docker.js:14-115`)
- **Stop**: `stopContainer` (`docker.js:131-134`), called by `POST /agent/containers/:containerId/stop` (`index.js:129`)
- **Start**: `startContainer` (`docker.js:175-178`), called by `POST /agent/containers/:containerId/start` (`index.js:119`)
- **Restart**: `restartContainer` (`docker.js:137-140`), called by `POST /agent/containers/:containerId/restart` (`index.js:149`)
- **Remove**: `stopAndRemove` (`docker.js:126-129`), called by `DELETE /agent/containers/:containerId` (`index.js:139`)
- **Inspect**: `inspectContainer` (`docker.js:152-155`), called by `GET /agent/containers/:containerId/inspect` (`index.js:170`)
- **Extended Controls**: `pauseContainer`, `unpauseContainer`, `renameContainer`, `containerTop` (processes), `containerChanges` (filesystem diffs) (`docker.js:267-292`).

### 1.3 Streaming Logs & Demultiplexing
- **Mechanism** (`services/node-agent/src/docker.js:185-217`):
  Docker daemon multiplexes stdout and stderr using an 8-byte binary header per frame (1 byte stream type, 3 bytes unused, 4 bytes big-endian length).
  `docker.js` uses Dockerode's `docker.modem.demuxStream(rawStream, out, out)` to demultiplex into plain text onto a `PassThrough` stream:
  ```javascript
  async function streamLogs(containerId) {
    const container = docker.getContainer(containerId);
    const rawStream = await container.logs({ follow: true, stdout: true, stderr: true, tail: 100, timestamps: false });
    const { PassThrough } = require('stream');
    const out = new PassThrough();
    docker.modem.demuxStream(rawStream, out, out);
    ...
    return out;
  }
  ```
- **SSE Delivery**:
  - `services/node-agent/src/index.js:619`: `GET /agent/deployments/:containerId/logs/stream` emits `Content-Type: text/event-stream`.
  - `apps/api/src/lib/nodeAgentClient.ts:streamNodeAgentSSE`: Pipes upstream SSE to client browser and cleans up upstream streams when the browser disconnects.

### 1.4 Container Health Checks & Resource Monitoring
- **Health Checks**:
  - Application containers spawned via `runContainer` (`docker.js:75-95`) **omit** the `Healthcheck` configuration object in `containerConfig`. They rely entirely on instructions inside the container image or external HTTP/TCP probes.
  - Platform services in compose files include explicit health checks (e.g. `pg_isready` for Postgres, `redis-cli ping` for Redis, HTTP GET for API and Node Agent).
  - External synthetic monitoring in `apps/api/src/lib/uptimeMonitor.ts` conducts TCP, HTTP, DNS, and TLS checks.
- **Resource Monitoring**:
  - **Snapshot Metrics** (`docker.js:223-261`): Calculates CPU % usage delta `(cpuDelta / systemDelta) * onlineCpus * 100`, memory used vs limit (filtering out host limits > 1TB), and writable layer storage disk usage `info.SizeRw`.
  - **Live Streaming Stats** (`docker.js:298-371`): `GET /agent/containers/:containerId/stats/stream` streams SSE events with real-time CPU %, Memory MB/%, Network RX/TX bytes, Block I/O read/write bytes, and PID count.

### 1.5 Docker Networks
- Implemented in `services/node-agent/src/docker.js:466-504` (`listNetworks`, `createNetwork`, `removeNetwork`, `inspectNetwork`, `pruneNetworks`).
- Network Isolation:
  - Containers join public ingress network (`shanutechx-public` / `shanutechx-prod`) only when public routing is required (`exposure.joinPublicNetwork === true`).
  - Optional private network support: `privateNetworkName` creates an isolated bridge network for project services (`docker.js:65-73`).

### 1.6 Persistent Volumes & The "Disconnected Volume" Defect
- Implemented in `services/node-agent/src/docker.js:430-461` (`listVolumes`, `createVolume`, `removeVolume`, `inspectVolume`, `pruneVolumes`).
- **CRITICAL DEFECT IDENTIFIED**:
  In `apps/api/src/routes/volumes.ts` (lines 43–67), users can create persistent volumes:
  ```typescript
  const hostPath = `/var/lib/shanutechx/volumes/${deployment.id}/${parsed.data.name}`;
  const volume = await prisma.deploymentVolume.create({ data: { deploymentId: deployment.id, name, hostPath, containerPath, sizeGb } });
  ```
  **However**:
  1. `volumes.ts` never calls `createNodeVolume` or any endpoint on `node-agent`.
  2. `deployPipeline.ts` never queries `prisma.deploymentVolume` during deployment.
  3. `runContainer` in `services/node-agent/src/docker.js:14-115` has **no parameter** for volume mounts and does not configure `HostConfig.Binds` or `HostConfig.Mounts`.
  4. The `deploymentVolume` table in PostgreSQL is completely disconnected from Docker Engine.

### 1.7 Docker Compose Stacks & Multi-Tenant Jailing
- **Validation Engine** (`services/node-agent/src/isolationEngine.js:84-287`):
  Deeply inspects and sanitizes compose YAML before execution:
  - Prohibits `privileged: true`, `network_mode: host`, `pid: host`, `ipc: host`, `userns_mode: host`.
  - Prohibits dangerous capabilities (`SYS_ADMIN`, `NET_ADMIN`, `SYS_MODULE`, etc.).
  - Prohibits host devices.
  - Prohibits `/var/run/docker.sock` and directory traversal (`..`) in volume mounts.
  - Jails volume mounts: only named volumes or `./` relative paths are permitted. Absolute host paths are blocked unless mounting `SHARED_CACHE_DIR` with `:ro`.
  - Enforces Traefik router naming isolation: all router names must include `${COMPOSE_PROJECT_NAME}` to prevent cross-tenant router hijacking.
  - Injects `no-new-privileges: true` and default deploy limits (`cpus: 1.5`, `memory: 1G`, `pids_limit: 256`).
- **Stack Execution** (`services/node-agent/src/index.js:1727-1800`):
  - Endpoints: `POST /agent/compose/up`, `DELETE /agent/compose/:project`, `GET /agent/compose/:project/logs`, `POST /agent/compose/:project/start`, `stop`, `restart`.
  - Writes compose files to `${COMPOSE_DIR}/${safeProject}/docker-compose.yml`, pulls images, and executes `docker compose -p <project> up -d --remove-orphans`.

---

## 2. Build Pipeline Architecture & Execution

### 2.1 Multi-Tier Build Engine Strategy
Implemented in `services/node-agent/src/build.js:252-391`:

```
┌────────────────────────────────────────────────────────┐
│                   buildImage() Mode                    │
│   (builder: 'AUTO' | 'RAILWAYPACK' | 'NIXPACKS' |      │
│             'DOCKERFILE')                              │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    Custom Dockerfile in repo?   No Dockerfile / AUTO
             │                           │
             │                           ▼
             │                  [Tier 1: Railpack CLI]
             │                  railpack build <dir>
             │                           │
             │                      (On failure)
             │                           ▼
             │                  [Tier 2: Nixpacks CLI]
             │                  nixpacks build <dir>
             │                           │
             │                      (On failure)
             │                           ▼
             │               [Tier 3: Nixpacks Container]
             │               docker run ... ghcr.io/railwayapp/nixpacks
             │                           │
             │                      (On failure)
             │                           ▼
             └─────────────────► [Tier 4: Smart Docker Engine]
                                 generateSmartDockerfile() +
                                 docker build -t <tag> .
```

1. **Tier 1: Railpack CLI** (`build.js:316-332`):
   Invokes `railpack build <dir> --name <imageTag>`. Railway's successor to Nixpacks; requires BuildKit backend via `BUILDKIT_HOST=docker-container://buildkit`.
2. **Tier 2: Nixpacks CLI** (`build.js:335-351`):
   Invokes `nixpacks build <dir> --name <imageTag>`.
3. **Tier 3: Containerized Nixpacks Runner** (`build.js:354-377`):
   Runs `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v <workspaceDir>:/app ghcr.io/railwayapp/nixpacks:latest build /app --name <imageTag>`.
4. **Tier 4: Smart Dockerfile Auto-Detector & Generator** (`build.js:31-166, 224-250`):
   Detects runtime and writes an optimized multi-stage `Dockerfile` in the workspace before executing `docker build -t <imageTag> .`.

### 2.2 Framework Detection Logic
Implemented in `services/node-agent/src/build.js:31-166`:
| Detected Files / Presets | Identified Runtime | Generated Base Image | Build & Run Commands |
|---|---|---|---|
| `package.json` | `nodejs` | `node:20-alpine` | `npm install --production=false`, `npm run build` (if present or Next.js), `npm start` |
| `package.json` with `vite` | `nodejs` (SPA) | `node:20-alpine` | `npx serve -s dist -l 3000` (or `build` or `.`) |
| `requirements.txt` / `pyproject.toml` / `main.py` / `app.py` | `python` | `python:3.11-slim` | `pip install --no-cache-dir -r requirements.txt`, `python main.py` |
| `go.mod` | `go` | `golang:1.22-alpine` -> `alpine:latest` | `go build -o server .` (multi-stage binary) |
| `Cargo.toml` | `rust` | `rust:1.78-alpine` -> `alpine:latest` | `cargo build --release` (multi-stage binary) |
| `Lavalink.jar` / `lavalink_java` | `java-lavalink` | `eclipse-temurin:17-jre-alpine` | `java -jar Lavalink.jar` |
| `index.php` / `composer.json` | `php` | `php:8.2-apache` | Apache foreground with mod_rewrite |
| `index.html` | `static-html` | `nginx:alpine` | Static Nginx serving `/usr/share/nginx/html` |
| None of the above | `generic-fallback` | `alpine:latest` | Fallback keep-alive container |

### 2.3 Secret Handling & Environment Variables
- **Storage**: `envVars` are encrypted using AES-256-GCM in PostgreSQL (`envVarsEncrypted`) via `apps/api/src/lib/secretsVault.ts`.
- **Git Credentials**:
  - `apps/api/src/lib/gitAuth.ts:stripRepoCredentials` strips tokens from the URL before saving to DB.
  - `services/node-agent/src/repo.js:splitCredentials` strips inline auth from the clone URL and passes credentials securely to `git` through `GIT_CONFIG_KEY_0=http.extraHeader` and `GIT_CONFIG_VALUE_0=Authorization: Basic ...`. This avoids exposing credentials in `ps` output or writing them to `.git/config`.
  - All logs in `repo.js:run` are scrubbed through `redact(text, secrets)`.
- **CRITICAL DEFECT — Secret Leaking via `--build-arg`**:
  In `services/node-agent/src/build.js:243-245`:
  ```javascript
  const dockerArgs = ['build', '-t', imageTag, '.'];
  for (const [key, value] of Object.entries(envVars)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }
  ```
  Passing customer runtime secrets (e.g. database credentials, API keys) as `--build-arg` bakes them in cleartext into the Docker image metadata (`docker history`). Runtime environment variables should only be passed to `runContainer` (`Env: [...]`) and not as build arguments unless explicitly marked as build-time variables.

### 2.4 Build Log Streaming & Broken Cancellation
- **Streaming**:
  `services/node-agent/src/index.js:510-540` sets `Content-Type: application/x-ndjson` and streams JSON chunks with phase notifications (`fetch`, `build`, `run`, `done`, `error`) and real-time build logs from `child_process.stdout/stderr`.
  `apps/api/src/lib/nodeAgentClient.ts:buildAndRun` reads the NDJSON stream chunk-by-chunk and relays it to caller callbacks.
- **BROKEN BUILD CANCELLATION**:
  In `services/node-agent/src/index.js:573-585`:
  ```javascript
  const activeBuilds = new Map();
  app.post('/agent/deployments/:deploymentId/cancel-build', async (req, res) => {
    const build = activeBuilds.get(deploymentId);
    if (build) { ... }
  });
  ```
  `activeBuilds.set(deploymentId, ...)` is **never called** anywhere in `build-and-run`! The map remains permanently empty, so any call to `cancel-build` immediately returns without terminating the running build process.

---

## 3. Reverse Proxy, TLS, and Networking

### 3.1 Traefik Configurations Across Stacks
The repository defines Traefik in three distinct locations with substantial discrepancies:

| Compose File | Traefik Version | Certificates Resolver Name | ACME Challenge Type | Dynamic File Provider | Middlewares Mounted? |
|---|---|---|---|---|---|
| `docker-compose.prod.yml` | `v3.0` | `letsencrypt` | `tlschallenge=true` | **None** | **No** (Missing) |
| `infra/control-plane/docker-compose.yml` | `v2.11` | `le` | `httpchallenge=true` | `/etc/traefik/dynamic` | **Yes** (`./traefik/dynamic:ro`) |
| `infra/node-stack/docker-compose.yml` | `v3.1` | `le` | `httpchallenge=true` | `/etc/traefik/dynamic` | **Empty Volume** (`traefik-dynamic`) |
| `docker-compose.local.yml` | **None** | N/A | N/A | N/A | N/A |

### 3.2 Dynamic Ingress Routing & Label Resolution
Implemented in `services/node-agent/src/exposure.js:27-100`:
- **Modes**:
  - `ssl_with_proxy` (default): Uses Traefik with TLS resolver `le`, attaches `security-headers@file,rate-limit@file,gzip-compress@file`, and wires WAF forwardAuth.
  - `ssl_direct`: Uses Traefik with `tls: true` (default self-signed cert) and `gzip-compress@file`.
  - `no_ssl` / `raw_tcp`: Bypasses Traefik entirely, maps host ports in Docker (`PortBindings: { "${internalPort}/tcp": [{ HostPort: "${publishedPort}" }] }`).
  - `internal_only`: No Traefik labels, no host port bindings, stays on private bridge network.

### 3.3 Traefik Dynamic File Provider & Middlewares
In `infra/control-plane/traefik/dynamic/middlewares.yml`:
- `security-headers`: Sets `frameDeny`, `sslRedirect`, `browserXssFilter`, `contentTypeNosniff`, `stsSeconds: 31536000`, `customFrameOptionsValue: SAMEORIGIN`, and CSP.
- `rate-limit`: Average 100 req/min, burst 50.
- `gzip-compress`: Gzip compression.
- `redirect-to-https`: Permanent HTTPS redirect.

**CRITICAL INCONSISTENCY**:
1. In `docker-compose.prod.yml`, Traefik does not mount `/etc/traefik/dynamic` and does not configure `--providers.file.directory`. When containers launched with `exposure.js` specify `middlewares=security-headers@file,rate-limit@file,gzip-compress@file`, Traefik v3.0 fails with: `middleware "security-headers@file" does not exist`.
2. In `docker-compose.prod.yml`, Traefik defines certresolver `letsencrypt`, whereas `exposure.js`, `customDomain.js`, and all 10 template YAML files (`templates/*.yaml`) request `tls.certresolver=le`. As a result, no TLS certificates can be resolved under `docker-compose.prod.yml`.

### 3.4 Custom Domain Routing
- **Mechanism** (`services/node-agent/src/customDomain.js:23-53`):
  Generates dynamic Traefik configuration files in `/etc/traefik/dynamic/custom-${deploymentId}-${safeDomain}.yml`:
  ```yaml
  http:
    routers:
      customdomain-${deploymentId}:
        rule: Host(`${domain}`)
        entryPoints: [websecure]
        tls:
          certResolver: le
        service: customdomain-${deploymentId}
    services:
      customdomain-${deploymentId}:
        loadBalancer:
          servers:
            - url: http://deploy-${deploymentId}:${targetPort}
  ```
- **Control Plane Verification** (`apps/api/src/lib/domainManager.ts`):
  - Validates CNAME record target using `dns.promises.resolveCname` (`apps/api/src/lib/customDomain.ts`).
  - Once verified, calls `POST /agent/deployments/:deploymentId/domains` on `node-agent` to write the dynamic YAML.
- **DEFECT IN CONTROL PLANE VOLUME MOUNT**:
  In `infra/control-plane/docker-compose.yml`, Traefik mounts `./traefik/dynamic:/etc/traefik/dynamic:ro`, but `node-agent` **does not mount** `./traefik/dynamic`. When `node-agent` writes the custom domain file to its local `/etc/traefik/dynamic`, Traefik on the host never sees the file!

### 3.5 WAF Integration via Traefik ForwardAuth
- **Mechanism** (`services/node-agent/src/exposure.js:90-96` and `services/node-agent/src/waf.js`):
  Traefik forwardAuth middleware intercepts every proxied request and calls:
  `GET http://node-agent:5000/agent/waf-check/${deploymentId}?secret=${agentSecret}`
  - If WAF evaluation blocks or rate-limits the client IP, `node-agent` returns HTTP 403 or 429, which Traefik returns directly to the user.
  - If password protection is enabled, `node-agent` prompts for HTTP Basic Auth and verifies the password against a cached bcrypt hash (`PasswordGate`).
  - If the request is permitted, `node-agent` returns HTTP 200 and Traefik forwards the request to the backend container.

---

## 4. Audit of Mocked, Stubbed, and Broken Implementations

| Area | File & Line Reference | Current Status / Implementation | Impact / Root Cause |
|---|---|---|---|
| **Traefik Overview & Routes** | `apps/api/src/routes/traefikStatus.ts:57-117` | **Simulated / Mocked Fallback** | When Traefik API (`:8080`) is offline, it generates fake routers, services, and middlewares from database rows (`isFallback: true`). |
| **Persistent Volumes** | `apps/api/src/routes/volumes.ts:43-85` | **Disconnected / DB Only** | Inserts `deploymentVolume` records into Postgres; never provisions Docker volumes and never mounts them in `runContainer`. |
| **Docker Run Image Route** | `apps/api/src/routes/dockerDeployments.ts:122` | **Missing / Broken Endpoint** | Calls `POST /agent/deployments/:id/run-image` on `node-agent`, which does not exist. Falls back to `buildAndRun` with `image://` which fails `git clone`. |
| **Build Cancellation** | `services/node-agent/src/index.js:573-585` | **Stubbed / Ineffective** | `activeBuilds.set()` is never invoked; calling `cancel-build` never finds or kills any active build process. |
| **Traefik Cert Resolver Mismatch** | `docker-compose.prod.yml:37` vs `services/node-agent/src/exposure.js:79` | **Configuration Conflict** | Prod compose names resolver `letsencrypt`, while code and all 10 templates use `le`. TLS certificate issuance fails on prod. |
| **Missing Traefik Middlewares** | `docker-compose.prod.yml` | **Missing Configuration** | Prod compose does not mount dynamic middlewares or enable file provider; containers referencing `security-headers@file` fail. |
| **Custom Domain Mount Gap** | `infra/control-plane/docker-compose.yml:357` | **Broken Volume Sharing** | `node-agent` does not mount `./traefik/dynamic`. Dynamic custom domain YAML files written by `node-agent` are invisible to Traefik. |
| **Node Agent Internal URL in API** | `apps/api/src/routes/catalog.ts:129`, `apps/api/src/routes/deployments.ts:577` | **Localhost Hardcoding Bug** | Directly formats `http://${node.ip}:${port}`, failing when `node.ip` is `127.0.0.1` inside Docker instead of using `agentUrl()` / `node-agent`. |
| **Docker Compose Temp Directory Cleanup** | `services/node-agent/src/nodeEngine.js:546-548` | **premature directory deletion** | `deployDockerCompose` deletes the temporary compose directory in a `finally` block, destroying compose files needed for subsequent `down` or `logs`. |
| **Secret Leaking in Build Args** | `services/node-agent/src/build.js:244` | **Security Leak** | Passes all runtime `envVars` as `--build-arg` to `docker build`, leaking credentials in image layer metadata. |
| **Containerized Nixpacks Mount Path** | `services/node-agent/src/build.js:361` | **Container-in-Container Mount Bug** | Uses `-v ${workspaceDir}:/app`. Inside a containerized agent, this path does not exist on the host Docker daemon. |

---

## 5. Technical Roadmap to Connect to Real Docker Engine and Real Traefik

### Phase 1: Unify Traefik Configuration and Fix TLS Cert Resolvers
1. **Standardize Cert Resolver Name**:
   Update `docker-compose.prod.yml` to rename `--certificatesresolvers.letsencrypt` to `--certificatesresolvers.le` and use HTTP challenge on entrypoint `web`, aligning with `infra/control-plane`, `infra/node-stack`, `exposure.js`, and all templates.
2. **Mount Traefik Dynamic Directory in All Stacks**:
   In `docker-compose.prod.yml`:
   - Add volume or host bind mount: `./infra/control-plane/traefik/dynamic:/etc/traefik/dynamic:ro` to `traefik`.
   - Add `--providers.file.directory=/etc/traefik/dynamic` and `--providers.file.watch=true` to `traefik` command.
   - Mount `./infra/control-plane/traefik/dynamic:/etc/traefik/dynamic` (RW) to `node-agent` so custom domain writes are immediately picked up by Traefik.
3. **Pre-populate Middlewares on Worker Nodes**:
   Ensure `infra/node-stack` copies `middlewares.yml` into `traefik-dynamic` during initialization so nodes hosting customer containers can resolve `security-headers@file,rate-limit@file,gzip-compress@file`.
4. **Local Self-Signed / Fallback TLS**:
   Configure a default self-signed fallback certificate resolver in Traefik so local development environments without public ACME challenge access do not fail TLS connections.

### Phase 2: Connect Container Volumes and Fix Missing Routes
1. **Implement `POST /agent/deployments/:deploymentId/run-image` in Node Agent**:
   Add this route in `services/node-agent/src/index.js` to accept `{ image, internalPort, envVars, exposureMode, cpuLimit, memLimitMb, subdomain }`, call `docker.pullImage()`, and invoke `docker.runContainer()`.
2. **Connect Persistent Volumes End-to-End**:
   - In `services/node-agent/src/docker.js:runContainer`, add a `volumes` parameter to accept array of `{ hostPath, containerPath, readOnly }`.
   - Add `Binds: volumes.map(v => `${v.hostPath}:${v.containerPath}${v.readOnly ? ':ro' : ''}`)` to `HostConfig`.
   - In `apps/api/src/lib/deployPipeline.ts`, load all `prisma.deploymentVolume` records for the deployment and pass them to `buildAndRun` / `runContainer`.
   - In `apps/api/src/routes/volumes.ts`, call `node-agent` to ensure `/var/lib/shanutechx/volumes/<deploymentId>/<name>` exists on the target node host with appropriate permissions (`chown 1000:1000`).

### Phase 3: Harden Build Pipelines and Secret Isolation
1. **Prevent Secret Leaks in Docker Build**:
   In `services/node-agent/src/build.js:executeDockerBuild`, separate runtime environment variables from build-time arguments. Only pass variables explicitly prefixed with `BUILD_ARG_` or declared in `nixpacksConfig.variables` as `--build-arg`.
2. **Fix Build Process Tracking and Cancellation**:
   In `services/node-agent/src/build.js`, return child process references or cancellation tokens from `run()`. In `services/node-agent/src/index.js:build-and-run`, register the active process in `activeBuilds.set(deploymentId, process)` and delete it in `finally`.
3. **Fix Container-in-Container Workspace Pathing**:
   When `node-agent` runs in Docker, configure `HOST_WORKSPACES_DIR` so containerized builders (e.g. Nixpacks container in Tier 3) mount the true host directory path rather than the container's internal mount path.

### Phase 4: Fix Internal API Routing for Local Nodes
1. In `apps/api/src/routes/catalog.ts` and `apps/api/src/routes/deployments.ts`, replace private `nodeAgentUrl` implementations with the centralized `agentUrl()` from `apps/api/src/lib/nodeAgentClient.ts`.
2. Use `streamNodeAgentSSE` for all SSE log streaming routes to prevent connection leaks and handle aborts cleanly.
