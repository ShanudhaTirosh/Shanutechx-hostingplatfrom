# Formal Handoff Report: Container Management, Build Pipelines, and Reverse Proxy/TLS (R2 & R5)

**Date**: 2026-10-28  
**Author**: Survey Explorer 2 (`teamwork_explorer_survey_2`)  
**Parent Conversation ID**: `3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`  
**Report Artifact**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_survey_2\survey_report.md`  

---

## 1. Observation

Direct observations from codebase inspection with file paths and line numbers:

1. **Dockerode Integration & Privileged Isolation**:
   - `services/node-agent/src/docker.js:1-5`: Dockerode initialized via `const docker = new Docker(process.env.DOCKER_SOCKET ? { socketPath: process.env.DOCKER_SOCKET } : undefined);`.
   - `services/node-agent/src/docker.js:80-89`: Containers run as `User: '1000:1000'` with `SecurityOpt: ['no-new-privileges:true']`.
   - `services/node-agent/src/isolationEngine.js:38-53, 199-205`: `validateAndHardenCompose` explicitly blocks `docker.sock` volume mounts, privileged mode, host network/pid/ipc, and dangerous capabilities.

2. **Persistent Volumes Disconnect**:
   - `apps/api/src/routes/volumes.ts:54-62`: `prisma.deploymentVolume.create` stores volume records in Postgres with `hostPath: /var/lib/shanutechx/volumes/${deployment.id}/${parsed.data.name}`.
   - `apps/api/src/routes/volumes.ts`: Never invokes `node-agent` to create volumes on the host or in Docker.
   - `services/node-agent/src/docker.js:14-115`: `runContainer` accepts NO volume parameter and does not configure `HostConfig.Binds` or `HostConfig.Mounts`. The `deploymentVolume` database records are completely inert.

3. **Missing `run-image` Endpoint in Node Agent**:
   - `apps/api/src/routes/dockerDeployments.ts:122`: API calls `callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`, 'POST', ...)`.
   - `services/node-agent/src/index.js`: Has NO route for `/agent/deployments/:id/run-image`.
   - `apps/api/src/routes/dockerDeployments.ts:132-141`: Fallback executes `buildAndRun` with `repoUrl: "image://${image}"`, which triggers `prepareWorkspace` in `repo.js:141` attempting a `git clone image://${image}` and throwing a failure.

4. **Traefik Configuration & Certificate Resolver Conflicts**:
   - `docker-compose.prod.yml:37`: Traefik uses `--certificatesresolvers.letsencrypt.acme.tlschallenge=true` (named `letsencrypt`).
   - `services/node-agent/src/exposure.js:79`: Container router labels hardcode `traefik.http.routers.${routerName}.tls.certresolver=le`.
   - `services/node-agent/src/customDomain.js:36`: Custom domain routes hardcode `tls: { certResolver: 'le' }`.
   - `templates/*.yaml` (all 10 templates): Hardcode `traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls.certresolver=le`.
   - `docker-compose.prod.yml`: Traefik does NOT enable `--providers.file.directory` or mount `/etc/traefik/dynamic`. As a result, middlewares `security-headers@file,rate-limit@file,gzip-compress@file` required by `exposure.js:80` cannot be resolved by Traefik.

5. **Custom Domain Dynamic File Volume Gap in Control Plane**:
   - `infra/control-plane/docker-compose.yml:87`: Traefik mounts `./traefik/dynamic:/etc/traefik/dynamic:ro`.
   - `infra/control-plane/docker-compose.yml:345-364`: `node-agent` does NOT mount `./traefik/dynamic`.
   - When `node-agent` writes `/etc/traefik/dynamic/custom-${deploymentId}-${safeDomain}.yml` (`services/node-agent/src/customDomain.js:11`), it writes to its own container filesystem, remaining invisible to Traefik.

6. **Simulated Traefik Status**:
   - `apps/api/src/routes/traefikStatus.ts:57-71, 78-82, 88-102, 109-117`: When the Traefik API (`env.traefikApiUrl`) is offline, the API generates simulated fallback data (`buildLocalFallbackRouters()`, simulated middlewares) with `isFallback: true`.

7. **Build Cancellation Deadlock**:
   - `services/node-agent/src/index.js:573-585`: `activeBuilds = new Map()` is checked in `cancel-build`, but `activeBuilds.set()` is never called in `build-and-run` (`index.js:482-570`), making build cancellation purely a no-op.

8. **Secret Leakage via Docker Build Args**:
   - `services/node-agent/src/build.js:243-245`: `dockerArgs.push('--build-arg', `${key}=${value}`)` loops over all `envVars` (including production passwords/tokens) and passes them to `docker build`, baking secrets into image history.

