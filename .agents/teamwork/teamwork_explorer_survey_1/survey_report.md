# Comprehensive Architecture & Codebase Baseline Audit Report (R1)

**Execution Date:** 2026-10-28  
**Auditor Archetype:** Teamwork Explorer (teamwork_explorer_survey_1)  
**Target Repository:** ShanuTechX Platform (`c:\Users\tiros\OneDrive\Desktop\shanutechx`)  
**Mission:** Baseline audit for R1 and core platform integrity.

---

## Executive Summary

The **ShanuTechX Platform** is an enterprise-grade, self-hostable cloud hosting engine and PaaS/IaaS management control plane resembling a fusion of Coolify, Dokploy, Supabase Management, and cPanel. It coordinates VPS compute nodes, automated Git container deployments, multi-tenant databases, mailboxes, and bot integrations.

Overall codebase health is **remarkably high**:
- **Apps**: All 5 web applications (`apps/api`, `apps/dashboard`, `apps/web`, `apps/webmail`, `apps/status`) compile cleanly with zero errors. All 95 dashboard routes, 29 marketing routes, 6 webmail routes, and 29 status routes compile and generate static assets.
- **Mobile Admin**: `apps/mobile-admin` (React Native/Expo) passes TypeScript typechecking with 0 errors.
- **Test Suite**: 617 of 624 unit tests pass (98.9% pass rate across 75 test files); 50 of 51 integration tests pass.
- **Prisma Client**: Prisma Client v5.22.0 generates cleanly against 104 data models and 27 migrations.
- **Critical Defects Identified**:
  1. `@shanutechx/catalog` package has a TypeScript error in `packages/catalog/src/index.ts:42,43` blocking `npm run build:sdk`.
  2. `tests/unit/nodeVersion.test.ts:48` fails due to missing `docs/complete-deployment.md` and `docs/PRODUCTION_READY.md`.
  3. `apps/api/src/lib/mailboxAcl.ts:116` has an overly strict check blocking `admin` from reading mailboxes, causing 2 test failures in `tests/unit/mailboxAcl.test.ts`.
  4. `services/node-agent/src/repo.js:161` has an error message string mismatch with `tests/unit/nodeAgentRepoAuth.test.ts:144`.
  5. `apps/api/src/middleware/auth.ts:265` in `requireDev` inadvertently allows `admin` role, violating dev-only isolation and failing `tests/integration/roleGuards.test.ts`.
  6. Managed database engine MariaDB (required by R3) is currently absent from the Prisma schema, API router, and node agent.
  7. Docker daemon is currently stopped on the host; local PostgreSQL database at `localhost:5432` is not reachable until Docker is started.

---

## 1. Workspace Layout & Monorepo Configuration

### Monorepo Structure
Root `package.json` configures npm workspaces:
```json
"workspaces": [
  "apps/*",
  "!apps/mobile-admin",
  "!apps/status",
  "packages/*",
  "services/*"
]
```
- `apps/mobile-admin` (Expo / React Native 0.74.5 / React 18.2.0) and `apps/status` (Next.js 15.1.0 / React 19.0.0) are intentionally excluded from npm workspaces to avoid dependency conflicts across different React versions (React 18 vs React 19).
- Root `tsconfig.base.json` defines NodeNext ECMAScript 2022 defaults:
  - `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`.

### Catalog of Workspaces & Applications

