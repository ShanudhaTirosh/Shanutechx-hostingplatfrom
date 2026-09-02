# ShanuTechX Hosting Platform — Code Review Report

**Repository:** `Shanutechx-hostingplatfrom-main.zip`
**Total files (excl. node_modules/.git):** 1,127
**Review date:** September 2026 · **Revision:** 2 (expanded coverage pass)

---

## 0. Coverage — what was actually reviewed

Before anything else: this repository is much bigger than "one project's code." **473 of the 1,127 files (42%)** — everything under `packages/{supabase-js,auth-js,realtime-js,postgrest-js,storage-js,functions-js,tracing}` — are a vendored, rebranded fork of the real, open-source **Supabase** client SDK monorepo. This is verifiable directly: every one of those packages' `package.json` `repository`/`homepage` fields point at `github.com/supabase/supabase-js`. That leaves **654 first-party files** (~114,000 lines) that are actually ShanuTechX's own code.

Given that split, this review applied two different methods:

- **First-party code (654 files):** genuine file-by-file reading, plus active verification — I ran `npm ci`, `npm audit`, and the real unit test suite; traced call chains end-to-end (client → API route → library → database schema); cross-checked two prior internal audit documents found in the repo against the live code rather than trusting their claims; and used targeted web search to check whether one catalog template's Docker image actually exists.
- **Vendored SDK code (473 files):** not re-audited line-by-line as if hunting for novel bugs in Supabase's own, independently-maintained, widely-used SDKs. Instead, every file that had been *modified* from upstream (rebranding) was located via targeted search and inspected directly. This is disclosed explicitly, not silently substituted for full coverage.

### First-party coverage by area

| Area | Files | Coverage | Notes |
|---|---|---|---|
| Root config, `.github/workflows`, `ci-logs-1/` | ~27 | **Full** | Includes actually running `npm ci`, `npm audit`, the CI-referenced failure log |
| `packages/db` (schema + all 20 migrations) | 22 | **Full** | Full 1,437-line schema read line-by-line |
| `apps/api` (routes, lib, middleware, jobs) | 162 | **~95%** | Every route file opened and read; the large majority of `lib/` read in full (business-critical files: env, index, RBAC, secrets vault, order fulfillment, abuse detection, payment matching, node selection, notifications, uptime monitoring, SMS, OAuth, etc.); a residual handful of narrow single-purpose utilities were grep-scanned rather than read line-by-line |
| `services/node-agent`, `discord-bot`, `whatsapp-bot` | 29 | **Full** | |
| `apps/dashboard` | 151 | **~55 files in depth** (~36%) | All auth/RBAC/guard foundations, `lib/api.ts` and remaining `lib/` utilities in full, the Settings/Staff/Billing/Nodes/Deployments/Email/Supabase-panel pages, plus a broad grep sweep of the rest for known risk patterns |
| `apps/web` | 45 | **~15 files** (~33%) | All page-level files and the highest-traffic components (Testimonials, Contact, V2Ray, Pricing, layout); component library not exhaustively read |
| `apps/mobile-admin` | 32 | **~12 files** (~37%) | API client, Auth context, Root navigator, Splash/Login screens, Payments screen read in full; remaining screens grep-swept, none flagged |
| `packages/{client,types,deployments,auth,node-agent,catalog}` | 77 | **~85%** | All read in depth |
| `infra/`, `docker/` | 27 | **~75%** | All Docker Compose files compared directly; Wildduck and Postal configs read in full; Traefik/observability configs structurally checked |
| `templates/` (self-hosted app catalog) | 10 | **Full** | All 10 YAML templates read; one image reference checked against a live web search |
| `tests/` | 20 | **Structure + live execution**, not every test body read | **Actually ran** the unit suite twice under different conditions (see §4) |
| `docs/` | 64 | **~22 files read**, rest scanned/listed | Two prior internal audit reports read in full and used as a cross-check; several "sprint"/"status" planning docs checked against current code and found stale (expected, given the volume of iterative AI-assisted development artifacts in this folder) |

