# Project: ShanuTechX Production Platform Hardening & Completion

## Architecture
- **Monorepo Structure**:
  - `apps/api`: Fastify + TypeScript control plane API with Prisma ORM, BullMQ background queues, and RBAC middleware.
  - `apps/dashboard`: Next.js 14 App Router administration console (95 routes).
  - `apps/web`: Next.js 14 public portal and user onboarding (29 routes).
  - `apps/webmail`: Next.js 14 webmail interface (6 routes).
  - `apps/status`: Next.js 15 public status page (29 routes).
  - `apps/mobile-admin`: React Native / Expo mobile app.
  - `services/node-agent`: Node.js daemon running on host/cluster nodes interacting directly with Docker Engine API (Dockerode), BuildKit, Nixpacks, UFW, and system metrics.
  - `packages/db`: Prisma 5.22 schema (104 models, 27 migrations) and client library.
  - `packages/types`, `packages/client`, `packages/auth`, `packages/deployments`, `packages/catalog`: Shared platform SDK packages.
  - `infra/control-plane`: Docker Compose manifests for production control plane (PostgreSQL, Redis, Traefik, Node-Agent, API, Dashboard).
  - `templates/`: 10 production Docker Compose templates for one-click catalog service deployments.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SDK Catalog Build Fix | Fix TS2345 type mismatches in `@shanutechx/catalog` and restore `npm run build:sdk` | M1 | Survey 1 (COMPLETED) |
| 2 | Role Guard Security Fix | Fix `requireDev` middleware in `auth.ts` to strictly require dev role | M1 | Survey 1 (COMPLETED) |
| 3 | Mailbox ACL Admin Fix | Fix `canAccessMailbox` in `mailboxAcl.ts` to respect granular permissions rather than hardcoded admin denial | M1 | Survey 1 (COMPLETED) |
| 4 | Git Fetch Error String Alignment | Align branch fallback error message in `repo.js` to match test assertions | M1 | Survey 1 (COMPLETED) |
| 5 | Operational Documentation | Create `docs/complete-deployment.md` and `docs/PRODUCTION_READY.md` | M1 | Survey 1 (COMPLETED) |
| 6 | Unit & Integration Test Green Baseline | Achieve 100% passing status on all existing unit and integration tests | M1 | Survey 1 (COMPLETED) |
| 7 | Docker Persistent Volume Provisioning | Wire `apps/api/src/routes/volumes.ts` to `node-agent` and configure `HostConfig.Binds` in `docker.js` | M2 | Survey 2 |
| 8 | Direct Image Deployment Route | Add `/agent/deployments/:id/run-image` to `node-agent` to support Docker image runs without git clone | M2 | Survey 2 |
| 9 | Build Pipeline Secret Hardening | Eliminate `--build-arg` leaking runtime environment secrets in `build.js` | M2 | Survey 2 |
| 10 | Build Cancellation Tracking | Register builds in `activeBuilds` map in `node-agent` to make cancel-build genuinely functional | M2 | Survey 2 |
| 11 | Container Lifecycle & Live Telemetry | Verify real start, stop, restart, inspect, remove, demuxed logs, and SSE resource metrics via Dockerode | M2 | Survey 2 |
| 12 | Supabase Persistent Volumes | Add persistent Docker volume mounts for PostgreSQL and Storage in `supabase.ts` | M3 | Survey 3 |
| 13 | Supabase Meta Network Routing | Expose port 8080 or proxy Supabase Meta requests through Kong to fix connection failures | M3 | Survey 3 |
| 14 | Real Supabase Health Checks | Replace hardcoded `'healthy'` strings with real HTTP/TCP health checks across Supabase stack | M3 | Survey 3 |
| 15 | Real Supabase Observability & Logs | Replace synthetic numbers and mock logs with real Docker/Kong telemetry | M3 | Survey 3 |
| 16 | Managed Database Volume Persistence | Add Docker volume mounts for Postgres, MySQL, Redis, MongoDB, and MariaDB in `managedDb.js` | M3 | Survey 3 |
| 17 | MariaDB Engine Implementation | Add MariaDB to Prisma schema, API router, and node-agent Docker image mapping | M3 | Survey 1 & 3 |
| 18 | Real Database Telemetry | Replace `Math.random()` CPU/RAM metrics with real Docker `container.stats()` in `managedDatabases.ts` | M3 | Survey 3 |
| 19 | Supabase Backup & Restore Handlers | Implement BullMQ job processor handlers for `supabase_backup`, `supabase_restore`, and `supabase_deprovision` | M3 | Survey 3 |
| 20 | Git Commit Rollback & Release Ledger | Implement immutable `DeploymentRelease` ledger to record git sha, message, and image tag for historical rollbacks | M4 | Survey 3 |
| 21 | Service Catalog Health Readiness | Add post-deploy container readiness polling in `catalog.ts` before setting status to running | M4 | Survey 3 |
| 22 | Git Build Pipeline & Webhooks | Verify GitHub App authentication, push webhooks, and live streaming deployment logs | M4 | Survey 3 |
| 23 | Traefik Config & Resolver Reconciliation | Align certresolver name (`le`) and add dynamic file provider mounts in `docker-compose.prod.yml` | M5 | Survey 2 |
| 24 | Custom Domain Dynamic File Sharing | Mount `./traefik/dynamic` to `node-agent` in control-plane compose for custom domain routing | M5 | Survey 2 |
| 25 | Real Traefik Status API | Remove simulated fallback router/middleware stubs in `traefikStatus.ts` | M5 | Survey 2 |
| 26 | WildDuck SMTP Mailbox Provisioning | Wire `POST /smtp-accounts` to call `wildduckClient` or dispatch the BullMQ `mailbox_provision` job | M5 | Survey 3 |
| 27 | RBAC & Security Isolation Audit | Enforce tenant isolation, project ownership checks, and secret masking across API and logs | M5 | Survey 1, 2, 3 |
| 28 | Comprehensive 4-Tier E2E Test Suite | Design, implement, and verify full 4-tier requirement-driven E2E test suite | E2E Track | Original Request |
| 29 | 100% E2E Test Suite Pass | Fix all issues exposed by E2E tests and achieve 100% pass rate (Tiers 1-4) | M6 | Original Request |
| 30 | Adversarial Coverage Hardening | Run Tier 5 adversarial stress testing, boundary fuzzing, and security penetration tests | M6 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Platform Integrity & Test Baseline | Features 1-6: Fix `@shanutechx/catalog`, `requireDev`, `mailboxAcl`, `repo.js`, doc files, 100% unit tests pass | none | DONE |
| M2 | Container Management & Build System | Features 7-11: Real Docker volume provisioning, `run-image` route, build secrets protection, build cancellation, container metrics | M1 | DONE |
| M3 | Self-Hosted Supabase & Managed Databases | Features 12-19: Supabase persistent volumes, meta routing, real health checks, MariaDB engine, DB volume binds, real DB stats, backup/restore jobs | M2 | DONE |
| M4 | Application Deployments & Service Catalog | Features 20-22: Immutable release history & commit rollback, catalog readiness polling, git build pipelines | M2 | DONE |
| M5 | Reverse Proxy, TLS, Remote Infra & Email | Features 23-27: Traefik resolver reconciliation, shared dynamic volume, real Traefik status, WildDuck email provisioning, RBAC audit | M3, M4 | DONE |
| M6 | Final Verification & Adversarial Hardening | Features 29-30: Pass 100% E2E tests (Tiers 1-4), Tier 5 adversarial hardening | M5, E2E Track | DONE |

