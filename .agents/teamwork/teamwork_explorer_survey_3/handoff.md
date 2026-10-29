# Handoff Report: Audit of Supabase, Managed Databases, Git Deployments, Catalog, Remote Infra & Email (R3, R4, R5)

**Agent Archetype**: teamwork_explorer (Survey Explorer 3)  
**Working Directory**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_survey_3\`  
**Target Recipient**: teamwork_orchestrator (`3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`)  
**Mission**: Comprehensive audit of Supabase Projects, Managed Databases, Git Deployments, Service Catalog, Remote Infrastructure & Email for R3, R4, and R5.  
**Report Artifact**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md`

---

## 1. Observation

Direct, verbatim findings from the codebase with exact file paths and line numbers:

1. **Supabase Zero Persistence Flaw**:
   In `apps/api/src/routes/supabase.ts:481-501`:
   ```yaml
   supabase-db:
     image: supabase/postgres:15.6.1.143
     container_name: supa-${params.cleanSlug}-db
     restart: unless-stopped
     ports:
       - "0.0.0.0:${params.dbPort}:5432"
     environment:
       POSTGRES_PASSWORD: ${params.dbPassword}
       POSTGRES_DB: postgres
       POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U postgres"]
       interval: 10s
       timeout: 5s
       retries: 5
     deploy:
       resources:
         limits:
           cpus: '1.0'
           memory: 512M
   ```
   Lines 550-565 for `supabase-storage`:
   ```yaml
   supabase-storage:
     image: supabase/storage-api:v1.14.5
     container_name: supa-${params.cleanSlug}-storage
     restart: unless-stopped
     environment:
       ...
       FILE_STORAGE_BACKEND_PATH: "/var/lib/storage"
   ```
   There are **no `volumes:` mounts** declared for `supabase-db` or `supabase-storage`. All database transactions and uploaded files are stored in ephemeral container layers.

2. **Supabase Meta Routing Defect**:
   In `apps/api/src/routes/supabase.ts:502-516`:
   `supabase-meta` does NOT have a `ports:` section. It only listens inside the internal network on port 8080.
   However, in `supabase.ts:238`:
   `const metaUrl = isLocalHost ? 'http://localhost:8080' : 'http://${nodeIp || hostSubdomain}:8080';`
   And in `studioPlatform.ts:355`:
   `const baseMetaUrl = isLocal ? defaultMetaUrl : 'http://${formatted.db_host}:8080';`
   Direct HTTP requests to `nodeIp:8080` fail with `ECONNREFUSED` because port 8080 is never published to the host.

3. **Supabase Hardcoded / Fake Health Checks**:
   In `apps/api/src/routes/supabase.ts:272-309`:
   ```typescript
   // Lines 275-284:
   services: {
     kong: 'healthy',
     gotrue: 'healthy',
     postgrest: 'healthy',
     postgres: 'healthy',
     storage: 'healthy',
     realtime: 'healthy',
     functions: 'healthy',
     studio: 'healthy',
   }
   // Lines 301-309:
   const services = {
     kong: kongRes.ok ? 'healthy' : 'degraded',
     gotrue: 'healthy',
     postgrest: 'healthy',
     postgres: metaRes.ok ? 'healthy' : 'unreachable',
     storage: 'healthy',
     realtime: realtimeRes.ok ? 'healthy' : 'healthy',
     functions: 'healthy',
     studio: 'healthy',
   };
   ```
   Health of GoTrue, PostgREST, Storage, Edge Functions, Studio, and Realtime are hardcoded to `'healthy'`.

4. **Supabase Synthetic / Simulated Endpoints**:
   - `apps/api/src/routes/supabase.ts:1759-1765`: `GET /supabase/functions` returns static hardcoded array `[{ id: 'func_01', name: 'hello-world' }, { id: 'func_02', name: 'generate-ai-completion' }]`.
   - Lines 1800-1809: `POST /supabase/functions/:name/invoke` falls back to simulated Deno string responses: `Hello ${payload.name || 'User'} from Edge Function "${name}"!`.
   - Lines 1925-1927: `GET /supabase/observability` computes synthetic numbers: `let activeConns = dbCount * 3 + 4; let cacheHitRate = 98.4; let isFallback = true;`.
   - Lines 1974-1981: `GET /supabase/logs` returns hardcoded dummy logs (`log_01` to `log_05`) with `isFallback: true`.
   - Lines 1987-1999: `GET /supabase/integrations` returns static mock entries (`wh_01`, `v_01`, `fdw_01`).