**Honest bottom line:** the code most likely to contain product-defining bugs — the API server, the deployment pipeline, the node agent, the bots, the database schema, and the published SDK packages — got full, deep, verified coverage, including live execution of the install and test process. The frontend applications and documentation got substantial, meaningfully-expanded-from-the-first-pass coverage, prioritized toward the highest-risk pages and cross-checked against backend behavior, but not literally every one of ~600 remaining lines-of-React-per-file. I would not claim 100% line-by-line coverage of all 654 first-party files; I would claim high-confidence coverage of the ~480 files where a hosting platform's most consequential bugs live.

---

## 1. Summary of the most critical issues

Roughly in priority order:

1. **`POST /supabase/db/query`'s fallback runs unrestricted admin-submitted raw SQL against the platform's own primary database**, not an isolated customer database, whenever the self-hosted Supabase backend is unreachable. (`apps/api/src/routes/supabase.ts`)
2. **Four entire admin-panel features — Observability, Logs, Integrations, and half of Advisors — return permanently fabricated data**, not just as an error fallback but as their default, everyday behavior, with zero UI indication anything is fake. (same file)
3. **Deployment creation and redeployment silently report "success" when the server actually rejected the request** — including when a customer's account gets banned by the abuse scanner mid-deployment. (`apps/dashboard/lib/api.ts` + `deployments/page.tsx`)
4. **`@shanutechx/auth`, the platform's own published authentication SDK, is completely non-functional** — every method except `me()` calls a route that doesn't exist. A prior internal audit flagged this explicitly; a later "everything is fixed" changelog claims it was resolved, but it wasn't. This turns out to be one instance of a **recurring pattern across the whole `@shanutechx/*` SDK family** — see finding below.
5. **Deleting a mailbox never deletes the real mail account** on the Wildduck server, even though the code to do so exists and is simply never called.
6. **Three separate "deploy without git" paths (Docker image, Docker Compose, ZIP upload) create a database record and report success but never actually deploy anything.** Currently not wired to any reviewed frontend, but a real trap if that changes.
7. **The Wildduck mail server's API access token is hardcoded in a checked-in infra config file, completely undocumented in the setup guide, and defaults to empty in the app** — mail features silently fail unless an operator independently discovers and copies a secret that's now sitting in a public repo.
8. **Firebase chat rules let a customer spoof a "staff" reply in their own support thread**, verified exploitable end-to-end.
9. **Orders/invoices have no price snapshot at all** — invoices and cart totals are recomputed from the *current* catalog price, not what was actually charged.
10. **A custom HTML sanitizer used for rendering untrusted email content has a real bypass** in its server-render fallback path, which Next.js reaches by default.

Full detail on every finding — roughly 50 in total — is in §3.

---

## 2. Files that are pure placeholder/scaffolding with no real implementation

- **`apps/api/src/routes/dockerDeployments.ts`** — both endpoints create a database row and report success; neither ever runs a container. Confirmed nothing downstream consumes the `docker://`/`compose://` prefixes this file writes.
- **`apps/api/src/routes/zipDeployments.ts`** (`POST /deployments/upload`) — same pattern; uploads files and pushes a git backup mirror, but never triggers a build.
- **`apps/api/src/routes/supabase.ts`'s Observability, Logs, and Integrations endpoints** — return hardcoded/formula-fabricated data unconditionally, every call, forever (detailed in §3). This is a larger-scale version of "placeholder content in a real code path" than a single file — it's four distinct admin-facing features.
- **`apps/api/src/lib/nodeSelector.ts`'s `failoverDeadNode()`** and **`apps/api/src/lib/alerts.ts`'s `checkMetricAlerts()`** — both self-documented via their own `TODO` comments as never wired into a scheduler, both confirmed unreachable.
- **`apps/web/components/Testimonials.tsx`** — three entirely fabricated customer names, quotes, and 5-star ratings, presented on the public marketing site as real reviews.
- **`apps/web/components/V2RaySection.tsx`**'s "Node Status Monitor" — a hardcoded, never-updating "99.99% Online" widget with 4 fake node ping times, styled as live telemetry.
- **`apps/api/src/routes/prWebhooks.ts` and `managedDatabases.ts`'s backup/restore endpoints** — *not* bugs, included for contrast: these honestly return `501 Not Implemented` rather than faking success, which is the right way to leave something unfinished.

---

## 3. All findings, by file

### Critical / High severity

