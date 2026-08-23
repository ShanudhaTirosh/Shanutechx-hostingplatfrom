# Codebase Bug Audit Report

## Scope note (read this first)

This is a **partial-coverage, read-only audit**, not an exhaustive line-by-line review of the entire
repository. The codebase is large (~1,100 total files; ~458 first-party, non-vendored source files
totalling ~64,000 lines once `packages/{auth-js,postgrest-js,realtime-js,functions-js,storage-js,
supabase-js}` are excluded as vendored forks of the real Supabase SDK monorepo — confirmed via their
`package.json` `repository` fields pointing at `supabase/*` upstream repos).

Given the size, this pass deliberately front-loaded the highest-risk, highest-blast-radius areas:

- **Fully read, file-by-file:** `apps/api/src/lib/` (all ~44 files), `apps/api/src/middleware/`,
  `apps/api/src/env.ts` / `index.ts`, `services/node-agent/src/` (all 11 files), and roughly 20 of the 49
  files in `apps/api/src/routes/` (the ones most likely to carry business-critical logic: deployments,
  cockpit, sms, payments, projects, vps, billing, invoices, apiKeys, deployWebhooks, zipDeployments,
  dockerDeployments, containers, gitConnect, prWebhooks, secrets, teams, orders, internalBot, plus spot
  reads of `nodes.ts` and `managedDatabases.ts`).
- **Spot-checked:** `packages/db/prisma/schema.prisma`, `services/whatsapp-bot/src/commandHandler.js`,
  worker/job scheduling (`apps/api/src/worker.ts`, `jobs/workspace-cleanup.ts`).
- **Not reached in this pass:** the remaining ~29 route files (`billing.ts` was read; `smtp.ts`,
  `domains.ts`, `leaseweb.ts`, `email.ts`, `catalog.ts`, `products.ts`, `supabase.ts`, `webmail.ts`,
  `knowledgebase.ts`, `cms.ts`, `settings.ts`, `analytics.ts`, `services.ts`, `aiSubscription.ts`,
  `vps-plans.ts`, `templates.ts`, `openapi.ts`, `pushTokens.ts`, `me.ts`, `status.ts`,
  `traefikStatus.ts`, `health.ts`, `discordWebhookConfig.ts`, `webhooks.ts` route file, `tickets.ts`,
  `admin.ts` were not read this pass); `packages/{catalog,client,deployments,node-agent,types,tracing}`;
  `services/discord-bot`; all three frontend apps (`apps/dashboard`, `apps/web`, `apps/mobile-admin`);
  `infra/`, `templates/`, `config/`, `docker/`, `firebase/`, `components/`; and the `tests/` suite.

Everything below is grounded in code actually read and cross-referenced against its callers — nothing here
is guessed. Treat the absence of a finding in an unreviewed area as "not yet checked," not "clean."

Also worth knowing: this codebase has already been through at least two prior fix passes (referenced in
its own comments as "audit finding H1", "H6", "H7/H8/H10", and a `docs/CHANGELOG_fixes_applied.md`). Every
issue below was independently re-verified against the current code rather than assumed from those
comments, and none of them duplicate what those prior passes already fixed.

## Summary

- **Files fully reviewed this pass:** ~75 first-party source files (see *Files Reviewed* below)
- **Confirmed bugs:** 22
- **Suspected/unconfirmed issues:** 1
- **Severity breakdown:** 5 Critical · 8 High · 9 Medium · 2 Low

---

## Critical Issues

### 1. Container resource limits (CPU/memory/storage) are silently never applied
- **File:** `services/node-agent/src/index.js` (`POST /agent/deployments/:deploymentId/build-and-run`, ~line 165), `services/node-agent/src/docker.js` (`runContainer`), `apps/api/src/lib/nodeAgentClient.ts` (`BuildAndRunParams`), `apps/api/src/routes/deployments.ts` (`PATCH /deployments/:id/limits`)
- **Category:** Logic/API contract mismatch, billing integrity
- **Description:** The node-agent's build-and-run route destructures only `{ repoUrl, branch, subdomain, internalPort, envVars }` from the request body and never forwards `cpuLimit`/`memoryLimit`/`storageLimit` to `runContainer()`, even though `runContainer()` accepts them and apps/api sends them on every create/redeploy/limit-update call.
- **Why it's a bug:** Every container on the platform runs at the hardcoded defaults (1 CPU / 512MB), regardless of purchased plan. `PATCH /deployments/:id/limits` updates the DB and reports success, but the actual container never gets the new limits — its own comment says the restart happens "to ensure the new limits are enforced by Docker," which never occurs.
- **Suggested fix:** Destructure and forward `cpuLimit`/`memoryLimit`/`storageLimit`/`routingMode`/`publishedPort` in the node-agent route.