5. **Supabase Missing Backups & Deprovision**:
   `packages/db/prisma/schema.prisma:48-49` defines `JobType.supabase_backup` and `supabase_restore`.
   In `apps/api/src/jobs/infrastructure-job-processor.ts:426-444`, the switch handles only `node_enroll`, `node_maintenance`, `supabase_provision`, `app_deploy`, and `mailbox_provision`. `supabase_backup`, `supabase_restore`, and `supabase_deprovision` are completely unhandled.

6. **Managed Databases Zero Persistence**:
   In `services/node-agent/src/managedDb.js:52-64`:
   `docker.createContainer({ Image: image, name: containerName, Env: env, HostConfig: { NetworkMode: 'shanutechx-internal', ... } })`
   No `Binds` or volume mounts exist in `HostConfig`. All Postgres, MySQL, Redis, and MongoDB containers store data inside ephemeral container layers.

7. **Managed Databases Fake Metrics (Math.random)**:
   In `apps/api/src/routes/managedDatabases.ts:1559-1560`:
   ```typescript
   const cpuPct = Math.round((Math.random() * 25 + 10) * 10) / 10;
   const ramMb = Math.round(120 + Math.random() * 80);
   ```
   CPU and RAM usage are randomized numbers rather than reading real container cgroup stats.

8. **Managed Databases Missing Engine**:
   `packages/db/prisma/schema.prisma:145-150` defines:
   `enum ManagedDatabaseType { postgres mysql redis mongodb }`
   `mariadb` is not defined in Prisma, not permitted by Zod in `managedDatabases.ts:31`, and not implemented in `services/node-agent/src/managedDb.js`.

9. **Git Deployment Rollback Limitation**:
   In `apps/api/src/routes/deployWebhooks.ts:289`, git push redeployments execute:
   `await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'building' } });`
   The active `Deployment` is overwritten in place. In `deployments.ts:2051-2125`, `POST /deployments/:id/rollback` expects a separate currently running `targetDeploymentId`. There is no immutable release table (`DeploymentRelease`), making historical git commit rollbacks impossible for push-based deployments.

10. **Service Catalog Post-Deploy Health Gap**:
    In `apps/api/src/routes/catalog.ts:578-581`, after calling node-agent `/agent/compose/up`, the deployment status is set directly to `running` without probing service endpoints or verifying that containers inside the Compose stack reached healthy state.

11. **Cloud VPS Provider API Deletion**:
    Commit `875851b57706c3a96981905fe030defefcba0985` deleted `apps/api/src/routes/leaseweb.ts` (665 lines) and `leasewebClient.ts`. In `apps/api/src/lib/orderFulfillment.ts:77-121`, VPS orders are not auto-provisioned; they register a `pending` `VpsProvision` and alert staff via Discord for manual setup.

12. **WildDuck / SMTP Wiring Gap**:
    In `apps/api/src/routes/smtp.ts:349-415` (`POST /smtp-accounts`), the endpoint writes to `prisma.smtpAccount` and sends a release email, but never calls `wildduckClient.createUser` or `createAddress`. The `mailbox_provision` job in `infrastructure-job-processor.ts:383` is never dispatched anywhere.

---

## 2. Logic Chain

1. **Premise**: Requirement R3 requires multiple independent self-hosted Supabase projects and managed databases with persistent storage, verifiable health, and backup/restore capabilities for developer users.
   - *Evidence*: `supabase.ts:481-501` and `managedDb.js:52-64` omit Docker volume mounts.
   - *Inference*: Recreating or restarting containers in production destroys user data. Named volume mounts must be added to `buildSupabaseComposeYaml` and `provisionDatabase`.
   - *Evidence*: `supabase.ts:275-309` and `managedDatabases.ts:1559-1560` use hardcoded strings and `Math.random()`.
   - *Inference*: Health and metrics currently simulate reality rather than reporting actual service state. Real HTTP probes and Docker `container.stats()` must replace these stubs.
   - *Evidence*: `infrastructure-job-processor.ts:426-444` throws an error on `supabase_backup` and `supabase_restore`.
   - *Inference*: Supabase backup/restore is non-functional and must be implemented with `pg_dumpall` streaming to S3/R2.