9. **Inconsistent Internal API URL Resolution**:
   - `apps/api/src/routes/catalog.ts:129-131` and `apps/api/src/routes/deployments.ts:577`: Define local `http://${node.ip}:${port}` strings directly. When `node.ip` is `127.0.0.1` inside Docker, this connects to the API container itself rather than `node-agent:5000`.

---

## 2. Logic Chain

1. **Isolation Architecture**: Node Agent's design cleanly separates privileged host Docker access from unprivileged user code. Customer code runs as non-root `1000:1000` with `no-new-privileges: true`. `isolationEngine.js` verifies that compose files do not mount `docker.sock` or request host networking/privileges. Thus, socket isolation from tenants is architecturally sound.
2. **Broken Integrations**: Because `run-image` is missing in `node-agent`, deploying standard Docker images (`dockerDeployments.ts`) fails. Because `volumes.ts` never talks to `node-agent` or configures `Binds` in `docker.js`, the persistent storage requirement is purely a database placeholder.
3. **Traefik Breakdown in Production Compose**: Because `docker-compose.prod.yml` names its certresolver `letsencrypt` and omits the dynamic file provider, while all agent code and templates specify `certresolver=le` and require dynamic file middlewares, deployments in production will fail both middleware resolution and TLS certificate generation.
4. **Volume Sharing Between Daemons**: Custom domains require Traefik to read dynamic configuration files written by `node-agent`. Without a shared volume between `node-agent` and `traefik` in `infra/control-plane/docker-compose.yml`, custom domain routing cannot take effect.

---

## 3. Caveats

1. **Live Host Execution**: Investigation was conducted statically via source code, docker-compose manifests, and unit tests. Physical execution of `docker build` against BuildKit and live ACME challenge resolution against Let's Encrypt requires a running host with external DNS.
2. **VPS Bare-Metal Mode vs Containerized Mode**: Node Agent has two supported deployment modes: as a systemd service running directly on the Linux host (configured via `apps/api/src/jobs/infrastructure-job-processor.ts`), and as a container in Docker Compose (`infra/node-stack/docker-compose.yml`). Certain operations (e.g. `ufw`, `systemctl`, `apt-get` in `nodeEngine.js`) only succeed in bare-metal systemd mode.

---

## 4. Conclusion

The core foundations of R2 (Docker Engine integration, multi-tier build system, container metrics, and log streaming) and R5 (Traefik reverse proxy, custom domain verification, and WAF forwardAuth) are well-architected and largely implemented. However, they cannot currently function end-to-end against real Docker and real Traefik due to four key implementation bugs:
1. Disconnected persistent volume provisioning.
2. Missing `run-image` route in Node Agent.
3. Name and middleware configuration mismatches between `docker-compose.prod.yml` and Traefik dynamic labels.
4. Unshared dynamic configuration volume between `node-agent` and `traefik` in the control plane.

Once the targeted fixes outlined in the technical roadmap in `survey_report.md` are applied, the container management, build pipeline, and reverse proxy routing will be 100% functional against real backends.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Unit Tests for Exposure & Isolation**:
   ```bash
   npm run test:unit
   ```
   Inspect `tests/unit/nodeAgentExposure.test.ts` and `tests/unit/composeIsolationAndSharedAssets.test.ts` to confirm exposure modes and compose security validation rules.

2. **Verify Missing `run-image` Route**:
   Inspect `apps/api/src/routes/dockerDeployments.ts:122` and verify that `callNodeAgent(selectedNode, `/agent/deployments/${deployment.id}/run-image`)` has no corresponding route definition in `services/node-agent/src/index.js`.

3. **Verify Disconnected Persistent Volumes**:
   Inspect `apps/api/src/routes/volumes.ts` and verify that `prisma.deploymentVolume.create` does not call `nodeAgentClient`. Inspect `services/node-agent/src/docker.js:14-115` to verify `runContainer` lacks `volumes` parameter and `HostConfig.Binds`.

4. **Verify Traefik Resolver and Dynamic Middleware Mismatch**:
   Compare line 37 of `docker-compose.prod.yml` (`--certificatesresolvers.letsencrypt.acme.tlschallenge=true`) with line 79 of `services/node-agent/src/exposure.js` (`certresolver=le`) and lines 58-59 of `templates/wordpress.yaml` (`tls.certresolver=le`). Notice that `docker-compose.prod.yml` does not mount `/etc/traefik/dynamic`.

5. **Verify Control Plane Dynamic Volume Mount Gap**:
   Inspect `infra/control-plane/docker-compose.yml`: notice line 87 mounts `./traefik/dynamic:/etc/traefik/dynamic:ro` to `traefik`, while the `node-agent` service definition (lines 345–372) has no mount for `./traefik/dynamic`.