### 2. "Stop" force-removes the container, so "Start" always fails afterward
- **File:** `services/node-agent/src/index.js` (`POST /agent/deployments/:containerId/stop`), `services/node-agent/src/docker.js` (`stopAndRemove`), `apps/api/src/routes/deployments.ts` (`/deployments/:id/stop`, `/deployments/:id/start`)
- **Category:** State machine / lifecycle bug
- **Description:** The deployment-level stop endpoint calls `stopAndRemove()` (`container.remove({force:true})`), which deletes the container entirely — not the plain `stopContainer()` used by the separate admin container-management page. `containerId` is never cleared afterward, and `/start` tries to start that same now-deleted container ID.
- **Why it's a bug:** Once stopped, a deployment's container no longer exists on the node; the very next Start attempt 404s at the Docker layer and surfaces as a 502 to the user. Confirmed the dashboard offers a Start button whenever `status` is `stopped`/`failed`. The only real recovery is a full redeploy.
- **Suggested fix:** Either make deployment-level stop a plain stop (matching `/agent/containers/:id/stop`), or have `/start` detect a missing container and transparently redeploy.

### 3. Table Editor insert/update/delete row endpoints don't exist on node-agent (always 404)
- **File:** `apps/api/src/routes/projects.ts` (`POST/PATCH/DELETE /projects/:id/tables/:table/rows[/:pk]`), `services/node-agent/src/index.js` (only `GET .../tables` and `GET .../tables/:table/rows` exist), `apps/dashboard/lib/api.ts` (`insertRow`/`updateRow`/`deleteRow`)
- **Category:** API contract mismatch / missing implementation
- **Description:** apps/api proxies write requests to node-agent routes that were never implemented; grepping every `app.get/post/patch/delete` registration in node-agent's `index.js` confirms only the read route exists.
- **Why it's a bug:** The dashboard's Table Editor "Add/Edit/Delete row" buttons call real, wired-up apps/api endpoints that 404 against the node agent every time. The entire write path of the self-hosted Supabase-like data browser is non-functional; only reads work.
- **Suggested fix:** Implement the three missing node-agent routes (parameterized INSERT/UPDATE/DELETE via psql, validating `table` with the existing `validateIdentifier()` helper).

### 4. Managed-database backup/restore is entirely fake
- **File:** `apps/api/src/lib/managedDbBackup.ts` (`createManagedDatabaseBackup`, `restoreManagedDatabaseBackup`), `apps/api/src/routes/managedDatabases.ts` (`POST /managed-databases/:id/backups`, `.../restore`)
- **Category:** Silent failure / data-loss trap
- **Description:**
  - "Backup" calls `runBackup()` from `lib/backup.ts` — which dumps the **platform's own control-plane Postgres database**, not the customer's managed database (`db.node`, `db.type`, and the freshly-decrypted `password` are read but never used). Whatever that produces is then discarded anyway: the object actually uploaded to R2 is a hardcoded ~90-byte placeholder text comment (`-- Backup dump for database ...`), not real data. If the dump throws, `.catch(() => ({ key, sizeBytes: 1024 }))` fabricates a fake successful-looking result.
  - "Restore" does no work at all: it looks up the database row, logs a line, and unconditionally returns `{ success: true }`.
- **Why it's a bug:** This is reachable by the database's own customer-owner (gated only by `canAccessResource`), returns HTTP 201/200 with a plausible-looking response every time, and there is no real backup ever created and no real restore ever performed. A customer or staff member who trusts this feature discovers it was fake only at the moment of an actual data-loss incident.
- **Suggested fix:** Implement real per-database dump/restore targeting `db.node`/decrypted credentials (mirroring `dumpDatabase()` in `backup.ts`, parameterized instead of hardcoded to the platform DB); propagate real errors instead of swallowing them.