2. **Premise**: Requirement R4 mandates deploying real applications from Git repositories with history, logs, rollbacks, and a functional service catalog with health verification.
   - *Evidence*: GitHub App integration (`github.ts`), webhooks (`deployWebhooks.ts`), and multi-tier building (`build.js`) are genuinely functional and securely implemented with ephemeral tokens.
   - *Evidence*: `deployWebhooks.ts:289` mutates the `Deployment` record in place without an immutable versioning table, yet `deployments.ts:2051` requires a running `targetDeploymentId` to roll back.
   - *Inference*: An immutable `DeploymentRelease` ledger must be added to link commits and image tags to enable instant rollbacks.
   - *Evidence*: `catalog.ts:578` marks catalog deployments `running` without post-deploy readiness checks.
   - *Inference*: A post-provision readiness polling loop must be added to verify container health before returning a success status.

3. **Premise**: Requirement R5 demands remote infrastructure management adapters and real email delivery via WildDuck without mocked responses.
   - *Evidence*: Node enrollment and live VPS management (SFTP, SSH web terminal, UFW rules) in `vps.ts` and `nodes.ts` are genuinely functional.
   - *Evidence*: Leaseweb cloud provider files were deleted in commit `875851b5`.
   - *Inference*: Automated cloud purchasing is absent; VPS management operates strictly via direct SSH against registered infrastructure.
   - *Evidence*: `wildduckClient.ts` provides complete WildDuck API coverage, but `smtp.ts:POST /smtp-accounts` fails to call it.
   - *Inference*: `smtp.ts` must call `wildduckClient.createUser` or dispatch the existing `mailbox_provision` job.

---

## 3. Caveats

1. **Remote Target Infrastructure**:
   The investigation was conducted in read-only survey mode on local workspace code. Tests against live remote VPS nodes or cloud providers were not executed during this survey.
2. **Third-Party Credentials**:
   Live operations require valid credentials for Cloudflare API, GitHub App private key, WildDuck API key, and target SSH server credentials in `.env`.
3. **No Code Modified**:
   In strict adherence to the Survey Explorer role and protection rules, zero source code files were altered.

---

## 4. Conclusion

The platform possesses well-structured foundational frameworks for GitHub App auth, multi-tier buildpacks (Railpack/Nixpacks), WildDuck API integration, node clustering, and dynamic port exposure. However, **critical blocking gaps exist across R3, R4, and R5**:
1. **Data Loss Flaw**: Containers for Supabase PostgreSQL, Supabase Storage, and all Managed Databases lack persistent volume mounts.
2. **Simulated Code**: Supabase health checks, edge function invocations, observability metrics, logs, and managed database CPU/RAM telemetry use hardcoded stubs or `Math.random()`.
3. **Missing Features**: MariaDB engine, Supabase backup/restore, immutable git deployment releases, and SMTP-to-WildDuck provisioning are unimplemented or unwired.
4. **Broken Routing**: Supabase Meta port 8080 is unpublished to the host.

A detailed, 4-phase technical roadmap to remediate every defect and achieve full production readiness is documented in `survey_report.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect Volume Absence**:
   - Run: `view_file` on `apps/api/src/routes/supabase.ts` (lines 481-505 and 550-570).
   - Verify `supabase-db` and `supabase-storage` have no `volumes:` section.
   - Run: `view_file` on `services/node-agent/src/managedDb.js` (lines 52-65).
   - Verify `docker.createContainer` `HostConfig` lacks `Binds` or `Mounts`.

2. **Inspect Math.random() & Mocked Telemetry**:
   - Run: `view_file` on `apps/api/src/routes/managedDatabases.ts` (lines 1559-1565).
   - Verify `Math.random()` generates `cpuPct` and `ramMb`.
   - Run: `view_file` on `apps/api/src/routes/supabase.ts` (lines 275-309).
   - Verify hardcoded `'healthy'` strings for gotrue, postgrest, storage, etc.

3. **Inspect Missing Job Handlers**:
   - Run: `view_file` on `apps/api/src/jobs/infrastructure-job-processor.ts` (lines 421-445).
   - Verify switch statement throws on `supabase_backup` and `supabase_restore`.

4. **Run Unit Tests**:
   - Execute: `npm run test:unit` in terminal.
   - Inspect `tests/unit/supabaseStudioPlatform.test.ts` to see that only string presence was tested, not volume configuration.

---
*Certified by teamwork_explorer_survey_3.*