| Workspace | Type | Framework / Technologies | Primary Purpose |
|---|---|---|---|
| `apps/api` | Backend API | Node.js Express 4.19, Prisma 5.22, BullMQ, Redis, Zod, Pino | Core REST API Gateway & Worker |
| `apps/dashboard` | Frontend Web App | Next.js 14.2.35, React 18.3.1, Tailwind v3, Monaco, XTerm.js | Platform Admin & Developer Control Panel |
| `apps/web` | Frontend Web App | Next.js 14.2.35, React 18.3.1, Three.js, Framer Motion | Marketing, Docs & Public Site |
| `apps/webmail` | Frontend Web App | Next.js 14.2.35, React 18.3.1, DOMPurify, Tailwind v3 | Hostinger-style Webmail Client |
| `apps/status` | Standalone Web App | Next.js 15.1.0, React 19.0.0, Tailwind v4, SQLite3, Jose | Public Cloud Status & Telemetry |
| `apps/mobile-admin` | Mobile App | Expo SDK 51, React Native 0.74.5, React Navigation | iOS & Android Mobile Admin App |
| `packages/db` | Shared Package | Prisma ORM 5.22, PostgreSQL 16 | Central Database Schema & Migrations |
| `packages/types` | Shared SDK Package | TypeScript, tsup | Shared Type Definitions |
| `packages/client` | Shared SDK Package | TypeScript, tsup | HTTP API SDK Client |
| `packages/auth` | Shared SDK Package | TypeScript, tsup | Client Auth SDK Helpers |
| `packages/deployments`| Shared SDK Package | TypeScript, tsup | Deployment & Build Helpers |
| `packages/catalog` | Shared SDK Package | TypeScript, tsup | App Catalog Browser & Deploy SDK |
| `packages/node-agent` | Shared SDK Package | TypeScript, tsup | Node Agent Client Interface SDK |
| `services/node-agent` | Service Daemon | Express 4.19, Dockerode 4.0.2, SystemInfo, tar | VPS Node Agent (Docker Engine API) |
| `services/discord-bot`| Service Bot | Discord.js 14.15, Express, Pino | Discord Ticket & Alert Bot |
| `services/whatsapp-bot`| Service Bot | Baileys 6.7.9, Express, QRCode | WhatsApp Customer Support Bot |

### Linters & Testing Frameworks
- **Unit Testing**: Node test runner (`node:test` + `node:assert/strict`) executed via `tsx --test tests/unit/*.test.ts`. 75 unit test files in `tests/unit/`.
- **Integration Testing**: Node test runner executed via `tsx --test tests/integration/*.test.ts`. 2 test files in `tests/integration/`.
- **Component & Workspace Testing**: Vitest 4.1.10 in `apps/api` (`npm run test --workspace=apps/api`) and `apps/dashboard` (`npm run test --workspace=apps/dashboard`).
- **E2E Testing**: Playwright configured in `tests/e2e/playwright.config.ts`.
- **Linting**: ESLint 9 in `apps/status`, Next.js built-in lint in Next.js apps.

---

## 2. Application Frameworks, Build Status, and Test Health

### Build & Typecheck Verification Results

| Target | Command | Result | Notes |
|---|---|---|---|
| `apps/api` | `npm run build --workspace=apps/api` | **PASS (Exit 0)** | Compiles with `tsc -p tsconfig.json` to `dist/` |
| `apps/dashboard` | `npm run build --workspace=apps/dashboard` | **PASS (Exit 0)** | Compiles all 95 routes, generates static pages |
| `apps/web` | `npm run build --workspace=apps/web` | **PASS (Exit 0)** | Compiles all 29 routes, generates static pages |
| `apps/webmail` | `npm run build --workspace=apps/webmail` | **PASS (Exit 0)** | Compiles all 6 routes, generates static pages |
| `apps/status` | `npm run build --prefix apps/status` | **PASS (Exit 0)** | Next.js 15 builds all 29 routes |
| `apps/mobile-admin` | `npm run typecheck --prefix apps/mobile-admin` | **PASS (Exit 0)** | `tsc --noEmit` clean with 0 errors |
| `packages/types` | `npm run type-check --workspace=packages/types` | **PASS (Exit 0)** | Builds with `tsup` |
| `packages/client` | `npm run type-check --workspace=packages/client` | **PASS (Exit 0)** | Builds with `tsup` |
| `packages/auth` | `npm run type-check --workspace=packages/auth` | **PASS (Exit 0)** | Builds with `tsup` |
| `packages/deployments`| `npm run type-check --workspace=packages/deployments` | **PASS (Exit 0)** | Builds with `tsup` |
| `packages/node-agent` | `npm run type-check --workspace=packages/node-agent` | **PASS (Exit 0)** | Builds with `tsup` |
| `packages/catalog` | `npm run type-check --workspace=packages/catalog` | **FAIL (Exit 1)** | TS2345 in `src/index.ts:42,43` |
| Root `build:sdk` | `npm run build:sdk` | **FAIL (Exit 1)** | Blocked by `packages/catalog` DTS build |

### Unit & Integration Test Suite Verification

- **Full Suite Run**: `npm run test:unit` executed 624 tests across 34 suites.
  - **Passed**: 617 tests
  - **Failed**: 7 tests