## Parallel Dual Track: E2E Testing
- **E2E Testing Orchestrator**: Runs in parallel with Implementation Milestones M1-M5.
- Scope: Builds independent, requirement-driven opaque-box test suite (Tiers 1-4) covering all 30 features from Feature Inventory.
- Deliverable: `TEST_INFRA.md` and `TEST_READY.md`.

## Interface Contracts
### API ↔ Node-Agent
- Volume Provisioning: `POST /agent/volumes` with `{ deploymentId, volumeName, hostPath }` returns `{ success: true, path }`.
- Image Deployment: `POST /agent/deployments/:id/run-image` with `{ image, envVars, ports, volumes, resources }` returns `{ containerId, status }`.
- Container Run: `runContainer({ image, name, env, ports, volumes: [{ hostPath, containerPath, mode }], resources })`.
- Custom Domains: Writes dynamic YAML configuration directly to shared `/etc/traefik/dynamic/custom-${deploymentId}-${safeDomain}.yml`.

### API ↔ Supabase Stack
- PostgreSQL: Dedicated internal Docker network `supa-${slug}-net`, published port `${dbPort}`, persistent volume `supa-${slug}-db-data:/var/lib/postgresql/data`.
- Storage: Persistent volume `supa-${slug}-storage-data:/var/lib/storage`.
- Meta: Internal HTTP service on port 8080 accessed via Kong or published container port.
- Health Probes: HTTP GET to Kong `/` (8000), PostgREST `/` (3000), GoTrue `/health` (9999), Storage `/status` (5000), TCP ping to PostgreSQL (5432).

### API ↔ Managed Databases
- Engines: PostgreSQL (`postgres:16-alpine`), MySQL (`mysql:8.0`), MariaDB (`mariadb:11`), Redis (`redis:7-alpine`), MongoDB (`mongo:7.0`).
- Persistent Volumes: Docker volume binds `db-${dbId}-data` mapped to engine-specific data directories (`/var/lib/postgresql/data`, `/var/lib/mysql`, `/data`, `/data/db`).
- Telemetry: Real `container.stats()` calculation `(cpuDelta / systemDelta) * numCPUs * 100` and `memoryUsage / memoryLimit`.

## Code Layout
- `apps/api/src/routes/`: Route controllers and Fastify handlers
- `apps/api/src/middleware/`: Auth and RBAC middleware
- `apps/api/src/jobs/`: BullMQ job processors
- `services/node-agent/src/`: Node agent daemons (docker.js, build.js, managedDb.js, exposure.js, repo.js)
- `packages/db/prisma/`: Schema and migrations
- `packages/catalog/src/`: Catalog SDK
- `templates/`: Docker Compose templates
- `tests/unit/`: Unit tests
- `tests/integration/`: Integration tests
- `tests/e2e/`: End-to-end tests
