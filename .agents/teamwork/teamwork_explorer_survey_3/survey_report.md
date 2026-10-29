# Comprehensive Survey & Audit Report: Supabase, Managed Databases, Git Deployments, Service Catalog, Remote Infrastructure & Email (R3, R4, R5)

**Date**: 2026-10-28  
**Author**: teamwork_explorer_survey_3  
**Working Directory**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_survey_3\`  
**Target Milestone**: Milestone 1 Baseline & Forensic Gap Analysis  
**Repository Scope**: R3 (Supabase & Managed Databases), R4 (Git Deployments & Catalog), R5 (Remote Infra & Email)

---

## 1. Executive Summary

This investigation conducted an exhaustive forensic audit of the self-hostable cloud platform codebase across requirements **R3 (Self-Hosted Supabase & Managed Databases)**, **R4 (Application Git Deployments & Service Catalog)**, and **R5 (Remote Infrastructure & WildDuck/SMTP Email Services)**.

### High-Level Summary of Findings:
1. **Self-Hosted Supabase (R3)**:
   - **Architecture Exists**: A 9-to-11 container compose stack generator (`buildSupabaseComposeYaml` in `apps/api/src/routes/supabase.ts:460-684`) coordinates `supabase-db` (PostgreSQL 15), `supabase-meta`, `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), `supabase-storage`, `supabase-imgproxy`, `supabase-edge-runtime`, `supabase-supavisor`, `supabase-realtime`, `supabase-kong`, and optional per-project Studio.
   - **Central Studio Platform Simulation**: An API router (`apps/api/src/routes/studioPlatform.ts:1-386`) simulates the official Supabase Management API so a central Studio UI can manage projects across nodes.
   - **Critical Vulnerabilities & Stubs**:
     - **Zero Data Persistence**: In `buildSupabaseComposeYaml` (lines 480-501 and 550-565), `supabase-db` and `supabase-storage` have **no persistent volume mounts** defined. Container restart or recreation destroys all database and storage data.
     - **Unpublished Meta Port**: `supabase-meta` runs on internal port 8080 without a host port mapping, yet API calls in `supabase.ts:238` and `studioPlatform.ts:355` attempt direct HTTP calls to `http://${nodeIp}:8080`, leading to connection failures.
     - **Hardcoded / Simulated Health**: `GET /supabase/health` (lines 269-321) hardcodes gotrue, postgrest, storage, functions, and studio to `'healthy'`. Realtime returns `'healthy'` unconditionally (`realtimeRes.ok ? 'healthy' : 'healthy'`).
     - **Simulated Endpoints**: Edge functions (`/supabase/functions`), observability metrics (`/supabase/observability`), logs (`/supabase/logs`), and integrations (`/supabase/integrations`) return hardcoded synthetic payloads with `isFallback: true` or `Math.random()` numbers.
     - **Missing Backup & Restore**: While `JobType` defines `supabase_backup` and `supabase_restore`, they are completely unimplemented in the API, the job processor (`infrastructure-job-processor.ts`), and the node-agent.

2. **Managed Databases (R3)**:
   - **Supported Engines**: PostgreSQL (`postgres:16-alpine`), MySQL (`mysql:8`), Redis (`redis:7-alpine`), and MongoDB (`mongo:7`) are implemented in `services/node-agent/src/managedDb.js`.
   - **MariaDB Missing**: MariaDB is absent from `ManagedDatabaseType` in `schema.prisma:145-150`, missing from the API Zod validator (`managedDatabases.ts:31`), and missing from `managedDb.js`.
   - **Zero Data Persistence**: In `services/node-agent/src/managedDb.js:52-64`, containers are created with **no `Binds` or volume mounts** in `HostConfig`. All databases run ephemerally inside container overlay layers.
   - **Fake Metrics (Math.random)**: In `apps/api/src/routes/managedDatabases.ts:1559-1560`, CPU and RAM metrics are generated using `Math.random() * 25 + 10` and `120 + Math.random() * 80` rather than querying container cgroup/Docker stats.
   - **Backups & Restore**: Real snapshot dump logic exists in `managedDb.js:286-488` (using `pg_dumpall`, `mysqldump`, `redis-cli SAVE`, `mongodump`), and S3/R2 upload works in `managedDatabases.ts:1140-1170`. However, local backup creation does not create a `DatabaseBackup` DB record.

