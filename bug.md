# Codebase Bug Audit Report — Part 2 (Previously Unreviewed Route Files)

This is a **separate, standalone report** covering exactly the files that `BUG_AUDIT.md` (Part 1) listed
as "Not yet reviewed" under `apps/api/src/routes/`, plus the two files that were only partially read last
time (`domains.ts`, `orders.ts`), now completed in full. It does not duplicate anything already reported
in Part 1 — read both files together for the full picture of `apps/api/src/routes/`.

## Scope of this report

**Read in full this pass (24 files):** `admin.ts`, `aiSubscription.ts`, `analytics.ts`, `backup.ts`,
`cms.ts`, `discordWebhookConfig.ts`, `domains.ts` (now complete), `filesystem.ts`, `health.ts`,
`knowledgebase.ts`, `me.ts`, `metrics.ts`, `openapi.ts`, `orders.ts` (now complete), `projectAuth.ts`,
`pushTokens.ts`, `services.ts`, `settings.ts`, `status.ts`, `templates.ts`, `tickets.ts`,
`traefikStatus.ts`, `vps-plans.ts`, `webhooks.ts` (route file, distinct from `lib/webhooks.ts`)

Also read in full to verify a finding: `apps/api/src/lib/domain/manager.ts`, `apps/api/src/lib/domain/cname.ts`,
`apps/api/src/lib/oauthProviders.ts`, and confirmed `apps/api/src/worker.ts` correctly schedules the
SSL-renewal job that `domain/manager.ts` exposes.

This now completes the full read of every file in `apps/api/src/routes/`. Still not reviewed anywhere in
this repo: `packages/{catalog,client,deployments,node-agent,types,tracing}`; `services/discord-bot/src/client.js`
and `index.js`; all three frontend apps in depth; `infra/`; `templates/`; `config/`; `docker/`; `firebase/`;
`components/`; `tests/`.

## Summary

- **Confirmed bugs this pass:** 4
- **Severity breakdown:** 1 Critical · 1 High · 2 Medium

Most of the 24 files in this batch were small, well-scoped, and clean — `health.ts`, `templates.ts`,
`webhooks.ts`, `services.ts`, `backup.ts`, `analytics.ts`, `discordWebhookConfig.ts`, `me.ts`,
`pushTokens.ts`, `cms.ts`, `metrics.ts`, `knowledgebase.ts`, `openapi.ts`, `vps-plans.ts`, `settings.ts`,
`tickets.ts`, `traefikStatus.ts`, and `filesystem.ts` had no confirmed issues worth reporting — ownership
checks were consistently applied via the same `canAccessResource`/`verifyResourceOwnershipAsync` helpers
seen throughout Part 1, and the SSL-renewal automation in `lib/domain/manager.ts` (which looked suspiciously
like the earlier dead-code pattern) turned out to be correctly wired into `worker.ts`'s scheduler.

The four real findings below are concentrated in `projectAuth.ts`, `admin.ts`, and `status.ts`.

---

## Critical Issues

### 1. Project-auth OAuth and magic-link flows use an unvalidated, attacker-controlled `redirectUrl` — open redirect that leaks authentication tokens
- **File:** `apps/api/src/routes/projectAuth.ts` — `GET /projects/:id/auth/oauth/:provider/start` (~lines 145-169), `GET /projects/:id/auth/oauth/:provider/callback` (~lines 171-252), `POST /projects/:id/auth/magic-link` (~lines 71-105)
- **Category:** Security — open redirect / token theft / account takeover
- **Description:**
  - The OAuth-start route reads `redirectUrl` straight from the query string with only
    `typeof req.query.redirectUrl === 'string'` validation — no allowlist, no check that it matches the
    project's own registered domain. It's stored in the in-memory `oauthStates` map keyed by a `state`
    value and used verbatim later.
  - On successful OAuth exchange, the callback does:
    ```js
    const jwtToken = signProjectAuthToken({ sub: authUser.id, projectId: req.params.id, email: authUser.email });
    const finalUrl = new URL(stateEntry.redirectUrl);
    finalUrl.searchParams.set('token', jwtToken);
    res.redirect(finalUrl.toString());
    ```
    redirecting the browser to that same attacker-supplied URL, with a freshly signed, fully valid
    project-auth JWT attached as a query parameter.
  - The magic-link route has the identical shape: `redirectUrl` is only validated as `z.string().url()`
    (any well-formed URL, any domain), and the single-use magic-link token is appended to it and emailed
    to the target address.