### 5. PR/MR "preview deployment" webhook is entirely fake
- **File:** `apps/api/src/routes/prWebhooks.ts` (`POST /webhooks/pr-deploy`)
- **Category:** Silent failure / stub masquerading as a feature
- **Description:** After correctly verifying the GitHub/GitLab webhook signature, the handler for every PR/MR open/sync/close event only calls `logger.info(...)` and returns a fabricated JSON success message (`"Triggered preview deployment for PR #123"` / `"Teardown preview deployment for PR #123"`). There is no `prisma.deployment.create`, no call to any deploy/node-agent function, and no database write anywhere in the handler.
- **Why it's a bug:** This implements what's normally flagship PaaS functionality (automatic per-PR preview environments) and actively lies about having done it, to both the calling webhook provider and (implicitly) anyone using the feature. It's discoverable only when a developer looks for the preview URL that was supposedly created and finds nothing.
- **Suggested fix:** Wire this into the real deploy pipeline (`lib/deployPipeline.ts`), creating an `isPreview` deployment on open/sync and tearing it down on close, or clearly mark the feature as unimplemented until it is.

---

## High Priority Issues

### 6. Node-agent workspace-cleanup route references undefined `path`/`fs` — always fails, disk-space leak
- **File:** `services/node-agent/src/index.js` (`DELETE /agent/fs/:deploymentId/cleanup`, ~line 489), consumed hourly by `apps/api/src/jobs/workspace-cleanup.ts` via `apps/api/src/worker.ts`'s `workspace-cleanup` BullMQ schedule (`0 * * * *`)
- **Category:** Resource leak / missing import
- **Description:** Neither `path` nor `fs` (Node built-ins) are ever `require()`d at module scope in `index.js` (a `const fs = require('fs')` exists, but scoped to a different, unrelated handler). Every call throws `ReferenceError: path is not defined`, caught and returned as HTTP 500.
- **Why it's a bug:** The caller only logs a warning on non-2xx and never sets `workspaceCleanedAt`, so the job silently "succeeds" from BullMQ's perspective every hour while the actual per-deployment cleanup always fails — node disks for zip/upload-based deployments are never purged.
- **Suggested fix:** Add `const path = require('path'); const fs = require('fs');` at the top of the file.

### 7. Shadow-backup restore path is never wired up — latent data-loss risk once #6 is fixed
- **File:** `services/node-agent/src/repo.js` (`prepareWorkspace`), `services/node-agent/src/index.js` (build-and-run route), `apps/api/src/lib/nodeAgentClient.ts` (`BuildAndRunParams`)
- **Category:** Missing parameter plumbing / latent data loss
- **Description:** `prepareWorkspace(deploymentId, repoUrl, branch, remoteBackupUrl)` has a documented restore-from-shadow-repo path for when the local workspace is empty, but the only real caller passes just 3 args — `remoteBackupUrl` is always `undefined`. No apps/api call site or type ever supplies it.
- **Why it's a bug:** Currently masked because #6 means workspaces are never actually purged. The moment #6 is fixed, any zip/upload deployment whose workspace gets purged and later needs a rebuild (redeploy, env-var update, limit change) will build from an empty directory with no recovery path, silently producing a broken container.
- **Suggested fix:** Thread the deployment's `backupRepoFullName` through `BuildAndRunParams` into the node-agent call.

### 8. Cockpit routes resolve a customer VPS's "IP" from an opaque provider ID, not a real IP
- **File:** `apps/api/src/routes/cockpit.ts` (`resolveNodeAccess`, ~lines 22-45)
- **Category:** Logic bug / wrong field used
- **Description:** `ip: provision.externalId || '127.0.0.1'` — but `VpsProvision.externalId` is documented in the schema as "the upstream provider's VPS/instance ID," not an IP. Every other place that needs a VPS's real IP resolves it dynamically from the provider API (`routes/leaseweb.ts`).
- **Why it's a bug:** Every Cockpit feature (monitoring, systemd, users, Docker, firewall, SSH ticket) is non-functional for any customer VPS provision — the constructed URL targets a non-IP string and fails to connect. If `externalId` is empty, it falls back to `127.0.0.1` — the API server's own loopback, which is actively dangerous in any colocated deployment topology.
- **Suggested fix:** Resolve the real IP via the Leaseweb API (as `leaseweb.ts` does) instead of `externalId`; drop the `127.0.0.1` fallback.