3. **Application Git Deployments (R4)**:
   - **Working Core**: GitHub App integration (`apps/api/src/routes/gitConnect.ts` and `apps/api/src/lib/gitProviders/github.ts`) mints short-lived (1-hour) installation tokens via App JWT without persisting raw user credentials.
   - **Webhook & Pipeline**: `POST /deploy-webhooks/:deploymentId` verifies GitHub HMAC-SHA256 (`X-Hub-Signature-256`) and monorepo `watchPaths`. The build engine (`services/node-agent/src/build.js`) implements multi-tier building (Railpack CLI, Nixpacks CLI, Dockerfile, Smart Dockerfile). Real-time build logs stream via NDJSON, and runtime logs stream via SSE.
   - **Sub-Second Rollback Gap**: Rollback (`deployments.ts:2051-2125`) swaps a `DeploymentPointer` to an existing *running* container (`targetDeploymentId`), but git push redeployments mutate the active deployment record in place without generating historical immutable release versions.

4. **Service Catalog (R4)**:
   - **Compose Templates**: 10 templates (`templates/*.yaml`) cover Grafana, Hermes Agent, Lavalink, LiveKit, MongoDB, n8n, Redis, Supabase Lite, Uptime Kuma, and WordPress.
   - **Real Provisioning**: `POST /catalog/deploy` (`catalog.ts:247-620`) generates missing secrets, claims deployment slots, and calls node-agent `/agent/compose/up` to pull images and start Docker Compose stacks.
   - **Health Monitoring Gap**: The catalog immediately marks deployments as `running` without post-provision readiness polling or container health checks.

5. **Remote Infrastructure & Email (R5)**:
   - **Node Agent & Cluster Watchdog**: Real node enrollment via SSH (`install.sh`, systemd service creation, DNS A-record registration in `infrastructure-job-processor.ts:27-210`). The watchdog (`nodeMonitor.ts`) and failover engine (`failoverEngine.ts`) evacuate workloads on node death.
   - **VPS SSH / SFTP / Firewall**: Full SSH/SFTP management in `vps.ts:1-1162` allows live SFTP file operations, SSH terminal web tickets, and UFW firewall rules.
   - **Cloud VPS API Gap**: `apps/api/src/routes/leaseweb.ts` and `leasewebClient.ts` were deleted in commit `875851b5`. Automated VPS purchases are absent; VPS orders fall back to manual admin provisioning queues.
   - **WildDuck Email Engine**: Extensive client (`wildduckClient.ts:1-595`) and routes (`email.ts:2507-2894`) manage mail hosts, users, mailboxes, and DKIM keys. However, `POST /smtp-accounts` in `smtp.ts` only writes to Prisma without calling WildDuck, and `mailbox_provision` in BullMQ is never dispatched.

---

## 2. Detailed Forensic Analysis: Self-Hosted Supabase (R3)

### 2.1 Architecture and Topology
The platform provides two complementary Supabase provisioning models:
1. **Full Independent Supabase Stack (`SupabaseClientProject`)**:
   - Location: `apps/api/src/routes/supabase.ts` and `apps/api/src/jobs/infrastructure-job-processor.ts:242-326`.
   - Provisions 11 containers coordinated by a Kong API Gateway on the target node.
   - Model definition: `packages/db/prisma/schema.prisma:1332-1363`.
2. **Platform Studio Management Hub (`studioPlatformRouter`)**:
   - Location: `apps/api/src/routes/studioPlatform.ts:1-386`.
   - Implements Supabase Management API endpoints (`/platform/profile`, `/platform/organizations`, `/platform/projects/:ref`, etc.) to interface with the central Supabase Studio instance.

### 2.2 Stack Service Audit Matrix