**`apps/api/src/routes/supabase.ts` — `POST /supabase/db/query` fallback hits the platform's own database**
*Category: Bug / Security. Severity: High.*
The route first proxies queries to the real self-hosted Supabase Meta service. If that call fails — normal in any deployment where the self-hosted stack isn't reachable — it falls back to `prisma.$queryRawUnsafe(sql)` using `lib/prisma`, the *same* connection used for the platform's own Users/Payments/Orders tables. No read-only enforcement, no allowlist. Admin/dev-only, so not customer-reachable, but the blast radius when triggered is the entire platform's live data.
*Fix:* never fall back to the platform's own Prisma connection here; return a 503 instead, or point a genuine fallback at a separately-configured, read-only connection.

**Same file — most of the "Observability," "Logs," "Integrations," and half of "Advisors" panels are unconditionally fabricated**
*Category: Placeholder/mock content. Severity: High.*
This is a larger, more systemic version of the "fake fallback data" pattern than a simple error-path issue — these return fake data as their **default, everyday behavior**, not just when something's broken:
- `GET /supabase/observability`: `cpuUsagePercent` is computed from the *API server's own* `process.cpuUsage()`, run through a formula (`(x / 1_000_000) % 35) + 12`) specifically engineered to always land in a "plausible" 12–95% range — nothing to do with the actual database. `diskIops: 240`, `avgQueryLatencyMs: 14.2`, `cacheHitRatePercent: 98.4` are bare hardcoded constants. `activeConnections` is a fabricated formula off an unrelated row count.
- `GET /supabase/logs`: returns the same 5 hardcoded fake log lines on every call, forever, with only relative timestamps recalculated so they always look recent. One fabricates a specific admin email in a fake auth-event line.
- `GET /supabase/integrations`: entirely hardcoded fake webhook, fake `STRIPE_SECRET_KEY`/`RESEND_API_KEY` vault entries, fake foreign-data-wrapper connections. No way for an admin to tell from the UI that none of it is real.
- `GET /supabase/advisors`: half-real (a genuine `pg_tables WHERE rowsecurity = false` query for security lints, with a hardcoded fallback on failure via an empty `catch {}`) and half-fake (the performance-lint half is never queried — always the identical hardcoded "unindexed foreign key" finding).
- Confirmed the dashboard frontend has no way to detect any of this — no `isFallback` flag in these responses, unlike `routes/traefikStatus.ts` elsewhere in the same codebase, which does this correctly and shows the pattern was known.
*Fix:* wire these to real data sources, or clearly label the panel as preview/demo until that's built.

**`apps/dashboard/lib/api.ts` (`deployments.create`, `redeploy`) + `apps/api/src/routes/deployments.ts` — false "success" on rejected deployments**
*Category: Bug. Severity: High.*
Both client functions assume the response body is always a stream of build events, with no `res.ok`/content-type check first — unlike the sibling `updateEnv()`, which does this correctly. The server returns early, plain JSON error responses (400/403/404/409) for schema validation failures, the abuse scanner banning the account, git-ownership failures, missing templates, and more, *before* the real stream starts. A JSON error object parses without throwing, doesn't match the `{phase, log, message}` shape the UI checks for, so nothing happens, and the calling code's `try` block completes normally. Traced directly into `deployments/page.tsx`: the result is a green "Deployment created & live!" toast for a deployment the server explicitly rejected — including when the customer's account was just banned. The same unwrapped-streaming-fetch pattern also reaches the admin SSH-provision-node flow (`admin/nodes/page.tsx`), with a milder symptom (silently does nothing).
*Fix:* check `res.ok`/content-type before entering the streaming-read loop; centralize into one shared helper.