- **Root Cause Analysis of Test Failures**:
  1. `tests/unit/nodeVersion.test.ts:48`: `ENOENT: no such file or directory, open '...docs\complete-deployment.md'`. Lines 47-49 attempt to read `docs/complete-deployment.md` and `docs/PRODUCTION_READY.md`. The `docs/` folder does not exist.
  2. `tests/unit/mailboxAcl.test.ts:61` & `96`: Assertion error `false !== true`. In `apps/api/src/lib/mailboxAcl.ts:116-122`, a blanket check `if (userRole === 'admin') return { allowed: false, reason: 'Access Denied: Admin users do not have access to Webmail.' }` was added, which blocks admins even when given explicit read access via ACL or `allowedAdminIds`.
  3. `tests/unit/nodeAgentRepoAuth.test.ts:144`: Regular expression mismatch on `repo.prepareWorkspace` error message. In `services/node-agent/src/repo.js:161`, the error thrown is `Could not fetch branch "${branch}" or "${altBranch}": ...`, whereas the test expects `/Could not fetch the latest code for branch "main"/`.
  4. `tests/integration/roleGuards.test.ts:80`: Test `blocks admin (dev-only means dev-only)` failed (`200 !== 403`). In `apps/api/src/middleware/auth.ts:265`, `requireDev` checks `if (req.user?.role !== 'dev' && req.user?.role !== 'admin')`, erroneously allowing the admin role into dev-only endpoints.

---

## 3. Database Schemas, ORM, and Migrations

### ORM Architecture
- **Engine**: Prisma ORM 5.22.0 (`@prisma/client` and `prisma`).
- **Connection Model**: `packages/db/index.js` exports a shared singleton `prisma`:
  ```javascript
  const globalForPrisma = globalThis;
  const prisma = globalForPrisma.__shanutechxPrisma || new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.__shanutechxPrisma = prisma;
  module.exports = { prisma };
  ```
  This guarantees that during development hot-reloads and worker dispatches, database connection pool limits are never exhausted.
- **Client Generation**: `npm run db:generate` (`prisma generate --schema=./packages/db/prisma/schema.prisma`) generates client in 601ms.

### Schema Scope (`packages/db/prisma/schema.prisma`)
- Total Lines: 2,374 lines
- File Size: 81,185 bytes
- **104 Data Models**:
  - Core Users & Permissions: `User`, `Role`, `PushToken`, `Team`, `TeamMember`, `TeamInvite`, `ResourcePermission`, `ApiKey`, `AuditLog`.
  - Infrastructure Nodes & Jobs: `Node`, `InfrastructureJob`, `NodeBootstrapLog`, `NodePortExposure`, `InternalNetwork`, `VpsPlan`, `VpsProvision`.
  - Billing & Commerce: `Service`, `Product`, `Plan`, `Order`, `OrderItem`, `Payment`, `Invoice`, `Subscription`, `Review`.
  - Application Deployments: `Deployment`, `WafRule`, `DeploymentVolume`, `DeploymentBackup`, `DeploymentBackupPolicy`, `DeploymentTemplate`, `CustomDomain`, `CasFileBlob`, `DeploymentPointer`, `PreviewComment`, `Environment`, `ProjectVariable`, `PipelineRun`.
  - Developer Supabase Platform: `SupabaseClientProject`, `SupabaseAuthSmtpConfig`, `SupabaseEmailTemplate`, `SupabaseSmtpDeliveryLog`, `Project`, `ProjectMember`, `ProjectAuthUser`, `ProjectOAuthAccount`, `ProjectOAuthConfig`, `ProjectMagicLink`.
  - Managed Databases: `ManagedDatabase`, `ManagedDatabaseUser`, `DatabaseSavedQuery`, `DatabaseBackup`.
  - Email & Webmail: `WebmailMessage`, `WebmailFolder`, `WebmailLabel`, `WebmailFilter`, `WebmailSignature`, `WebmailTemplate`, `WebmailAutoReply`, `WebmailBlockedSender`, `WebmailCalendarSync`, `WebmailSnooze`, `WebmailScheduledSend`, `WebmailDelegation`, `WebmailAuditLog`, `WebmailSession`, `WebmailTodo`, `WebmailEvent`, `EmailContact`, `SmtpAccount`, `MailHost`, `PlatformSmtpConfig`, `MailAccount`, `EmailDomain`, `EmailMessage`.
  - Secrets Vault: `SecretProject`, `SecretItem`, `SecretAuditEntry`.
  - Support & Communications: `Ticket`, `TicketMessage`, `Announcement`, `SmsEvent`, `DiscordWebhookConfig`.
  - Status & Observability: `StatusPageConfig`, `SystemComponent`, `ScheduledMaintenance`, `StatusSubscriber`, `Incident`, `IncidentUpdate`, `UptimeCheck`, `StatusIncident`, `SpeedInsightMetric`, `EdgeConfigStore`, `EdgeConfigItem`.