- **Why it's a bug:** An attacker can craft a link like
  `.../auth/oauth/google/start?redirectUrl=https://attacker.example/collect` (or the magic-link
  equivalent), send it to a victim who is a legitimate end-user of some project hosted on this platform,
  have them complete a real, legitimate OAuth login (or click what looks like a normal magic-link email),
  and the resulting authentication material — a signed JWT good enough to authenticate as that user via
  `GET /projects/:id/auth/me`, or a magic-link token redeemable for one via `/magic-link/verify` — is
  delivered straight to the attacker's own domain. This is a full account-takeover primitive for any
  project's end-users, not a cosmetic redirect issue, since the credential itself (not just a session
  cookie) ends up in the attacker's hands.
- **Suggested fix:** Require `redirectUrl` to match a pre-registered allowlist per project (the natural
  home for this is alongside `ProjectOAuthConfig.redirectUri`, which already exists in the schema);
  reject anything else with a 400 before generating state or tokens.

---

## High Priority Issues

### 2. OAuth login doesn't check the provider's email-verified flag — possible account takeover via email confusion
- **File:** `apps/api/src/lib/oauthProviders.ts` (`extractProfile` per provider), consumed by `apps/api/src/routes/projectAuth.ts`'s OAuth callback (`findOrCreateVerifiedUser(projectId, email)` — the function's own name implies the email is trusted as verified)
- **Category:** Security — authentication logic gap
- **Description:** Google's `extractProfile` takes `p.email` directly with no check of Google's own
  `email_verified` field in the same profile payload. Discord's `extractProfile` similarly takes the
  profile email with no verified-flag check evident in this file. GitHub's path is only partially
  mitigated: if the primary `/user` response already includes a public email, that's used unconditionally;
  only when it's absent does the code fall back to `/user/emails` and correctly filter for
  `e.primary && e.verified`.
- **Why it's a bug:** `findOrCreateVerifiedUser` marks the resulting `ProjectAuthUser.emailVerified = true`
  based on nothing more than "an OAuth provider handed back this email string," without confirming the
  provider itself considers that email verified/owned by the authenticating account. An attacker who
  controls an OAuth account with an unverified or spoofable email matching a real end-user's address could
  sign in and be treated by the project as that verified user — a real risk for any project that also
  supports password-based login or account merging by email.
- **Severity note:** Flagged High rather than Critical because exploitability depends on each provider's
  specific behavior around exposing unverified emails in profile responses, and needs live verification
  against real provider responses rather than just the code path.
- **Suggested fix:** Check `email_verified`/`verified` (or equivalent) from every provider before trusting
  the email, and refuse to auto-verify (or refuse to log in) when the provider doesn't assert it.

---

## Medium Priority Issues

### 3. `POST /admin/users` lets a plain `admin` (not just `dev`) create a new user with `role: 'dev'`, bypassing the platform's own dev-role protection policy
- **File:** `apps/api/src/routes/admin.ts` (router-level `requireAuth, requireAdmin`; `POST /admin/users`, ~lines 52-84)
- **Category:** Authorization-policy gap
- **Description:** `requireAdmin` (in `middleware/auth.ts`) accepts both `admin` and `dev` roles.
  `createUserSchema` allows `role: z.enum(['customer','support','dev','admin'])` with no restriction tied
  to the caller's own role. Compare with the sibling `PATCH /admin/staff/:userId/role` in the same file,
  which explicitly blocks a plain admin from promoting/demoting anyone to/from `dev`
  ("Only the platform dev account can change another dev user's role") — `POST /admin/users` has no
  equivalent check, so a regular `admin` can create a brand-new row with `role: 'dev'` directly.