| Service | Image | Compose Configuration | Status | Evidence / Line Ref |
|---|---|---|---|---|
| **PostgreSQL** | `supabase/postgres:15.6.1.143` | `POSTGRES_PASSWORD`, `POSTGRES_DB: postgres`, healthcheck `pg_isready -U postgres` | **DEGENERATE**: Missing persistent volume mount. Data is lost upon container restart. | `supabase.ts:481-501` |
| **Meta Service** | `supabase/postgres-meta:v0.84.2` | Connects to `supabase-db:5432` | **BROKEN ROUTING**: Port 8080 is NOT published to host. API calls to `nodeIp:8080` fail with `ECONNREFUSED`. | `supabase.ts:502-516, 238` |
| **GoTrue (Auth)** | `supabase/gotrue:v2.164.0` | `GOTRUE_DB_DATABASE_URL`, `GOTRUE_JWT_SECRET`, `GOTRUE_SITE_URL` | Operational, depends on postgres | `supabase.ts:517-535` |
| **PostgREST** | `postgrest/postgrest:v12.2.0` | `PGRST_DB_URI`, `PGRST_DB_SCHEMAS: public,storage` | Operational, depends on postgres | `supabase.ts:536-549` |
| **Storage API** | `supabase/storage-api:v1.14.5` | `FILE_STORAGE_BACKEND_PATH: /var/lib/storage`, `POSTGREST_URL` | **DEGENERATE**: Missing volume mount for `/var/lib/storage`. Uploaded files lost on recreate. | `supabase.ts:550-570` |
| **Imgproxy** | `darthsim/imgproxy:v3.27` | Port 5001 internal | Operational | `supabase.ts:571-579` |
| **Edge Runtime** | `supabase/edge-runtime:v1.74.0` | Connects to Kong & Postgres | Container defined, but function deployment API stubbed | `supabase.ts:580-594` |
| **Supavisor** | `supabase/supavisor:1.1.8` | Port 6543, pool size 20 | **UNPUBLISHED**: Port 6543 is not exposed in `ports:` section of compose YAML. | `supabase.ts:595-613` |
| **Realtime** | `supabase/realtime:v2.34.47` | Port 4000, `LISTEN realtime:public` | Operational, depends on postgres | `supabase.ts:614-631` |
| **Kong Gateway** | `kong:2.8.1` | Port `0.0.0.0:${apiPort}:8000`, volume `./kong.yml` | Operational. Routes `/auth/v1/`, `/rest/v1/`, `/storage/v1/`, `/realtime/v1/` | `supabase.ts:632-652` |
| **Studio** | `supabase/studio:20241202-7634f10` | Port `0.0.0.0:${studioPort}:3000` | Operational when `enableLegacyStudio` is true | `supabase.ts:654-682` |

### 2.3 Identified Stubs, Mocks, and Structural Flaws
1. **Mocked Health Checks**:
   - `apps/api/src/routes/supabase.ts:269-321`:
     ```typescript
     // Lines 275-284: If project context is missing, static healthy response is returned:
     services: { kong: 'healthy', gotrue: 'healthy', postgrest: 'healthy', postgres: 'healthy', storage: 'healthy', realtime: 'healthy', functions: 'healthy', studio: 'healthy' }
     
     // Lines 301-309: Even with valid context, services are hardcoded:
     gotrue: 'healthy',
     postgrest: 'healthy',
     storage: 'healthy',
     realtime: realtimeRes.ok ? 'healthy' : 'healthy', // Notice: always healthy!
     functions: 'healthy',
     studio: 'healthy'
     ```
2. **Fake Edge Function Endpoints**:
   - `apps/api/src/routes/supabase.ts:1759-1765`: `GET /supabase/functions` returns static mock array (`func_01` 'hello-world', `func_02` 'generate-ai-completion').
   - Lines 1798-1810: `POST /supabase/functions/:name/invoke` falls back to a dummy sandbox simulation:
     `message: Hello ${payload.name || 'User'} from Edge Function "${name}"!`
3. **Synthetic Observability Telemetry**:
   - `apps/api/src/routes/supabase.ts:1925-1927`:
     `let activeConns = dbCount * 3 + 4; let cacheHitRate = 98.4; let isFallback = true;`
4. **Mocked Logs and Integrations**:
   - Lines 1973-1981: `GET /supabase/logs` returns hardcoded dummy logs (`log_01` to `log_05`) with `isFallback: true`.
   - Lines 1986-1999: `GET /supabase/integrations` returns static objects for `wh_01`, `v_01`, `fdw_01`.
5. **Completely Missing Backup and Restore**:
   - `schema.prisma:48-49` specifies `supabase_backup` and `supabase_restore`.
   - Grepping `apps/api/src/jobs/infrastructure-job-processor.ts` shows lines 426-444 only handle `node_enroll`, `node_maintenance`, `supabase_provision`, `app_deploy`, and `mailbox_provision`. `supabase_backup`, `supabase_restore`, and `supabase_deprovision` are unhandled and throw an error.
   - No `pg_dump` or object storage backup handler exists for Supabase stacks.