### Migration Ledger
27 historical migrations exist in `packages/db/prisma/migrations/`:
- `20260719081412_init` through `20260922000200_waf_password_hash`.
- Validated with `migration_lock.toml` targeting `provider = "postgresql"`.

### Database Connection Status
- When executing `npx prisma migrate status`, connection failed with `P1001: Can't reach database server at localhost:5432`.
- Docker CLI is version 29.8.0, but Docker Desktop daemon is not currently running on the host system. Once Docker daemon is started, `docker compose -f docker-compose.local.yml up -d postgres` will bring up the PostgreSQL 16 container for migrations.

---

## 4. Authentication, User Management, Project Ownership, RBAC, and Isolation

### Authentication Flows (`apps/api/src/middleware/auth.ts`)
1. **OAuth SSO (Firebase Auth)**:
   - Client sends Firebase ID token via `Authorization: Bearer <idToken>`.
   - Verified on server with `firebaseAuth.verifyIdToken(idToken)`.
   - User row synced with PostgreSQL `User` table; assigns role (`customer` default, `admin`/`dev` if email matches `env.allowedAdminEmails` or `env.allowedDevEmails`).
2. **Customer & Developer API Keys**:
   - Header `x-api-key: shx_...` or `Authorization: Bearer shx_...`.
   - Hashed with SHA-256 via `hashApiKey()` and matched against `ApiKey` table.
   - Enforces account active status and updates `lastUsedAt`.
3. **Webmail Session JWT**:
   - Webmail users authenticate with signed HS256 tokens (`type: 'webmail_session'`) signed with `env.projectAuthJwtSecret`.

### Multi-Tenant Isolation & Ownership Enforcement
- **Resource Scoping**: `canAccessResource(ownerId, req, projectId, teamId, action)` in `apps/api/src/middleware/rbac.ts`.
- **Information Leak Prevention**: Customers attempting to access another tenant's deployment, managed database, or VPS are returned HTTP `404 Not Found` rather than `403 Forbidden`, preventing resource ID enumeration.
- **Secrets Protection**:
  - Environment variables, database master passwords, VPS root credentials, and SMTP secrets are encrypted at rest with AES-256-GCM via `apps/api/src/lib/secretsVault.ts`.
  - Database queries and API endpoints explicitly redact passwords and encryption keys before sending JSON to the client.

### Role-Based Access Control (RBAC)
- 4 Roles: `customer`, `admin`, `support`, `dev`.
- **Role Isolation Bug Identified**:
  - In `apps/api/src/middleware/auth.ts` lines 260–269:
    ```typescript
    export function requireDev(req: AuthedRequest, res: Response, next: NextFunction) {
      if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Dev or Admin access required' });
      }
      next();
    }
    ```
    `requireDev` permits `admin`, which breaches the intended dev-only boundary and causes `tests/integration/roleGuards.test.ts` to fail. It should strictly enforce `req.user?.role !== 'dev'`.

---

## 5. Broken Imports, Missing Types, Syntax Errors, and Configuration Bugs

### Defect 1: `@shanutechx/catalog` Type Error (Blocks `build:sdk`)
- **File**: `packages/catalog/src/index.ts:42-51`
- **Error**:
  ```text
  src/index.ts(42,45): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  src/index.ts(43,72): error TS2345: Argument of type 'Record<string, string> | undefined' is not assignable to parameter of type 'Record<string, string>'.
  ```
- **Cause**: In `CatalogDeployInput`, `templateSlug?: string` and `envVars?: Record<string, string>` are optional. In `CatalogHelper.deployTemplate(input: CatalogDeployInput)`, `this.getTemplate(input.templateSlug)` and `CatalogHelper.validateEnv(template, input.envVars)` are called without validating that `input.templateSlug` or `input.envVars` exist. Furthermore, `client.catalog.deploy(input)` returns `Promise<CatalogDeployResponse>`, whereas `deployTemplate` declares a return type of `Promise<Deployment>`.