### 9. SMTP mailbox passwords use `Math.random()` plus an identical hardcoded suffix
- **File:** `apps/api/src/lib/orderFulfillment.ts` (~line 94)
- **Category:** Security — weak credential generation
- **Description:** `const autoPassword = \`Smtp_${Math.random().toString(36).slice(2, 10)}!2026\`;` — non-cryptographic RNG, and every account's password ends in the same literal `!2026`. The Managed Database block 90 lines below in the same file correctly uses `crypto.randomBytes(16).toString('hex')`, confirming this isn't a deliberate simplicity choice elsewhere.
- **Why it's a bug:** Reduces effective password entropy for every auto-provisioned SMTP account on the platform; part of the password is knowable in advance.
- **Suggested fix:** `crypto.randomBytes(n).toString('base64url')`, no fixed suffix.

### 10. Cockpit SSH terminal always fails to authenticate for nodes registered without an explicit private key
- **File:** `apps/api/src/routes/nodes.ts` (~lines 436-438, 557-558), `apps/api/src/lib/sshTerminalGateway.ts` (~lines 145-161)
- **Category:** Logic bug / incomplete feature
- **Description:** When a node is registered without a `privateKey`, `sshKeyRef` is stored as the literal string `ssh://user@host:port`. The terminal gateway detects this format and its own comment says "Use key auth," but the code only sets `connectOpts.username` — no password or private key is ever supplied, so `ssh2.connect()` always fails with "all authentication methods failed."
- **Why it's a bug:** The Cockpit browser-terminal feature is guaranteed broken for every node added without an explicit SSH key at registration time — a plausible, common real-world path.
- **Suggested fix:** Either require a private key at registration, or implement the promised password re-prompt flow.

### 11. Git-push deploy webhook never checks the pushed branch against the deployment's tracked branch
- **File:** `apps/api/src/routes/deployWebhooks.ts` (`POST /deploy-webhooks/:deploymentId`, ~lines 132-157)
- **Category:** Logic bug — missing guard contradicts the code's own documented intent
- **Description:** The handler's own comment says pushes to unrelated branches shouldn't trigger a rebuild, but the code never compares `pushedBranch` against `deployment.branch` (a real schema field) before calling `buildAndRun`.
- **Why it's a bug:** A push to any branch of the connected repo — a feature branch, a bot's branch, anyone's branch — triggers a real rebuild-and-restart of the live deployment using that branch's code, silently overriding what's supposed to be running.
- **Suggested fix:** `if (deployment.branch && pushedBranch && pushedBranch !== deployment.branch) return;` before calling `buildAndRun`.