---

## 3. Detailed Forensic Analysis: Managed Databases Platform (R3)

### 3.1 Provisioning Architecture
- Managed databases are provisioned as independent standalone Docker containers on compute nodes via `services/node-agent/src/managedDb.js`.
- The Express API exposes CRUD in `apps/api/src/routes/managedDatabases.ts` backed by the `ManagedDatabase` model (`schema.prisma:1599-1638`).

### 3.2 Database Engine Audit Matrix

| Engine | Default Image | Port | Container Init Environment | Status | Evidence / Line Ref |
|---|---|---|---|---|---|
| **PostgreSQL** | `postgres:16-alpine` | `5432` | `POSTGRES_USER=app`, `POSTGRES_PASSWORD=...`, `POSTGRES_DB=app` | Operational but ephemeral | `managedDb.js:5, 15, 34` |
| **MySQL** | `mysql:8` | `3306` | `MYSQL_ROOT_PASSWORD=...`, `MYSQL_DATABASE=app` | Operational but ephemeral | `managedDb.js:6, 16, 36` |
| **MariaDB** | **NONE** | **N/A** | **NOT IMPLEMENTED** | **MISSING** | `managedDb.js:4-12`, `schema.prisma:145-150` |
| **Redis** | `redis:7-alpine` | `6379` | `redis-server --requirepass ...` | Operational but ephemeral | `managedDb.js:7, 17, 41` |
| **MongoDB** | `mongo:7` | `27017` | `MONGO_INITDB_ROOT_USERNAME=app`, `MONGO_INITDB_ROOT_PASSWORD=...`, `MONGO_INITDB_DATABASE=app` | Operational but ephemeral | `managedDb.js:11, 18, 38` |

### 3.3 Critical Managed Database Flaws

1. **Ephemeral Containers (Data Loss Risk)**:
   In `services/node-agent/src/managedDb.js:52-64`:
   ```javascript
   const container = await docker.createContainer({
     Image: image,
     name: containerName,
     Env: env,
     HostConfig: {
       NetworkMode: 'shanutechx-internal',
       RestartPolicy: { Name: 'unless-stopped' },
       SecurityOpt: ['no-new-privileges:true'],
       ...(Object.keys(portBindings).length > 0 ? { PortBindings: portBindings } : {}),
     },
   });
   ```
   **Finding**: There are **no volume mounts or bind mounts** (`HostConfig.Binds` or `HostConfig.Mounts`). All database directories (`/var/lib/postgresql/data`, `/var/lib/mysql`, `/data`, `/data/db`) are written inside the writable container layer. When a container is removed, updated, or scaled, customer data is destroyed.

2. **Synthetic Metrics with Math.random()**:
   In `apps/api/src/routes/managedDatabases.ts:1559-1565`:
   ```typescript
   const cpuPct = Math.round((Math.random() * 25 + 10) * 10) / 10;
   const ramMb = Math.round(120 + Math.random() * 80);
   const maxRamMb = db.memoryLimitMb || 512;
   const ramPct = Math.round((ramMb / maxRamMb) * 100);
   const storageGb = Math.round((databaseSizeBytes / (1024 * 1024 * 1024)) * 100) / 100;
   ```
   **Finding**: CPU and RAM metrics return randomized fake values. Real metrics must be collected from Docker Engine via `container.stats({ stream: false })` on the node-agent.

3. **Backup / Restore State**:
   - Snapshot creation (`managedDb.js:286-352`) executes real command dumps:
     - PostgreSQL: `pg_dumpall -U postgres`
     - MySQL: `mysqldump -uroot -p<pass> --all-databases`
     - Redis: `redis-cli SAVE` + streaming `/data/dump.rdb`
     - MongoDB: `mongodump --archive`
   - S3/R2 upload works via `managedDatabases.ts:1140-1170`.
   - **Defect**: Local snapshot creation (`POST /api/managed-databases/:id/backups`, line 430) does not save a `DatabaseBackup` row in Prisma, causing UI lists to be desynchronized unless queried directly from node disk.

---

## 4. Detailed Forensic Analysis: Application Git Deployments (R4)