### Defect 2: Missing Documentation Files (Fails `tests/unit/nodeVersion.test.ts`)
- **File**: `tests/unit/nodeVersion.test.ts:47-49`
- **Error**: `ENOENT: no such file or directory, open '...docs\complete-deployment.md'`
- **Cause**: Test checks that `docs/complete-deployment.md` and `docs/PRODUCTION_READY.md` specify Node >= 22. Neither the `docs/` folder nor those two markdown files exist in the repository root.

### Defect 3: Overly Restrictive Mailbox Admin Block (Fails `tests/unit/mailboxAcl.test.ts`)
- **File**: `apps/api/src/lib/mailboxAcl.ts:116-122`
- **Error**: `Expected: true, actual: false` in test `Read-only admin can read messages but is strictly denied write/sending permission` and `Legacy allowedAdminIds fallback grants read & write when no ACL is specified`.
- **Cause**: A hardcoded block was added:
  ```typescript
  if (userRole === 'admin') {
    return { allowed: false, reason: 'Access Denied: Admin users do not have access to Webmail.', permissions: [] };
  }
  ```
  This unconditionally blocks `admin` users even when granted specific read or manage permissions in `mailboxAcl` or `allowedAdminIds`.

### Defect 4: Git Auth Error Message Mismatch (Fails `tests/unit/nodeAgentRepoAuth.test.ts`)
- **File**: `services/node-agent/src/repo.js:161` vs `tests/unit/nodeAgentRepoAuth.test.ts:144`
- **Error**:
  ```text
  The input did not match the regular expression /Could not fetch the latest code for branch "main"/. Input:
  'Could not fetch branch "main" or "master": git fetch failed: ...'
  ```
- **Cause**: When fetching `main` fails and the fallback to `master` also fails, `repo.js:161` throws:
  `Could not fetch branch "${branch}" or "${altBranch}": ${fetchErr.message}`
  instead of including the standardized wording:
  `Could not fetch the latest code for branch "${branch}"...`.

### Defect 5: Role Guard Admin Leakage (Fails `tests/integration/roleGuards.test.ts`)
- **File**: `apps/api/src/middleware/auth.ts:265`
- **Error**: `requireDev` allows admin role through; test expects HTTP 403, receives HTTP 200.
- **Cause**: `requireDev` checks `req.user?.role !== 'dev' && req.user?.role !== 'admin'`, whereas `requireAdminOrDev` is the appropriate middleware for shared access.

### Defect 6: Orphaned Duplicate File
- **File**: `components/supabase/BucketFileBrowser.tsx`
- **Issue**: Located at workspace root outside of any package or app. An identical copy already exists inside `apps/dashboard/components/supabase/BucketFileBrowser.tsx`.

---

## 6. Functional Capability Matrix: Working vs Broken vs Missing Requirements

### Requirement R1: Repository Audit & Technology Research
- **Status**: **COMPLETE / VERIFIED**
- Baseline architecture, monorepo configurations, dependencies, linters, schemas, migrations, test suites, and Docker compositions fully mapped and verified.

### Requirement R2: Container Management & Build System
- **Status**: **SUBSTANTIALLY COMPLETE / MINOR DEFECTS**
- **Working**:
  - Real Docker Engine API integration via `dockerode` in `services/node-agent/src/docker.js`.
  - Comprehensive container lifecycle: start, stop, restart, pause, unpause, rename, top, changes, stats streaming, logs snapshot and live SSE log streaming.
  - Interactive WebSocket terminal exec session ticket gateway (`apps/api/src/lib/containerExecGateway.ts`).
  - AST security verification of Compose YAML (`validateComposeSecurity` in `apps/api/src/lib/composeIsolation.ts`) rejecting root mounts, raw `docker.sock`, privileged mode, and dangerous capabilities.
  - Multi-tier build pipeline (`services/node-agent/src/build.js`):
    - Tier 1: Railpack CLI
    - Tier 2: Nixpacks CLI
    - Tier 3: Containerized Railway Nixpacks (`ghcr.io/railwayapp/nixpacks:latest`)
    - Tier 4: Smart Dockerfile generation with runtime auto-detection (Node.js, Python, Go, Rust, PHP, Static HTML) and BuildKit integration.
  - Sub-second instant deployment rollbacks (`POST /deployments/:id/rollback`) with CAS deduplication and DNS target swap.
- **Incomplete / Minor Defect**:
  - `repo.js` error string discrepancy during failed git fetch (`nodeAgentRepoAuth.test.ts`).