- **Mitigating factor (confirmed by reading `middleware/auth.ts`):** the created row gets a synthetic
  `firebaseUid: manual_${Date.now()}_${Math.random()...}` with no real Firebase account behind it, and
  `requireAuth`'s login upsert matches strictly by `firebaseUid` (not email), so nobody can actually sign
  in as this row through the normal auth flow today, and `POST /api-keys` only ever creates keys for the
  caller's own `req.user!.id` — there is no live path for the creating admin (or anyone) to actually
  exercise dev privileges through this phantom account right now.
- **Why it's still a bug:** it's a real policy-enforcement gap — the intended protection exists on one
  endpoint and is simply missing on another that reaches the same end state — and the resulting row isn't
  fully inert: it appears in `GET /admin/staff`/`GET /admin/all-users` listings as a real `dev`-role
  account, which could confuse staff, get picked from a dropdown expecting a genuine team member, or
  become an active escalation path with zero further code change needed if account-linking-by-email is
  ever added to the auth flow later (a common, easy-to-imagine feature addition).
- **Suggested fix:** In `POST /admin/users`, restrict `role: 'dev'` to callers who are themselves `dev`,
  mirroring the check already present in the role-change endpoint.

### 4. `GET /deployments/:id/uptime` excludes the `dev` role from staff-level access (only checks `admin`)
- **File:** `apps/api/src/routes/status.ts` (~lines 95-100)
- **Category:** Logic inconsistency / access-control bug
- **Description:**
  ```js
  if (req.user!.role !== 'admin' && deployment.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Not found' });
  }
  ```
  Every other staff-access check in this codebase treats `dev` as at least as privileged as `admin`
  (the standard pattern elsewhere is `role !== 'admin' && role !== 'dev'`). Here, only `'admin'` is
  exempted from the ownership check.
- **Why it's a bug:** a `dev`-role user — the platform's own highest-privilege/owner role — gets a 404
  "Not found" when checking uptime history for any deployment they don't personally own. Almost certainly
  just a missed `role !== 'dev'` clause, not an intentional restriction.
- **Severity note:** kept at Medium rather than lower because it's a genuine, confirmed correctness bug in
  an access-control check, even though the practical impact is limited to the platform's own trusted
  internal role rather than exposure to outside actors.
- **Suggested fix:** `if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && deployment.userId !== req.user!.id)`.

---

## Files Reviewed (this report only)

`apps/api/src/routes/admin.ts`, `aiSubscription.ts`, `analytics.ts`, `backup.ts`, `cms.ts`,
`discordWebhookConfig.ts`, `domains.ts`, `filesystem.ts`, `health.ts`, `knowledgebase.ts`, `me.ts`,
`metrics.ts`, `openapi.ts`, `orders.ts`, `projectAuth.ts`, `pushTokens.ts`, `services.ts`, `settings.ts`,
`status.ts`, `templates.ts`, `tickets.ts`, `traefikStatus.ts`, `vps-plans.ts`, `webhooks.ts` (route file) —
24 files, all read in full.

Plus, to verify findings: `apps/api/src/lib/domain/manager.ts`, `apps/api/src/lib/domain/cname.ts`,
`apps/api/src/lib/oauthProviders.ts`, `apps/api/src/worker.ts` (spot-checked for SSL-renewal scheduling).

**Combined with Part 1, every file in `apps/api/src/routes/` has now been read in full.**

**Still not reviewed anywhere in this repo:** `packages/{catalog,client,deployments,node-agent,types,
tracing}`; `services/discord-bot/src/client.js` and `index.js`; `apps/dashboard`, `apps/web`,
`apps/mobile-admin` (frontend code); `infra/`; `templates/`; `config/`; `docker/`; `firebase/`;
`components/`; `tests/`.

# Codebase Bug Audit Report — Part 3 (Published SDK Packages, Discord Bot, Infra Spot Check)