### 4.1 Git Authentication & Providers
- **Implementation**: `apps/api/src/routes/gitConnect.ts` and `apps/api/src/lib/gitProviders/` (GitHub, GitLab, Bitbucket, Gitea).
- **Security Standard**: Uses GitHub App installations. The platform never requests or stores user Personal Access Tokens (PATs). An RS256 App JWT (`signAppJwt`, line 30) is signed on demand to mint 1-hour installation tokens via `POST /app/installations/:id/access_tokens`.
- **Repo Listing & Scoping**: `apps/api/src/lib/gitProviders/github.ts:85-117` paginates through `/installation/repositories`. `getScopedToken` mints fresh ephemeral tokens at build time.

### 4.2 Webhooks & Build Triggering
- **Webhook Endpoint**: `POST /deploy-webhooks/:deploymentId` in `apps/api/src/routes/deployWebhooks.ts:185-345`.
- **HMAC Verification**:
  - GitHub: Verifies `X-Hub-Signature-256` against `crypto.createHmac('sha256', rawSecret)` using `crypto.timingSafeEqual`.
  - GitLab: Compares `X-Gitlab-Token` header.
- **Monorepo Filtering**: Lines 260-279 inspect `deployment.watchPaths` against commit file additions, modifications, and deletions.
- **Auto-Registration**: Lines 91-168 implement `/webhook-auto-register` which calls the GitHub API to register the webhook URL automatically.

### 4.3 Multi-Tier Build Engine & Logging
- **Location**: `services/node-agent/src/build.js` and `apps/api/src/lib/railpackEngine.ts`.
- **Builder Tiers**:
  1. *Tier 1*: Railpack CLI (`railpack build`)
  2. *Tier 2*: Nixpacks CLI (`nixpacks build`)
  3. *Tier 3*: Containerized Nixpacks (`ghcr.io/railwayapp/nixpacks:latest`)
  4. *Tier 4*: Native Dockerfile / Smart Dockerfile Generator (`generateSmartDockerfile` supporting Node.js, Python, Go, Rust, Java/Lavalink, PHP, Static HTML).
- **Build Logging**:
  - `services/node-agent/src/index.js:510-565` responds with `application/x-ndjson` streaming `BuildEvent` objects (`fetch`, `build`, `run`, `done`, `error`).
  - `apps/api/src/lib/railpackEngine.ts:100-111` ingests the NDJSON events and records them in `PipelineRun.stageLogs`.
  - Runtime logs stream via Server-Sent Events (`apps/api/src/routes/deployments.ts:558-620`).

### 4.4 Deployment History & Rollback Gaps
- **Rollback Implementation**:
  - `deployments.ts:2051-2125` implements `POST /deployments/:id/rollback`.
  - It creates/updates a `DeploymentPointer` in Prisma pointing to `targetDeployment.id`.
- **Critical Architectural Gap**:
  - The rollback endpoint requires `targetDeployment.status === 'running'` and `targetDeployment.containerId != null`.
  - In normal Git push workflows (`deployWebhooks.ts:289`), when a commit is pushed, the API overwrites the existing `Deployment` record in place (`prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'building' } })`).
  - There is no immutable `DeploymentRelease` or `DeploymentVersion` table. Previous container tags are stopped and overwritten. Therefore, a user cannot roll back to previous git commits without having manually cloned separate preview deployments.

---

## 5. Detailed Forensic Analysis: Service Catalog (R4)

### 5.1 Catalog Templates & Definitions
- **Templates Directory**: `templates/` containing 10 production-style YAML Compose stacks:
  1. `grafana.yaml`: Grafana dashboard (port 3000)
  2. `hermes-agent.yaml`: Hermes agent & Redis (ports 8080, 6379)
  3. `lavalink.yaml`: Lavalink v4 Java audio server (port 2333)
  4. `livekit.yaml`: LiveKit WebRTC server & Redis (port 7880)
  5. `mongodb.yaml`: MongoDB standalone (port 27017)
  6. `n8n.yaml`: n8n workflow automation & PostgreSQL (port 5678)
  7. `redis.yaml`: Redis cache (port 6379)
  8. `supabase-lite.yaml`: Supabase DB, Meta, Studio (port 3000)
  9. `uptime-kuma.yaml`: Uptime Kuma monitoring (port 3001)
  10. `wordpress.yaml`: WordPress & MySQL 8 (port 80)