### 12. Zip/file-upload and Docker-image/Compose deploy endpoints bypass subdomain safety checks and node-selection policy
- **File:** `apps/api/src/routes/zipDeployments.ts` (`POST /deployments/upload`), `apps/api/src/routes/dockerDeployments.ts` (both routes)
- **Category:** Missing validation / authorization-policy bypass
- **Description:** All three routes set `Deployment.subdomain` directly from a lightly-sanitized user string, completely skipping `generateSubdomain()`/`validateCustomSubdomain()` (no reserved-word check, no uniqueness check — and `Deployment.subdomain` has no DB-level unique constraint either, see Medium #14 below). All three also honor a customer-supplied `nodeId` directly with no ownership/tag/active check, bypassing `selectNodeForDeployment()`'s explicit "customers can never choose a node" policy — which the main Git-based `POST /deployments` path does correctly enforce.
- **Why it's a bug:** Both issues are deterministically triggerable by an ordinary customer (no race condition needed): two customers naming their app `app`/`test`/`demo` collide on a hostname, or a customer claims a reserved system subdomain (`admin`, `api`, `dashboard`); a customer can place their deployment on any node in the cluster, including ones not meant for general hosting.
- **Suggested fix:** Route all three creation paths through the same `generateSubdomain()` and `selectNodeForDeployment()` calls the main deploy path uses.

### 13. WhatsApp bot customer lookup matches phone numbers by substring
- **File:** `apps/api/src/routes/internalBot.ts` (`GET /internal/customer-summary`, ~lines 38-46)
- **Category:** Logic bug — unsafe match / cross-tenant data exposure
- **Description:** `phoneNumber: { contains: phone }` is one of three OR branches in the lookup query; any stored number that merely contains the incoming digits as a substring matches.
- **Why it's a bug:** Two real customers whose numbers happen to be substrings of one another (plausible after country-code/leading-zero stripping) can have deployment names/URLs and open-ticket subjects returned to the wrong person's WhatsApp conversation, non-deterministically (`findFirst` picks whichever row Postgres returns first).
- **Suggested fix:** Drop the `contains` branch; match only on normalized exact equality.

---

## Medium Priority Issues

### 14. Inconsistent admin visibility between list and detail/action RBAC helpers
- **File:** `apps/api/src/middleware/rbac.ts` (`ownedResourceWhere` vs `canAccessResource`/`verifyResourceOwnershipAsync`), affects ~14 route files (`deployments.ts`, `vps.ts`, `invoices.ts`, `domains.ts`, `smtp.ts`, `email.ts`, `leaseweb.ts`, `managedDatabases.ts`, `livekit.ts`, `apiKeys.ts`, `billing.ts`, `cockpit.ts`, `deployWebhooks.ts`, `filesystem.ts`, `orders.ts`)
- **Category:** Logic inconsistency
- **Description:** `ownedResourceWhere` (used for list endpoints) scopes an admin to only customers explicitly `assignedAdminId === admin.id`. `canAccessResource`/`verifyResourceOwnershipAsync` (used for single-resource detail/action endpoints) additionally include customers with `assignedAdminId == null` (unassigned).
- **Why it's a bug:** An admin can GET/act on a specific unassigned customer's resource by ID even though it never appears in their own list view — likely an unintended divergence between the two helpers rather than a deliberate design choice.
- **Suggested fix:** Align both helpers to the same inclusion rule, or document the divergence explicitly if intentional.

### 15. Orphaned Cloudflare DNS record on subdomain change
- **File:** `apps/api/src/routes/deployments.ts` (`PATCH /deployments/:id/subdomain`)
- **Category:** Resource leak
- **Description:** Creates a new CNAME/A record for the new subdomain via `createSubdomainRecord()` but never deletes the old subdomain's DNS record.
- **Why it's a bug:** Stale DNS records accumulate indefinitely, still pointing at the node.
- **Suggested fix:** Call `deleteDnsRecord()` for the previous record after successfully creating the new one.

### 16. `PATCH /deployments/:id/limits` doesn't mark the deployment `failed` on restart failure
- **File:** `apps/api/src/routes/deployments.ts`
- **Category:** State desync
- **Description:** Unlike the sibling `/redeploy` and `/env` handlers, on a `buildAndRun` failure this endpoint writes an ndjson error event but never updates `deployment.status`.
- **Why it's a bug:** The DB can claim `status: 'running'` while the container actually failed to restart with new limits — the UI shows a healthy deployment that isn't.
- **Suggested fix:** Mirror the `status: 'failed'` update used in the other two restart-triggering endpoints.

### 17. `Deployment.subdomain` has no unique DB constraint — race condition on the normal create path
- **File:** `apps/api/src/lib/subdomain.ts` (`generateSubdomain`/`isTaken`), `packages/db/prisma/schema.prisma` (`subdomain String?`, confirmed no `@unique`)
- **Category:** Race condition
- **Description:** Collision avoidance is a check-then-act `findFirst` loop with no transaction, advisory lock, or DB constraint backstop.
- **Why it's a bug:** Two concurrent deploy requests that compute the same candidate name (common app names, or a double-submitted form) can both pass the check before either row exists, producing two live deployments sharing one hostname.
- **Suggested fix:** Add `@unique` to the schema field and handle the resulting `P2002` with a regenerate-and-retry.

### 18. SQL injection via unvalidated `:table` route param in node-agent
- **File:** `services/node-agent/src/index.js` (`GET /agent/projects/:projectId/tables/:table/rows`, ~lines 718-732)
- **Category:** Security — injection
- **Description:** `req.params.table` is interpolated directly into a double-quoted SQL identifier with no call to the `validateIdentifier()` helper the same file already uses correctly in `listTables()`.
- **Why it's a bug:** A crafted `table` value containing `"` can break out of the identifier and inject arbitrary SQL, executed via `psql` (a multi-statement script runner, not a parameterized driver).
- **Mitigating factor:** This route (and the whole router it's reached through) requires the `dev` platform role, which already has an intentional raw-SQL execution endpoint against the same connection — so this isn't a new privilege for that actor, just an inconsistency.
- **Suggested fix:** Call `validateIdentifier(req.params.table)` before use, matching `listTables()`.

### 19. Managed Database auto-provisioning has no idempotency guard and ignores node health/tags
- **File:** `apps/api/src/lib/orderFulfillment.ts` (Managed Database block, ~lines 176-215)
- **Category:** Missing idempotency check / wrong node-selection logic
- **Description:** Unlike the SMTP and LiveKit blocks in the same function (both check for an existing record before creating), the Managed Database block has no existence check before creating a new database + container. It also uses `prisma.node.findFirst()` (no `isActive` filter, no role-tag check, no capacity weighting) instead of the platform's own `selectNodeForDeployment()`, used correctly for LiveKit just above it.
- **Why it's a bug:** If `fulfillOrder()` is ever invoked twice for the same order, the customer gets duplicate database containers. Every managed database on the platform can land on the same single node regardless of tagging/capacity/active status.
- **Suggested fix:** Add an existence check on `orderItemId`; route node selection through `selectNodeForDeployment()`.

### 20. Payment-proof upload writes to disk before ownership is checked
- **File:** `apps/api/src/lib/uploads.ts` (`multer.diskStorage.destination`), `apps/api/src/routes/payments.ts` (`POST /orders/:orderId/payments/proof`)
- **Category:** Authorization-ordering bug / minor path-traversal surface
- **Description:** `uploadPaymentProof` (which writes the file using the raw, unvalidated `req.params.orderId`) runs before `loadOwnedOrder()` (the actual ownership check).
- **Why it's a bug:** Any authenticated user can cause a file to be written into `payments/<any orderId>/`, including other customers' order folders — the request ultimately 404s (no `Payment` row created), but the file is left orphaned on disk with no cleanup. The unvalidated `orderId` segment is also a mild path-traversal surface worth checking against the actual reverse-proxy/Express normalization in the real deployment.
- **Suggested fix:** Validate `orderId` format and confirm ownership with a cheap existence query before invoking the upload middleware.

### 21. `DELETE /vps-provisions/:id` has no status check — customers can delete credentials for a still-active VPS
- **File:** `apps/api/src/routes/vps.ts` (~lines 94-108)
- **Category:** Missing validation
- **Description:** The docstring says this removes a "terminated" VPS provision, but the handler never checks `provision.status`; it's gated only on ownership.
- **Why it's a bug:** A customer can delete the record for a still-`provisioned` (active) VPS, permanently destroying the platform's only copy of its panel URL/username/password — the underlying VPS keeps running at the provider with no way to look up how to reach it again through this platform.
- **Suggested fix:** Require `status === 'terminated'` before allowing delete, matching the docstring.

### 22. `failoverDeadNode()` and `checkMetricAlerts()` are dead code; the latter would spam on activation
- **File:** `apps/api/src/lib/nodeSelector.ts` (`failoverDeadNode`), `apps/api/src/lib/alerts.ts` (`checkMetricAlerts`)
- **Category:** Dead code / latent notification-spam bug
- **Description:** Both functions are never called from any route, job, or scheduler (confirmed by grep). `failoverDeadNode`'s docstring promises automatic node failover that doesn't happen anywhere in the platform, and even if called, only updates DB pointers without ever rebuilding the container on the new node. `checkMetricAlerts`'s failed-deployment alert has no state-transition dedup (unlike `uptimeMonitor.ts`'s correctly-deduped equivalent) — it would notify the customer on every sweep, forever, for any deployment sitting in `failed` state, if it were ever wired into a scheduler.
- **Suggested fix:** Either wire these up properly (with the container-rebuild step added to failover, and transition-based dedup added to the alert), or remove them to avoid misleading future maintainers.

### 23. Team `resourcePermissions` (granular per-resource access) is stored but never enforced
- **File:** `apps/api/src/routes/teams.ts` (creates/updates `ResourcePermission` rows)
- **Category:** Authorization-model gap
- **Description:** `ResourcePermission` is referenced only in `teams.ts` — no RBAC helper or route ever reads it back. `GET /teams/:id` returns the full list of the team owner's deployments/databases/VPS/SMTP accounts (metadata only, no credentials) to any team member, regardless of their assigned granular permissions.
- **Why it's a bug:** The per-resource permission UI/API implies enforcement that doesn't exist; a "viewer" scoped to one resource actually sees metadata for all of the owner's resources.
- **Suggested fix:** Filter the `GET /teams/:id` resource lists (and any other team-scoped resource access) by the caller's `ResourcePermission` entries when present.

---

## Low Priority / Minor Issues

### 24. Invoice PDF has no pagination
- **File:** `apps/api/src/lib/invoicePdf.ts` (`generateInvoicePdf`, ~lines 63-71)
- **Category:** Edge-case overflow
- **Description:** The line-item loop draws each row at a fixed page position with no bottom-of-page check and no `addPage()` call.
- **Why it's a bug:** An order with roughly 35+ line items has its later rows (and possibly the Total line) drawn off-page and invisible in the rendered PDF.
- **Suggested fix:** Add a page-break check inside the loop.

### 25. SMTP release email falls back to a literal placeholder password if `SMTP_PASS` is unset
- **File:** `apps/api/src/lib/smtpProvisioner.ts` (`sendSmtpReleaseEmail`, ~line 138)
- **Category:** Configuration fallback masking misconfiguration
- **Description:** `pass: process.env.SMTP_PASS || 'smtp_pass'` — a missing required env var silently becomes a doomed-to-fail literal string instead of a startup-time validation error.
- **Why it's a bug:** In a misconfigured environment, credential-release emails fail silently (caught and logged, not surfaced) instead of failing loudly at boot.
- **Suggested fix:** Validate required SMTP env vars at startup (`env.ts`) rather than falling back per-call.

---

## Suspected Issues (Unconfirmed)

### A. Path traversal via `req.params.orderId` in payment-proof upload
- **File:** `apps/api/src/lib/uploads.ts`
- Flagged as part of Medium #20 above. The ownership-ordering bug is confirmed; whether a crafted `orderId`
  segment can actually escape `UPLOADS_DIR/payments/` depends on how the real reverse proxy / Express
  routing configuration normalizes `..` sequences within a single route-param segment, which wasn't
  verified at runtime in this pass. Worth a direct test (`curl` with an encoded `..` segment) before
  ruling in or out.

---

## Cross-File / Architectural Observations

- **"Fake success" is a repeated pattern, not a one-off.** Managed-database backup/restore (#4) and PR
  preview deployments (#5) both return fabricated success responses while doing nothing real. Anywhere
  else in the product that reports success on a write/provisioning action deserves a skeptical re-check
  for the same pattern, since it's evidently happened at least twice independently.

- **Protections added to the main deploy path were never propagated to the alternate ones.** The Git-based
  `POST /deployments` route correctly uses `generateSubdomain()`/`validateCustomSubdomain()` and
  `selectNodeForDeployment()`'s customer-can't-pick-a-node policy. The zip-upload, Docker-image, and
  Docker-Compose deployment-creation routes (added later, presumably) all bypass both protections in the
  same way (#12) — this looks like the safety logic was written once against one entry point and never
  factored out for reuse against the others.

- **DB status frequently drifts from actual container/resource state.** The stop/start bug (#2), the
  limits-endpoint failure not being recorded (#16), and the workspace-cleanup job "succeeding" while doing
  nothing (#6) are three separate instances of the same underlying pattern: a side effect against the node
  or an external system fails or behaves unexpectedly, and the database is left claiming a state that no
  longer matches reality, with nothing to reconcile it later.

- **Two RBAC helpers (`ownedResourceWhere` vs `canAccessResource`) with subtly different inclusion rules
  are used interchangeably across ~14 route files** (#14) without either helper's doc comments flagging
  the divergence — worth a deliberate design decision (which is correct?) rather than leaving both in use.

- **Two independent "safety net" functions exist as dead code** (`failoverDeadNode`, `checkMetricAlerts`,
  #22) — written, seemingly tested in isolation, but never wired into any scheduler or route. Both would
  need additional fixes (not just wiring up) before they're production-ready if activated.

- **Non-Git deployment paths (zip, Docker image, Docker Compose) are consistently less protected than the
  Git path** across multiple dimensions simultaneously — subdomain safety, node selection (#12), and (per
  the earlier turns of this audit) generally receive less validation throughout `apps/api/src/routes/`.
  This suggests the Git-based flow was the original/primary path and the alternates were added later
  without a full pass to bring them up to the same bar.

---

## Files Reviewed

**`apps/api/src/lib/`** (all, in full): `alerts.ts`, `apiKeys.ts`, `backup.ts`, `billing.ts`,
`billingRules.ts`, `chatAdminSync.ts`, `cloudflare.ts`, `cloudflareDns.ts`, `containerExecGateway.ts`,
`currency.ts`, `customDomain.ts`, `deployPipeline.ts`, `discordWebhooks.ts`, `emailTemplates.ts`,
`firebaseAdmin.ts`, `invoicePdf.ts`, `leasewebClient.ts`, `livekit.ts`, `logger.ts`, `managedDbBackup.ts`,
`metrics.ts`, `nodeAgentClient.ts`, `nodeSelector.ts`, `notifications.ts`, `oauthProviders.ts`,
`orderFulfillment.ts`, `pagination.ts`, `paymentMatcher.ts`, `postal.ts`, `prisma.ts`,
`projectAuthService.ts`, `pushNotifications.ts`, `queue.ts`, `r2Storage.ts`, `secretsVault.ts`,
`seedProducts.ts`, `shadowBackup.ts`, `smsParser.ts`, `smsSignature.ts`, `smtpDispatcher.ts`,
`smtpProvisioner.ts`, `sshTerminalGateway.ts`, `subdomain.ts`, `uploads.ts`, `uptimeMonitor.ts`,
`webhooks.ts`

**`apps/api/src/` (root/other):** `env.ts`, `index.ts`, `worker.ts`, `middleware/rbac.ts`,
`middleware/auth.ts` (and other middleware files read alongside rbac), `jobs/workspace-cleanup.ts`

**`apps/api/src/routes/`** (read in full): `deployments.ts`, `cockpit.ts`, `sms.ts`, `payments.ts`,
`projects.ts`, `vps.ts`, `billing.ts`, `invoices.ts`, `apiKeys.ts`, `deployWebhooks.ts`,
`zipDeployments.ts`, `dockerDeployments.ts`, `containers.ts`, `gitConnect.ts`, `prWebhooks.ts`,
`secrets.ts`, `teams.ts`, `orders.ts` (partial — first ~230 lines), `internalBot.ts`
**`apps/api/src/routes/`** (spot-checked / partial): `nodes.ts`, `managedDatabases.ts`

**`services/node-agent/src/`** (all, in full): `index.js`, `build.js`, `docker.js`, `filesystem.js`,
`cockpit.js`, `customDomain.js`, `livekit.js`, `managedDb.js`, `projects.js`, `repo.js`, `stats.js`

**`services/whatsapp-bot/src/`** (partial): `commandHandler.js`

**`packages/db/prisma/schema.prisma`** (spot-checked for constraints and field semantics, not read as a
full data-model review)

**Excluded from scope (vendored/third-party, per instructions):** `packages/auth-js`,
`packages/postgrest-js`, `packages/realtime-js`, `packages/functions-js`, `packages/storage-js`,
`packages/supabase-js` — confirmed to be structural forks of the real Supabase JS SDK monorepo.

**Not yet reviewed (see Scope note above for the full list):** remaining `apps/api/src/routes/` files;
`packages/{catalog,client,deployments,node-agent,types,tracing}`; `services/discord-bot`;
`apps/dashboard`, `apps/web`, `apps/mobile-admin` (all frontend code); `infra/`; `templates/`; `config/`;
`docker/`; `firebase/`; `components/`; `tests/`.