A **separate, standalone report**, covering the areas Part 1/Part 2 listed as unreviewed:
`packages/{catalog,client,deployments,node-agent,types,tracing}`, the remainder of
`services/discord-bot/src/` (`client.js`, `index.js`), and a spot check of the root/`docker/`
docker-compose files and one catalog template. Read alongside Parts 1 and 2 for the full picture.

## Scope of this report

**Read in full:** every file under `packages/client/src/`, `packages/catalog/src/`,
`packages/deployments/src/`, `packages/node-agent/src/`, `packages/types/src/`,
`services/discord-bot/src/index.js` and `client.js`.

**Spot-checked:** `packages/tracing/src/parse.ts` and `validate.ts` (the two most bug-prone modules in that
package — dedicated test suite already exists for the rest, and these two came back clean);
`docker/docker-compose.shanutechx.yml`, `docker-compose.local.yml` (root), `templates/n8n.yaml`.

**Still not reviewed:** `packages/tracing/src/{extract.ts,defaults.ts}`; the remaining 8 catalog template
YAMLs (`grafana.yaml`, `hermes-agent.yaml`, `lavalink.yaml`, `livekit.yaml`, `mongodb.yaml`, `redis.yaml`,
`supabase-lite.yaml`, `uptime-kuma.yaml`, `wordpress.yaml`); `infra/control-plane/*`,
`infra/node-stack/*`, `infra/postal/postal.yml`, `infra/deploy.sh`, `infra/supabase/*`; `config/`;
`docker/supabase/*`, `docker/infisical/*`; `firebase/`; `components/`; all three frontend apps
(`apps/dashboard`, `apps/web`, `apps/mobile-admin`); `tests/`.

## Summary

- **Confirmed bugs this pass:** 6
- **Severity breakdown:** 1 Critical · 2 High · 3 Medium

The headline finding here is different in kind from most of Parts 1–2: it's not a bug in the platform
itself, but in the **published, installable SDK package** (`@shanutechx/client`, shipped via
`.github/workflows/publish-sdk.yml`) that external developers are meant to build against. Large parts of
that SDK call API routes that don't match the real backend at all.

---

## Critical Issues

### 1. Published `@shanutechx/client` SDK has extensive, systemic route-path drift from the real API — multiple entire resource classes are non-functional
- **File:** `packages/client/src/databases.ts`, `packages/client/src/nodes.ts`, `packages/client/src/monitoring.ts`, `packages/client/src/git.ts`
- **Category:** API contract mismatch (published package)
- **Description:** Unlike `deployments.ts` in the same SDK, which carries explicit "Audit finding H10" comments documenting a prior pass that fixed its routes to match the real API, these four files were evidently never given the same treatment (or have drifted again since):
  1. **`DatabasesResource` — every single method is broken.** All calls target `/api/databases...`, but the real API (`apps/api/src/routes/managedDatabases.ts`) mounts everything under `/api/managed-databases` — confirmed via `managedDatabasesRouter.post('/managed-databases', ...)` etc. `get(id)` and the `getConnectionString(id)` helper built on it are doubly broken: even with the right base path, there is no plain `GET /managed-databases/:id` route on the real API at all (only list, `.../reveal-password`, and `.../connection`). `list()`, `create()`, `delete()` all target the wrong base path.
  2. **`NodesResource` — 3 of 4 methods broken.** `get(id)` calls a `GET /api/nodes/${id}` route that doesn't exist (confirmed via grep — only list, `install.sh`, and `cluster-secret` exist at that level). `getStats(id)` calls it as a **GET**; the real route (`nodesRouter.post('/nodes/:id/stats', ...)`) is a **POST**. `getInstallScript()` calls `/api/nodes/install-script`; the real path is `/api/nodes/install.sh`.
  3. **`MonitoringResource` — the entire feature doesn't exist server-side.** `list()`/`get()`/`create()`/`delete()` all target `/api/monitoring[...]`. Grepping every route file in `apps/api/src/routes/` for `/monitoring` or `monitors` returns nothing. The Prisma schema has only `UptimeCheck` (the platform's own internal automatic per-deployment subdomain check), not a customer-configurable synthetic-monitor model. This SDK resource calls an API that was never built.
  4. **`GitResource.getGitHubAuthUrl()`/`getGitLabAuthUrl()`** build `.../connect/{provider}/authorize`; the real route (`apps/api/src/routes/gitConnect.ts`) is `.../connect/:provider/start`. The file's own explanatory comment ("the callback route was never implemented server-side") is also now stale — the real callbacks exist today at `/git/github/callback` and `/git/gitlab/callback`, just at different paths than the comment or the SDK's own URL-builder methods ever pointed to.