- **Metadata Parsing**: `apps/api/src/routes/catalog.ts:51-80` parses Coolify-style `# key: value` comment headers into `TemplateMeta` objects, cached in memory for 5 minutes (`CACHE_TTL`).

### 5.2 Provisioning Pipeline
- `POST /api/catalog/deploy` (`catalog.ts:247-620`):
  1. Validates user subscription (BUG-038 fix: customers require active hosting subscription).
  2. Performs abuse scan on environment variables.
  3. Auto-generates cryptographically strong passwords for placeholders (`$SERVICE_PASSWORD_*`, `POSTGRES_PASSWORD`, etc.).
  4. Selects compute node (`selectNodeForDeployment`).
  5. Claims deployment slot (`claimDeploymentSlot`).
  6. Sends payload to node-agent `/agent/compose/up` with `composeYaml`, `projectName`, `envVars`, and configuration files (e.g. `livekit.yaml`, `application.yml`).
  7. Auto-registers accompanying database instances in `ManagedDatabase` table (lines 583-620) for WordPress MySQL, n8n Postgres, Redis, etc.

### 5.3 Catalog Gaps and Defects
1. **No Post-Provision Health Verification**:
   - `catalog.ts:578-581` updates `status: 'running'` immediately after `/agent/compose/up` responds.
   - It does not poll container statuses or execute health checks to verify whether the template services are healthy or crashing.
2. **Port Conflict on Raw Host Ports**:
   - Templates declare host ports (e.g. `ports: - "3000:3000"`). If two customers deploy Grafana on the same node, Docker Compose fails with `port is already allocated` unless the routing mode rewrites ports or relies entirely on Traefik reverse proxy headers.

---

## 6. Detailed Forensic Analysis: Remote Infrastructure & Email (R5)

### 6.1 Remote Node Infrastructure
- **Agent Bootstrap & Enrollment**:
  - Dynamic installer: `apps/api/src/routes/nodes.ts:37-160` renders `/nodes/install.sh`.
  - SSH Enrollment Job: `apps/api/src/jobs/infrastructure-job-processor.ts:27-210` connects over SSH, installs Docker Engine, creates `shanutechx-agent` system user, writes systemd service file, generates Cloudflare DNS A-record (`node-<label>.<rootDomain>`), and registers the node in Prisma.
  - Heartbeats & Monitoring: Node agents report hardware telemetry (`POST /nodes/:id/stats`). The cluster watchdog (`nodeMonitor.ts`) detects dead nodes (> 2.5 minutes missing heartbeat) and coordinates failover (`failoverEngine.ts`).

### 6.2 VPS Client Management (SSH, SFTP, UFW)
- **Location**: `apps/api/src/routes/vps.ts` and `apps/api/src/lib/vpsSshClient.ts`.
- **Live Capabilities**:
  - Live SFTP manager: lists directory contents (`sftpListFiles`), uploads (`sftpUploadFile`), downloads (`sftpDownloadFile`), deletes, renames, and extracts `.tar.gz` / `.zip` archives.
  - Browser SSH Terminal: `POST /vps-provisions/:id/ssh-ticket` issues cryptographic tickets for WebSocket proxying via `attachSshTerminalGateway` (`/ws/vps-ssh`).
  - UFW Firewall: `getVpsFirewallRulesSsh`, `addVpsFirewallRuleSsh`, `deleteVpsFirewallRuleSsh` parse and update firewall rules live.
  - Power & Stats: Reboots via SSH (`rebootVpsSsh`) and reads CPU/RAM/Disk stats (`getVpsSystemStats`).

### 6.3 Cloud VPS Provider API Status
- **Missing Provider Adapter**: In commit `875851b5`, `apps/api/src/routes/leaseweb.ts` and `apps/api/src/lib/leasewebClient.ts` were removed from `src/`.
- **Current Behavior**:
  - VPS orders (`orderFulfillment.ts:77-121`) are queued for manual setup (`vpsProvision.status = 'pending'`), notifying admins and Discord channels.
  - No direct automated cloud API (Leaseweb, Hetzner, DigitalOcean, AWS) is actively wired in `src/` to purchase or destroy cloud VPS instances programmatically.