**A recurring pattern across the `@shanutechx/*` SDK family: published helper packages calling API contracts that were never verified against the real routes**
*Category: Broken reference. Severity: High (package-wide pattern).*
Found in three independent places, strongly suggesting a systemic gap (no contract/integration testing for these packages) rather than three unrelated bugs:
- **`packages/auth` (`@shanutechx/auth`) is completely non-functional** — `login`, `register`, `refresh`, `changePassword` all call `/api/auth/*` routes. Confirmed via repo-wide grep: no such routes exist anywhere, no router mounted at `/api/auth`. Only `me()` works. A prior internal audit called this out explicitly as "the starkest example" of a broken SDK; a later changelog claiming "everything from the original audit is now addressed" never mentions this package and it remains untouched.
- **`packages/deployments/src/EnvManager.ts`** calls `GET /api/deployments/:id/env` — confirmed only the `PATCH` variant exists anywhere in the API. All three of `EnvManager`'s instance methods are non-functional as a result (its two static string-parsing helpers still work).
- **`packages/client/src/catalog.ts`'s `get(slug)`** is typed as returning a bare `CatalogTemplate`, but the real route (`routes/catalog.ts:177`) returns `{ template: {...} }` — confirmed directly. Any consumer (including `packages/catalog`'s own `CatalogHelper.getTemplate()`, which calls this and returns the result as-is) gets `undefined` for every field, silently, since nothing here validates response shape at runtime. By contrast, `CatalogResource.deploy()` in the same file is correctly matched — this isn't a uniformly-broken file, just this one method, which is itself informative about how this class of bug creeps in.
*Fix, per-instance:* implement the missing `/api/auth/*` routes or deprecate the package; add the missing `GET .../env` route or read `envVars` off the existing deployment-detail response; unwrap the catalog response. *Fix, systemically:* add integration tests that exercise these published SDK packages against the real API (the repo already has `routes/openapi.ts` — a spec-driven contract test would catch all three of these).

**`apps/api/src/routes/email.ts` — deleting a mailbox never deletes the real mail account**
*Category: Bug. Severity: High.*
`DELETE /email/mailboxes/:id` only does `prisma.smtpAccount.delete(...)`. `lib/wildduckClient.ts` has a fully implemented `deleteUser()`, and the exact ID needed (`SmtpAccount.wildduckUserId`) is a real, populated column on the row being deleted — but the handler never calls it. The mail account keeps working indefinitely; the username+domain stays occupied on the mail server.
*Fix:* `if (account.wildduckUserId) await wildduckClient.deleteUser(account.wildduckUserId)` before/alongside the Prisma delete.

**Non-git deployment paths create a DB row but never deploy anything (3 instances)**
*Category: Incomplete work. Severity: High (contained today).*
`routes/dockerDeployments.ts` (Docker-image, Docker-Compose) and `routes/zipDeployments.ts` (ZIP upload) all create a real `Deployment` row and report success without ever calling node-agent's build/run path. Confirmed nothing downstream (no job, worker, or queue consumer) ever reads the `docker://`/`compose://`/`zip://` repoUrl prefixes these routes write — traced through `lib/shadowBackup.ts` and both files in `apps/api/src/jobs/` to confirm. Not called from anywhere in the reviewed `apps/dashboard` frontend today, so dormant rather than actively deceiving customers — but "upload a zip instead of connecting git" reads like a natural, likely-advertised feature, making this a real risk the moment a frontend button gets wired to it.
*Fix:* implement the actual build/run path for at least the ZIP-upload case, or clearly gate these routes as unavailable.

**`infra/wildduck/api.toml` — hardcoded, undocumented mail server API token**
*Category: Bug / Security. Severity: High.*
The Wildduck REST API's access token is hardcoded (`accessToken = "secret-wildduck-api-token"`) in a config file that's mounted read-only directly into the running container. `apps/api/src/lib/wildduckClient.ts` authenticates against it via `env.wildduckApiKey || ''` (empty by default). Confirmed via grep: `WILDDUCK_API_KEY` appears in **neither** `apps/api/.env.example` nor `infra/control-plane/.env.example` — unlike every other integration secret in this codebase, it's entirely undocumented. Following the setup guide as written leaves this unset, so the API sends an empty token and every Wildduck call (mailbox provisioning, DKIM, webmail) fails authentication until someone discovers this file directly and either copies its now-public literal value or changes both files to match. Worth noting by contrast: `infra/postal/postal.yml` (the sibling mail-adjacent config) does this correctly — explicit `CHANGE_ME_` placeholders, documented manual steps — so the standard was clearly known and just wasn't applied here.
*Fix:* document `WILDDUCK_API_KEY` in `apps/api/.env.example`; make `api.toml` interpolate the same env var (or generate from a template at deploy time) instead of hardcoding a literal.