- **Why it's a bug:** unlike an internal-only defect, this is a **published package**. Any external developer following the SDK's own documented usage (`client.databases.list()`, `client.nodes.getStats(id)`, `client.monitoring.create(...)`, `client.git.getGitHubAuthUrl()`) gets a runtime 404/`ApiError` on the very first call, with nothing in the TypeScript types to warn them — the mismatch is purely in string-literal URL paths, invisible to the type system.
- **Suggested fix:** add a contract test that exercises every SDK method against a running instance of the real API (or generate the SDK's route table from the same source apps/api uses to register routes, so drift is caught at build time); fix each path/method listed above.

---

## High Priority Issues

### 2. Same customer-controlled-`nodeId` bypass (found in Part 1) also confirmed in the Catalog one-click template deploy route
- **File:** `apps/api/src/routes/catalog.ts` (`POST /catalog/deploy`, ~lines 550-560)
- **Category:** Missing validation / authorization-policy bypass
- **Description:** Any authenticated customer can supply an explicit `nodeId` in the request body, and as long as that node exists and `isActive: true`, it's honored directly (`prisma.node.findUnique`) with no ownership/role/tag check — the same `selectNodeForDeployment()` bypass documented in Part 1 for `zipDeployments.ts` and `dockerDeployments.ts`.
- **Why it's a bug:** this is now the fourth independent occurrence of the same gap (the Git-based `POST /deployments` path correctly enforces "customers can never choose a node"; zip upload, Docker image, Docker Compose, and now Catalog template deploy all don't) — strengthening the Part 1 architectural observation that this protection was written once against the original entry point and never factored out for reuse elsewhere.
- **Suggested fix:** same as Part 1 — route this `nodeId` resolution through `selectNodeForDeployment()`.