### 6.4 WildDuck Email Delivery & SMTP Infrastructure
- **Client Implementation**: `apps/api/src/lib/wildduckClient.ts:1-595` provides a resilient API client with automated backoff retry, DKIM key generation (`getOrCreateDkim`), user CRUD, and address management.
- **Multi-Host Mail Architecture**: `MailHost` model in Prisma and routes in `apps/api/src/routes/email.ts:2507-2894` allow registering, testing, and managing multiple WildDuck mail clusters.
- **Startup Bootstrapping**: `apps/api/src/lib/wildduckInitializer.ts` runs on API boot, fetching root domain DKIM and configuring platform outbound SMTP (`PlatformSmtpConfig`).
- **Gaps in Email Provisioning**:
  1. `apps/api/src/routes/smtp.ts:349-415` (`POST /smtp-accounts`): Saves the SMTP account to Prisma and sends a release email, but **fails to call `wildduckClient.createUser` or `createAddress`**.
  2. `apps/api/src/jobs/infrastructure-job-processor.ts:383-416` contains `processMailboxProvision` which *does* call WildDuck properly, but this BullMQ job is never dispatched anywhere in the codebase.

---

## 7. Forensic Matrix: Reality vs Mocks vs Gaps

| Feature / Subsystem | Implemented & Working | Mocked / Simulated | Incomplete / Broken | Missing |
|---|---|---|---|---|
| **Supabase PostgreSQL** | Image specified, container created | None | **No persistent volumes** | None |
| **Supabase Meta** | Container created | None | **Port 8080 unpublished** | None |
| **Supabase Services (Auth, Rest, Realtime)** | Containers created, Kong routes wired | None | None | Init SQL scripts unmounted |
| **Supabase Storage** | Container created | None | **No persistent volume for /var/lib/storage** | None |
| **Supabase Health** | None | gotrue, postgrest, storage, functions, studio hardcoded to 'healthy' | None | Real HTTP probes |
| **Supabase Observability / Logs** | None | `Math.random` / dummy log items | None | Real Loki/Docker log query |
| **Supabase Edge Functions** | None | Hardcoded array (`func_01`, `func_02`), simulated string invoke | None | Real Deno runtime deployment |
| **Supabase Backup / Restore** | None | None | Enums declared in Prisma | Handlers in job queue & agent |
| **Managed DB Engines** | Postgres, MySQL, Redis, MongoDB | None | None | **MariaDB** |
| **Managed DB Persistence** | None | None | **Containers created without volume mounts** | Docker named volumes / binds |
| **Managed DB Metrics** | None | `cpuPct` & `ramMb` use `Math.random()` | Non-postgres size mocked to 10MB | Real Docker `container.stats()` |
| **Managed DB Backups** | Dump & restore logic in node-agent, S3 stream | None | Local backups omit Prisma record | Automatic cron schedule |
| **Git Auth (GitHub App)** | App JWT + ephemeral token minting | None | None | None |
| **Git Webhooks & Monorepo** | HMAC-SHA256 verification, watchPaths | None | None | None |
| **Build Engine** | Multi-tier Railpack, Nixpacks, Dockerfile | None | None | None |
| **Deployment History & Rollback** | Subdomain pointer swapping | None | Overwrites active deployment in place | Immutable release ledger |
| **Service Catalog Provisioning** | 10 Compose templates, node-agent deploy | None | Port collisions on raw host ports | Post-deploy health verification |
| **Remote Node Management** | SSH enrollment, systemd daemon, watchdog | None | None | None |
| **VPS SSH / SFTP / Firewall** | Live SFTP, browser SSH ticket, UFW rules | None | None | None |
| **Cloud VPS Provisioning** | Manual queue & Discord alert | None | `leasewebClient.ts` deleted from `src/` | Automated cloud provider API |
| **WildDuck Mail Server** | Full API client, multi-host, webmail | None | `POST /smtp-accounts` omits WildDuck call | BullMQ job dispatch wiring |

---

## 8. Concrete Technical Roadmap to Genuine Production Readiness

To satisfy the Acceptance Criteria of R3, R4, and R5 without any mocked or simulated code, the following prioritized engineering tasks must be executed:

### Phase 1: Storage Persistence & Foundation Fixes (R3)
1. **Supabase Persistent Storage**:
   - In `apps/api/src/routes/supabase.ts:buildSupabaseComposeYaml`, declare named Docker volumes:
     ```yaml
     volumes:
       supa_${params.cleanSlug}_db_data:
       supa_${params.cleanSlug}_storage_data:
     ```
   - Mount `supa_${params.cleanSlug}_db_data:/var/lib/postgresql/data` under `supabase-db`.
   - Mount `supa_${params.cleanSlug}_storage_data:/var/lib/storage` under `supabase-storage`.