### Requirement R3: Self-Hosted Supabase & Managed Database Platform (Developer Users)
- **Status**: **SUBSTANTIALLY COMPLETE / MISSING MARIADB**
- **Working**:
  - Self-Hosted Supabase Architecture: Dedicated compose stack in `docker/supabase/docker-compose.yml` and `templates/supabase-lite.yaml` with Kong gateway (port 8001), GoTrue/Auth, PostgREST, Realtime, Storage (MinIO/S3 compatible), Studio UI (port 3003), and Postgres (port 5435).
  - Centralized Developer Studio Hub: `apps/dashboard/app/(protected)/dev/projects/page.tsx` and `apps/api/src/routes/supabase.ts`.
  - Managed Database Engine: `services/node-agent/src/managedDb.js` and `apps/api/src/routes/managedDatabases.ts` implement:
    - PostgreSQL 16 (`postgres:16-alpine`, port 5432)
    - MySQL 8 (`mysql:8`, port 3306)
    - Redis 7 (`redis:7-alpine`, port 6379)
    - MongoDB 7 (`mongo:7`, port 27017)
    - Live cgroup CPU and RAM scaling without container restart (`scaleDatabase`).
    - Live master password rotation across all 4 database engines (`rotateDatabasePassword`).
    - Live database user management (create, update, delete, roles) (`manageDatabaseUser`).
    - Raw SQL/NoSQL query execution (`executeDatabaseQuery`).
    - Snapshot backup creation (`backupDatabase`), list backups, and restore (`restoreDatabase`).
- **Missing**:
  - **MariaDB engine support**: Mentioned in Requirement R3 ("PostgreSQL, MySQL, MariaDB, Redis, and MongoDB"), but MariaDB is completely omitted from `ManagedDatabaseType` in `schema.prisma`, `managedDatabases.ts` Zod enum, and `managedDb.js` image mappings.

### Requirement R4: Application Deployment & Service Catalog
- **Status**: **WORKING / MINOR SDK TYPE DEFECT**
- **Working**:
  - Git repository connection via GitHub App and GitLab OAuth (`apps/api/src/routes/gitConnect.ts`).
  - Automated deployment on Git push via Webhooks (`apps/api/src/routes/deployWebhooks.ts`).
  - Catalog template manager (`apps/api/src/lib/catalog/template-parser.ts`, `catalogRouter`) parsing YAML metadata, category filters, port detection, and deployment slot claims.
  - 10 real production Compose templates in `templates/` (Grafana, N8N, WordPress, Uptime Kuma, Hermes Agent, Lavalink, LiveKit, MongoDB, Redis, Supabase Lite).
- **Broken**:
  - `@shanutechx/catalog` SDK helper (`packages/catalog/src/index.ts`) has type mismatches preventing package build.

### Requirement R5: Remote Infrastructure, Email, Networking, & Security Hardening
- **Status**: **SUBSTANTIALLY COMPLETE / MINOR CONFIG FIXES**
- **Working**:
  - Reverse Proxy: Traefik 3.x integration with automatic Let's Encrypt TLS certificate generation and Cloudflare DNS automation (`createSubdomainRecord`).
  - VPS & Remote Node Management: SSH/SFTP client (`apps/api/src/lib/vpsSshClient.ts`, `routes/vps.ts`), live diagnostics (`testVpsConnectionRaw`), firewall management, reboot, and browser-based terminal tickets (`sshTerminalGateway.ts`).
  - Email Infrastructure: WildDuck email cluster integration (`apps/api/src/lib/wildduckClient.ts`, `initWildDuckOnBoot`) + Postal fallback support (`docker-compose.local.yml`).
  - Secrets Protection: AES-256-GCM vault encryption at rest (`secretsVault.ts`).
  - Multi-tenant isolation and customer ownership validation on all routes (`canAccessResource`).
- **Broken / Minor Defect**:
  - `requireDev` allows `admin` in `apps/api/src/middleware/auth.ts:265`.
  - `canAccessMailbox` blocks admins in `apps/api/src/lib/mailboxAcl.ts:116`.

---

## 7. Operational Baseline & Environment Readiness

### Host System State
- **OS**: Windows (NT 10.0, amd64)
- **Node.js**: Node.js >= 20.x / 22.x supported and active
- **Docker**: Docker CLI version 29.8.0 installed; Docker daemon is currently not running.
- **Action Required for Local Runtime**: Start Docker Desktop service before executing `docker compose -f docker-compose.local.yml up -d` or running database migrations against `localhost:5432`.