### 3. Published `@shanutechx/node-agent-client`'s stop/start/restart methods take a "deploymentId" but the real node-agent route expects a raw Docker container ID
- **File:** `packages/node-agent/src/index.ts` (`stopContainer`, `startContainer`, `restartContainer`, ~lines 72-84)
- **Category:** API contract mismatch (published package)
- **Description:** Package description (its own `package.json`): "Direct Node Agent client SDK for internal or advanced self-hosted integration" — a published package for external/advanced consumers (apps/api itself doesn't even use this package; it has its own hand-rolled `lib/nodeAgentClient.ts`). These methods build `/agent/deployments/${deploymentId}/{stop,start,restart}`. The real node-agent route (`services/node-agent/src/index.js`) is registered as `POST /agent/deployments/:containerId/stop` (and equivalent) — the path segment is a Docker **container ID**, not the platform's deployment ID.
- **Why it's a bug:** the method's own parameter name (`deploymentId`) actively tells a consumer to pass the wrong value — a caller following the method's own naming/signature and passing their platform deployment ID (the natural thing to have on hand) gets a 404, since only the actual Docker container ID resolves.
- **Suggested fix:** rename the parameter to `containerId` and update the docstring, or have the SDK resolve a deployment ID to its current container ID via a lookup first (matching how apps/api's own internal client does it).

---

## Medium Priority Issues

### 4. `LogWatcher`'s seen-lines `Set` grows unbounded (memory leak) and silently drops genuinely-repeated log lines
- **File:** `packages/deployments/src/LogWatcher.ts` (~lines 72-113)
- **Category:** Resource leak / correctness bug
- **Description:** `seenLogs = new Set<string>()` accumulates every unique log line ever observed for the lifetime of the watcher, with no cap, eviction, or expiry — for a utility explicitly designed for "watching container logs continuously" (i.e., long-running/indefinite use), a chatty app over a multi-day watch session will keep growing this `Set` forever. Separately, dedup is by exact string content, not by position/offset/timestamp — a legitimately-repeated message (e.g. a recurring heartbeat/retry log line) has its second real occurrence silently swallowed and never delivered to the consumer's `onLog` callback.
- **Why it's a bug:** unbounded memory growth in a published, presumably production-used utility, plus a correctness bug that hides real repeated log events rather than just deduping polling-window overlap.
- **Suggested fix:** bound `seenLogs` (e.g. a ring buffer of the last N line hashes, or track by cursor/offset returned from the API) instead of an ever-growing `Set`.

### 5. `DeploymentBuilder.deploy()` hard-requires `.onNode()`, but the real API silently ignores `nodeId` for every non-admin/dev caller
- **File:** `packages/deployments/src/DeploymentBuilder.ts` (`deploy()`, ~lines 74-83)
- **Category:** Usability/contract mismatch
- **Description:** `if (!this.config.nodeId) throw new Error(...'node ID is required (.onNode())')`. Per Part 1's confirmed finding on `apps/api/src/routes/deployments.ts`'s `POST /deployments`: `nodeId` is silently discarded server-side for any caller who isn't admin/dev-role — node placement is always auto-selected. The builder nonetheless makes `.onNode(...)` a hard client-side precondition for every consumer regardless of role.
- **Why it's a bug:** ordinary (non-staff) SDK users — the overwhelming majority of anyone using a published customer-facing SDK — are forced to supply a node ID that does nothing, with no way to know from the SDK's own types/errors that the requirement is meaningless for them. It also compounds Critical #1's `NodesResource.get()` bug: a customer trying to pick a real value to satisfy this requirement has no fully-working way to look up node details (only `list()` works).
- **Suggested fix:** make `.onNode()` optional in the builder (matching the API's actual behavior) and document that it only has an effect for admin/dev-authenticated clients.

### 6. Discord bot service and infra spot check — clean
- No new confirmed bugs. `services/discord-bot/src/index.js`/`client.js` are correctly implemented — internal-secret gating with a timing-safe HMAC comparison (same pattern as the WhatsApp bot), correct `0.0.0.0` binding (the file's own comment confirms a prior "Audit finding H3" localhost-binding bug was already fixed here), and clean error handling throughout. `docker-compose.local.yml` and `docker/docker-compose.shanutechx.yml` were spot-checked for service-name/hostname consistency (e.g. `DISCORD_BOT_URL=http://discord-bot:4200` correctly matches the `discord-bot` service key) and came back consistent. Listed here only so this pass's coverage is auditable, not as a bug.

---

## Files Reviewed (this report only)

`packages/client/src/{auth,base,catalog,databases,deployments,filesystem,git,index,monitoring,nodes}.ts`,
`packages/catalog/src/index.ts`, `packages/deployments/src/{DeploymentBuilder,EnvManager,LogWatcher,
WebhookHelper,index}.ts`, `packages/node-agent/src/index.ts`, `packages/types/src/{catalog,database,
deployment,errors,git,index,node,user}.ts`, `packages/tracing/src/{parse,validate}.ts` (spot check),
`services/discord-bot/src/{index,client}.js`, `docker/docker-compose.shanutechx.yml`,
`docker-compose.local.yml` (root), `templates/n8n.yaml`.

Also referenced to verify findings against the real API: `apps/api/src/routes/{managedDatabases,nodes,
gitConnect,catalog}.ts`, `services/node-agent/src/index.js` (route registrations), `packages/db/prisma/
schema.prisma` (Monitor/UptimeCheck model check).