2. **Supabase Meta Port Publication**:
   - In `buildSupabaseComposeYaml`, route meta requests strictly through Kong (`http://supabase-kong:8000/pg/`) or allocate an internal host port in `autoExposeSupabaseProjectPorts` and publish `"${metaPort}:8080"` so host and API calls succeed reliably.
3. **Managed Database Persistent Storage**:
   - In `services/node-agent/src/managedDb.js:provisionDatabase`, configure named Docker volumes in `HostConfig.Binds`:
     - Postgres: `[`db_data_${databaseId}:/var/lib/postgresql/data`]`
     - MySQL: `[`db_data_${databaseId}:/var/lib/mysql`]`
     - Redis: `[`db_data_${databaseId}:/data`]`
     - MongoDB: `[`db_data_${databaseId}:/data/db`]`
4. **Implement MariaDB Engine**:
   - Add `mariadb` to `ManagedDatabaseType` in `schema.prisma`.
   - Add `mariadb: 'mariadb:11'` to `IMAGES` and `3306` to `DEFAULT_PORTS` in `managedDb.js`.
   - Implement MariaDB password rotation and dump/restore commands (compatible with MySQL CLI).

### Phase 2: Elimination of Mocks & Real Metrics Telemetry (R3, R5)
1. **Real Supabase Health Probes**:
   - Replace lines 275-309 in `supabase.ts` with real HTTP/TCP probes:
     - Check `pg_isready` on Postgres port.
     - Check `GET /health` on GoTrue, PostgREST, and Storage via Kong.
     - Check Realtime WebSocket handshake.
     - Mark services as `degraded` or `unreachable` when probes fail.
2. **Real Managed Database Metrics**:
   - In `services/node-agent/src/managedDb.js`, add endpoint `GET /agent/managed-databases/:id/stats` calling `docker.getContainer(containerId).stats({ stream: false })`.
   - Compute real CPU percentage from `cpu_stats` and `precpu_stats`.
   - Compute real RAM usage from `memory_stats.usage`.
   - In `apps/api/src/routes/managedDatabases.ts:1522-1590`, remove `Math.random()` and fetch real stats from the node agent.
3. **Supabase Real Observability & Logs**:
   - Connect `GET /supabase/logs` to Docker Engine logs (`docker.getContainer(...).logs(...)`) via node-agent `/agent/compose/:project/logs`.
   - Remove hardcoded dummy logs (`log_01` - `log_05`) and dummy integrations.

### Phase 3: Supabase Backup/Restore & Mailbox Job Wiring (R3, R5)
1. **Supabase Stack Backups**:
   - Implement `supabase_backup` and `supabase_restore` in `infrastructure-job-processor.ts`.
   - Execute `docker exec <supa-db-container> pg_dumpall -U postgres` on the target node, stream the dump to S3/Cloudflare R2, and record the backup in the database.
   - Implement restore by executing `psql -U postgres` with the downloaded dump stream.
2. **Wire WildDuck User Creation to SMTP Routes**:
   - In `apps/api/src/routes/smtp.ts:POST /smtp-accounts`, dispatch `mailbox_provision` job or call `wildduckClient.createUser` and `wildduckClient.createAddress` directly, saving `wildduckUserId` and `wildduckAddressId` in the `SmtpAccount` row.

### Phase 4: Git Deployment Versioning & Catalog Readiness (R4)
1. **Immutable Deployment Releases for Rollbacks**:
   - Introduce `DeploymentRelease` table in `schema.prisma` linking `deploymentId`, `gitCommitHash`, `gitCommitMessage`, `imageTag`, and `createdAt`.
   - On every build, create a new release record and retain previous container images.
   - Update `POST /deployments/:id/rollback` to allow instant rolling back to any historical release by re-running the tagged image or switching the container.
2. **Service Catalog Post-Provision Verification**:
   - In `apps/api/src/routes/catalog.ts:POST /catalog/deploy`, after `/agent/compose/up`, poll container readiness on the node agent before setting `Deployment.status = 'running'`.
   - Fail or mark `degraded` if containers crash on startup.

---
*Report compiled and certified by teamwork_explorer_survey_3.*