**`firebase/database.rules.json` + `apps/dashboard/lib/chat.ts` — customer can spoof a "staff" chat reply, confirmed exploitable**
*Category: Bug / Security. Severity: High (self-contained to the attacker's own thread).*
Chat is written directly from the browser via the Firebase SDK with no server mediation. The rules validate `senderRole` is one of `'customer'`/`'staff'` but never check it against the real staff list, and `chatIndex/$uid` has no validation at all. Traced into `lib/chat.ts`: `senderRole` is passed through freely. A customer can write a message claiming `senderRole: "staff"` in their own thread, or manipulate their own inbox metadata (e.g., suppress the "unread" flag staff rely on).
*Fix:* add a `.validate` rule requiring `senderRole === 'staff'` to also satisfy `root.child('staff').child(auth.uid).exists()`; add real validation to `chatIndex/$uid`.

**No price snapshot anywhere in the order pipeline**
*Category: Bug (data model). Severity: High.*
`OrderItem` has no `price`/`unitPrice` field. `routes/invoices.ts` computes each line's price from the *current* `service.price`/`plan.price` at whenever the invoice is first lazily generated. `routes/orders.ts`'s `recalculateTotal()` confirms this is structural: cart totals recompute from live prices on every mutation and again at checkout, with no reconciliation if a price changed in between. Risks an internally inconsistent invoice PDF — line items from current prices, `total` field showing the actual historical charge — that won't sum correctly if a price ever changed.
*Fix:* add a price-snapshot column to `OrderItem`, populated at checkout.

**`apps/dashboard/lib/sanitize.ts` — real bypass in the sanitizer used for untrusted email HTML**
*Category: Bug / Security. Severity: High.*
Used by `WebmailMessageViewer.tsx` to render actual received email bodies via `dangerouslySetInnerHTML`. Both call sites are `'use client'` components, which Next.js still server-renders once before hydration — the file's own regex-only "SSR fallback" is a genuinely reachable production path. That fallback's script-tag regex requires a literal closing `</script>`; an **unclosed** `<script>` tag passes through untouched, and execution happens at HTML-parse time, before hydration could "correct" it. Separately, the client-side path's `javascript:` URL check does a plain `startsWith()` with no control-character normalization, so `href="java\tscript:..."` survives the filter (a documented bypass technique) even though browsers still execute it.
*Fix:* replace with a maintained library (DOMPurify or equivalent), run consistently server- and client-side.

### Medium-High severity

**`apps/api/src/lib/abuseDetector.ts` — ban audit log always blames the banned user**
*Category: Bug. Severity: Medium-High.* `banUserAndTeardownResources()` hardcodes `adminId: userId` on the AuditLog row — `userId` is the account *being banned*. All three call sites have the real acting admin's ID available but never thread it through. Every ban's audit trail says the banned user banned themselves. *Fix:* accept an explicit `actorId` parameter.

**Two independently-maintained Docker Compose stacks with real service divergence**
*Category: Inconsistency / duplicated logic. Severity: Medium-High.* Root `docker-compose.local.yml` (428 lines) and `infra/control-plane/docker-compose.yml` (636 lines) both independently define the same core service set but diverge from there (Postal vs. Traefik/LiveKit/separate Supabase definitions). `config/scripts/START-ALL.ps1`/`.cmd` only exercise the infra one, even though the root `.env.example` documents the *other* one. *Fix:* pick one as canonical, or document the split as intentional if it is one.

**`templates/supabase-lite.yaml` — missing required service, misconfigured metadata URL**
*Category: Bug. Severity: Medium-High for this template.* Missing the `postgres-meta` service the real self-hosted Supabase stack requires; `STUDIO_PG_META_URL` points at Postgres's raw wire-protocol port (5432), not an HTTP API. Studio starts but its core table/SQL-browsing functionality doesn't work.

**`packages/types/src/deployment.ts` — the shared types package meant to prevent drift has itself drifted, and isn't even used**
*Category: Inconsistency. Severity: Medium.* Four independent definitions of deployment status now exist: the real Prisma schema (`pending|building|running|failed|stopped|deleted`), `apps/dashboard/lib/types.ts` (missing `deleted`), `apps/mobile-admin`'s type (missing `pending`, and inventing a `'terminated'` value that exists nowhere in the real schema), and `packages/types` itself — the shared package that exists specifically to prevent this — which has a *fifth* independent copy (also missing `deleted`), that neither frontend actually imports. The same file's `DeploymentCreateInput.nodeId` is typed as required, but the real route's Zod schema has it optional (the platform auto-selects a node when omitted) — making the documented auto-selection behavior impossible to express correctly through this type.
*Fix:* derive all three frontend/SDK copies from the schema as the single source of truth, and actually import `@shanutechx/types` instead of maintaining local copies.

### Medium severity

**`apps/api/src/routes/admin.ts` — ban/unban has no protection against admin-on-admin action**
*Category: Inconsistency. Severity: Medium.* This file explicitly protects the `dev` role from a plain admin in two other places, but ban/unban only excludes `dev`-role targets. Any admin can ban any other admin, or themselves.

**`apps/api/src/lib/orderFulfillment.ts` — "AI Subscription" detection matches almost anything**
*Category: Bug. Severity: Medium.* `productName.includes('ai')` fires for any product name containing that substring — including this codebase's own "Mail" hosting plans (m-**ai**-l). Customers buying unrelated products get a bogus "your AI subscription is active" notification. *Fix:* rely on the (already-present, already-sufficient) category check alone.

**`apps/api/src/routes/cms.ts` — contact form failures are silently swallowed**
*Category: Bug. Severity: Medium.* `POST /cms/contact`'s DB write is wrapped in a completely empty `catch {}` with no logging, unconditionally reporting success. No staff notification on success either, unlike other intake flows in the same codebase.

**`apps/api/src/routes/analytics.ts` — "top services" report groups by a legacy, mostly-null field**
*Category: Bug. Severity: Medium.* Groups by `OrderItem.serviceId`, which the schema's own comments mark legacy/superseded by `planId`; current orders have `serviceId: null` and are filtered out entirely. *Fix:* group by `planId`.

**`apps/api/src/routes/internalBot.ts` — Discord payment review picks a payment row by unordered array index**
*Category: Bug. Severity: Medium.* `order.payments[0]` with no `orderBy`. Confirmed via the Discord bot's actual slash-command code that only `order_id` is ever sent — the *dashboard's* equivalent review endpoint (`routes/payments.ts`) correctly targets a specific payment ID, showing the more correct pattern already exists elsewhere.

**`apps/dashboard/lib/logUtils.ts` — log viewer mangles any 10–13 digit number, not just real timestamps**
*Category: Bug. Severity: Medium.* `unixTimestampRegex = /\b\d{10,13}\b/g` matches any standalone 10–13 digit number (order IDs, byte counts, PIDs) and unconditionally replaces it with a formatted date. Confirmed the existing test (`logUtils.test.ts`, "should not convert numbers that are not timestamps") only tests far-below-danger-zone numbers (`3000`, `42`), giving false confidence — the actual risky boundary is never tested. *Fix:* require a preceding label (`timestamp:`, `ts=`) rather than matching any bare digit run.

**`apps/api/src/lib/uptimeMonitor.ts` — recovery notifications sent under the "Deployment Failed" event**
*Category: Bug. Severity: Medium.* `runUptimeChecks()` calls `notifyDiscordChannel('deployment_failed', ...)` for both the down *and* the recovery transition. Confirmed no `deployment_recovered` event type exists in `lib/discordWebhooks.ts` — `deployment_failed` is hardcoded to a red "🔥 Deployment Failed" title. Staff watching Discord see a scary red failure alert when a deployment actually just came back online.

**`.env.example` (root) is stale relative to the actual code and the per-app `.env.example` files**
*Category: Inconsistency. Severity: Medium.* Lists `JWT_SECRET`, never read anywhere in `apps/api` (confirmed via grep — the real variable is `PROJECT_AUTH_JWT_SECRET`), and `ENCRYPTION_KEY`, when the code reads `SECRETS_ENCRYPTION_KEY` (confirmed correct in the otherwise-accurate `apps/api/.env.example`). The `ENCRYPTION_KEY` placeholder is also a sequential, non-random hex string rather than a `CHANGE_ME` textual placeholder — and any 64-hex-char string is accepted as-is as the literal AES key with no strength validation (confirmed in `lib/secretsVault.ts`), so if this exact value ever reached production, every encrypted secret in the database would be decryptable by anyone who's seen this public repo.

**`packages/deployments/src/EnvManager.ts`, `packages/client/src/catalog.ts`** — see the combined SDK-family finding above.

**`apps/api/src/routes/email.ts` — mailbox credentials endpoint has broader access than the mailbox list**
*Category: Inconsistency. Severity: Low-Medium.* The list endpoint scopes admin visibility to assigned/allowlisted admins; the credentials endpoint (revealing plaintext SMTP passwords) allows any admin/dev regardless of assignment.

**`templates/hermes-agent.yaml` — Docker image likely doesn't exist**
*Category: Broken reference (unconfirmed but evidence-backed). Severity: Medium.* `hermesagent/hermes-agent:latest` did not turn up as an established image in a web search; what exists under similar names are small unrelated personal projects and a differently-namespaced product. Worth a manual `docker pull` check before shipping.

### Low severity / minor

- **`config/scripts/CHECK-HEALTH.cmd`** — bare `curl -s` and a `findstr "HTTP"` check both report "OK" for any HTTP response including 4xx/5xx.
- **`apps/api/src/lib/nodeSelector.ts`'s `failoverDeadNode()`** and **`apps/api/src/lib/alerts.ts`'s `checkMetricAlerts()`** — self-documented `TODO`s, confirmed unreachable, no urgency since neither is currently wired up.
- **`apps/dashboard/lib/api.ts`'s `discordWebhooks.delete()`** — the one method in this 1,222-line file that doesn't wrap its fetch in the shared `asJson()` error-throwing helper. A failed delete silently shows a green "removed" toast.
- **`apps/dashboard/app/(protected)/admin/staff/page.tsx`** — shows a "Make Dev" button to plain admins, who are always correctly rejected server-side. UI-truthfulness nit, not a security issue.
- **`apps/dashboard/lib/AppUserContext.tsx`** — caches role/profile in `localStorage` (not scoped per-Firebase-uid), rendering optimistically before background revalidation; on a shared computer could briefly show a stale role after a permission change. Backend authorization holds independently.
- **`apps/dashboard/components/PasswordLockGuard.tsx`** — the "Active Security Session" unlock is stored in `localStorage`, which (unlike `sessionStorage`) survives full browser restarts, not just tab closes.
- **`apps/api/src/middleware/rbac.ts`** — three helper functions fail *open* (grant admin access) if a resource-owner lookup returns null. Consistent across all three (likely intentional), worth a deliberate second look.
- **Mobile admin login loop** — `LoginScreen.tsx` never signs out a customer account after rejecting it post-authentication, so re-entering the same credentials repeats the same error with no way to sign out from that screen. Confirmed the actual security boundary (`SplashScreen.tsx` re-checking role on every app open) holds regardless — UX dead-end, not a privilege issue.
- **`apps/web/app/pricing/page.tsx`** — still advertises "Nixpacks" for builds; `services/node-agent/src/build.js`'s own comments document a deliberate migration to Railpack ("Nixpacks is in maintenance mode"). Marketing copy never caught up.
- **`.gitignore`/packaging hygiene** — `ci-logs-1/`, `.vscode/settings.json` both gitignored yet present in this archive, plus a hardcoded personal Windows path in `config/scripts/README.md` — evidence this zip was a raw folder dump, not a clean export.
- **`.skills.json`** — an orphaned, unrelated AI-tooling metadata file with no connection to the product.
- **`packages/supabase-js/package.json`** — leftover `pnpm`-specific scripts vendored from the upstream monorepo; this project uses npm, so these specific scripts would fail if run.

### Placeholder/mock content on the public marketing site

- **`apps/web/components/Testimonials.tsx`** — three fabricated customer names, quotes, and 5-star ratings, presented as real reviews with no disclaimer.
- **`apps/web/components/V2RaySection.tsx`**'s "Node Status Monitor" — hardcoded, never-updating "99.99% Online" badge and 4 fake node ping times, styled as a live monitor. (For scope: the actual V2Ray product this page sells is fulfilled entirely by an external URL, not by anything in this codebase — noted for completeness, not itself a bug.)
- *For contrast:* the animated terminal demos in `PlatformShowcase.tsx`/`AdvancedFeatures.tsx` use illustrative example numbers too, but are clearly framed as a stylized product-demo animation rather than claiming to be live data — not flagged, since that's standard, non-deceptive marketing practice.

### CI/CD and dependency findings (verified by actually running things, not just reading)

- **Confirmed real, dated CI failure**: `ci-logs-1/` contains a downloaded log for the "Publish SDK" workflow, run 2026-08-22, that failed with `npm error Unsupported URL Type "workspace:"`. I searched the current snapshot exhaustively and found no remaining `workspace:*` references, so this appears already fixed since that run — but this log directory (gitignored, yet present) shouldn't ship as part of a delivered codebase regardless.
- **I ran `npm ci` myself.** It fails as CI runs it today, but for a *different*, still-current reason: `packages/supabase-js`'s `puppeteer` devDependency tries to download a pinned Chrome build with no `PUPPETEER_SKIP_DOWNLOAD` fallback anywhere in the repo, purely to support the vendored SDK's own browser tests, which this project's CI never runs. With that env var set, install succeeds (1,418 packages).
- **`npm audit --omit=dev`**: 23 vulnerabilities (18 moderate, 5 high) in production dependencies, concentrated in the `firebase-admin` chain and `dockerode`.
- **CI gap:** `.github/workflows/ci.yml` never builds, typechecks, lints, or tests any of the three `services/*` (discord-bot, node-agent, whatsapp-bot). It also never runs the real `tests/integration/` or `tests/e2e/` suites that exist in the repo (no npm script exists to run them at all).
- **I actually ran the unit test suite twice.** First pass (no env vars): 107/112 passed, 5 failures, all traced to a missing `DATABASE_URL` at import time. Second pass, after setting CI's exact dummy env vars: 131/132 passed, 1 remaining failure traced to my sandbox's network restrictions blocking Prisma's binary CDN — confirmed CI's own step order runs `prisma generate` immediately before tests, so this would not occur in real CI. **Net conclusion: I found no test that would genuinely fail in CI**, arrived at by actually running the suite rather than assuming.

---

## 4. On the two prior audit documents found in the repo

`docs/ShanuTechX_Code_Audit_Report.md` (undated, findings C1–C7/H1–H10/M1–M8) and `docs/CHANGELOG_fixes_applied.md` (dated 2026-08-24, claiming all of them fixed) are both present in the repository. I did not take either at face value — I independently verified essentially every claim against the live code. The large majority of claimed fixes (CORS, the settings-PIN bypass, the hardcoded cluster secret, log redaction, dead AI-verification code removal, the Git OAuth rewrite, the billing/uptime scheduler, webmail's IDOR, the Docker-catalog-templates bug, and more) **checked out as genuinely, correctly fixed** — a real, substantial, well-executed remediation pass, not just paperwork. But several things didn't fully hold up: `@shanutechx/auth` (still completely broken, contradicting the changelog's closing claim), the `supabase.ts` fake-data behavior (only the persistence half was fixed — the fabrication itself runs far deeper than either document suggests, per §3 above), and a signed-but-not-single-use OAuth state token. I'd treat the changelog as a mostly-reliable but incomplete record going forward, and would specifically flag that whoever ran that remediation pass should take another look at the `supabase.ts` observability/logs/integrations panels, which are a bigger problem than what either document describes.

Separately, `docs/` contains a large volume (64 files) of what appear to be session-by-session status reports from iterative, likely AI-assisted development (`SPRINT_*_COMPLETE.md`, `*_SUMMARY.md`, `PRODUCTION_READY.md`, etc.). Spot-checking several of these against current code found genuinely stale claims sitting alongside accurate ones with no way to tell which from the filename alone — e.g., one sprint doc's "Node Stats Collection Not Implemented, Status: Not started" is in fact now fully implemented (`services/node-agent/src/stats.js`, `POST /nodes/:id/stats`, and load-based node selection all exist and were verified directly), while `docs/CLAUDE.md` and the root `CLAUDE.md` are two separate files with overlapping purpose. This volume of historical planning documentation is worth pruning or consolidating — not because any individual file is wrong, but because there's no way for a reader to know which ones still reflect reality without checking the code directly, which somewhat defeats the purpose of writing them down.