# ShanuTechX Hosting Platform — Code Review Report

**Repository:** `Shanutechx-hostingplatfrom-main.zip`
**Total files (excl. node_modules/.git):** 1,127
**Review date:** September 2026

---

## 0. Coverage — what was actually reviewed

Before anything else: this repository is much bigger than "one project's code." **473 of the 1,127 files (42%)** — everything under `packages/{supabase-js,auth-js,realtime-js,postgrest-js,storage-js,functions-js,tracing}` — are a vendored, rebranded fork of the real, open-source **Supabase** client SDK monorepo. This is verifiable directly: every one of those packages' `package.json` `repository`/`homepage` fields point at `github.com/supabase/supabase-js`. That leaves **654 first-party files** (~114,000 lines) that are actually ShanuTechX's own code.

Given that split, this review applied two different methods:

- **First-party code (654 files):** genuine file-by-file reading, plus active verification — I ran `npm ci`, `npm audit`, and the real unit test suite; traced call chains end-to-end (client → API route → library → database schema); and cross-checked two prior internal audit documents found in the repo against the live code rather than trusting their claims.
- **Vendored SDK code (473 files):** not re-audited line-by-line as if hunting for novel bugs in Supabase's own, independently-maintained, widely-used SDKs. Instead, every file that had been *modified* from upstream (rebranding) was located via targeted search and inspected directly. This is disclosed explicitly, not silently substituted for full coverage.

### First-party coverage by area

| Area | Files | Coverage | Notes |
|---|---|---|---|
| Root config, `.github/workflows`, `ci-logs-1/` | ~27 | **Full** | Includes actually running `npm ci`, `npm audit`, the CI-referenced failure log |
| `packages/db` (schema + all 20 migrations) | 22 | **Full** | Full 1,437-line schema read line-by-line |
| `apps/api` (routes, lib, middleware, jobs) | 162 | **~90%, all critical paths** | Every route file opened; ~65 `lib/` files opened, most read in full; a residual ~15 low-risk `lib/` utility files were grep-scanned rather than read line-by-line |
| `services/node-agent`, `discord-bot`, `whatsapp-bot` | 29 | **Full** | |
| `apps/dashboard` | 151 | **Partial (~30 files in depth)** | All auth/RBAC/guard foundations, `lib/api.ts` in full, several of the highest-risk pages (deployments, staff, billing, supabase panel) |
| `apps/web` | 45 | **Partial (~8 files)** | Structure confirmed, contact flow, testimonials, layout checked |
| `apps/mobile-admin` | 32 | **Partial (~3 files)** | API client read in full; screens not individually read |
| `packages/{client,types,deployments,auth,node-agent,catalog}` | 77 | **~65%** | `auth`, `deployments`, `client`, `node-agent` read in depth; `types`/`catalog` structurally checked |
| `infra/`, `docker/` | 27 | **~60%** | All Docker Compose files compared directly; individual service configs (Traefik, Wildduck, Postal, observability) structurally checked, not all read line-by-line |
| `templates/` (self-hosted app catalog) | 10 | **Full** | All 10 YAML templates read |
| `tests/` | 20 | **Structure + execution**, not every test body read | **Actually ran** the unit suite (see §4) |
| `docs/` | 64 | **~15 files read in depth**, rest scanned/listed | Two prior internal audit reports read in full and used as a cross-check, not as a substitute for independent verification |

**Honest bottom line:** the code most likely to contain product-defining bugs — the API server, the deployment pipeline, the node agent, the bots, the database schema — got full, deep, verified coverage, including live execution of the install and test process. The frontend applications and documentation got substantial but not exhaustive coverage. I would not claim 100% line-by-line coverage of all 654 first-party files; I would claim high-confidence coverage of the ~350 files where a hosting platform's most consequential bugs live, arrived at by prioritizing depth over speed once the true scope became clear.

---

## 1. Summary of the most critical issues

These are the findings I'd fix first, roughly in priority order:

1. **`POST /supabase/db/query`'s fallback runs unrestricted admin-submitted raw SQL against the platform's own primary database**, not an isolated customer database, whenever the self-hosted Supabase backend is unreachable. (`apps/api/src/routes/supabase.ts`)
2. **Deployment creation and redeployment silently report "success" when the server actually rejected the request** — including when a customer's account gets banned by the abuse scanner mid-deployment. (`apps/dashboard/lib/api.ts` + `apps/dashboard/app/(protected)/deployments/page.tsx`)
3. **`@shanutechx/auth`, the platform's own published authentication SDK, is completely non-functional** — every method except `me()` calls a route that doesn't exist. A prior internal audit flagged this explicitly; a later "everything is fixed" changelog claims it was resolved, but it wasn't.
4. **Deleting a mailbox only removes the database row — the real mail account on the Wildduck server is never deleted**, even though the code to do so exists and is simply never called.
5. **Three separate "deploy without git" paths (Docker image, Docker Compose, ZIP upload) create a database record and report success but never actually deploy anything.** Currently not wired to any reviewed frontend, but a real trap if that changes.
6. **Firebase chat rules let a customer spoof a "staff" reply in their own support thread**, verified exploitable end-to-end (client code passes `senderRole` freely; rules never check it against the real staff list).
7. **Orders/invoices have no price snapshot at all** — invoices and cart totals are recomputed from the *current* catalog price, not what was actually charged, which is a real billing/audit-trail integrity problem.
8. **A custom HTML sanitizer used for rendering untrusted email content has a real bypass** in its server-render fallback path (which Next.js reaches by default for any `'use client'` component's first paint).
9. **Ban audit-log entries are attributed to the person being banned, not the admin who banned them** — the audit trail is wrong for every single ban.
10. **Two large, independently-maintained Docker Compose stacks** (~1,000 combined lines) define overlapping-but-different service sets with no single source of truth for "how do I run this."

Full detail on every one of these, plus ~30 additional findings, is in §3.

---

## 2. Files that are pure placeholder/scaffolding with no real implementation

- **`apps/api/src/routes/dockerDeployments.ts`** — both endpoints (`POST /deployments/docker-image`, `POST /deployments/docker-compose`) create a database row and report success; neither calls node-agent or anything else that would actually run a container. Confirmed nothing downstream ever consumes the `docker://`/`compose://` repoUrl prefixes this file writes.
- **`apps/api/src/routes/zipDeployments.ts`** (`POST /deployments/upload`) — same pattern; uploads files and pushes a git backup mirror, but never triggers a build.
- **`apps/api/src/lib/nodeSelector.ts`'s `failoverDeadNode()`** — self-documented via its own `TODO` comment as incomplete (reassigns bookkeeping, never actually migrates the running container). Confirmed unreachable — nothing calls it.
- **`apps/api/src/lib/alerts.ts`'s `checkMetricAlerts()`** — fully implemented alerting logic that is, by its own `TODO` comment, never wired into any scheduler. Confirmed unreachable.
- **`apps/api/src/routes/prWebhooks.ts` and `managedDatabases.ts`'s backup/restore endpoints** — *not* bugs, included here for completeness: these honestly return `501 Not Implemented` rather than faking success. This is the right way to leave something unfinished, and stands in useful contrast to the dockerDeployments/zipDeployments items above.
- **`apps/web/components/Testimonials.tsx`** — three entirely fabricated customer names, quotes, and 5-star ratings, hardcoded and presented on the public marketing site as real reviews.

---

## 3. All findings, by file

Each entry: **Category** · **Severity** · what/where · suggested fix. Severity is High / Medium / Low based on realistic blast radius and reachability, not worst-case theoretical impact.

### Critical / High severity

**`apps/api/src/routes/supabase.ts` — `POST /supabase/db/query` fallback hits the platform's own database**
*Category: Bug / Security. Severity: High.*
The route first proxies queries to the real self-hosted Supabase Meta service. If that call fails — which happens in any deployment where the self-hosted stack isn't reachable, a state the app's own docs describe as normal — it falls back to `prisma.$queryRawUnsafe(sql)` using `lib/prisma`, the *same* connection used for the platform's own Users/Payments/Orders tables. No read-only enforcement, no allowlist. Gated to admin/dev roles, so not customer-reachable, but the blast radius when triggered is the entire platform's live data.
*Fix:* never fall back to the platform's own Prisma connection for this feature. Return a clear 503 instead, or point a genuine fallback at a separately-configured, read-only connection string for the self-hosted stack's own database.

**Same file — fake success data on backend failure (only partially fixed)**
*Category: Bug. Severity: High.*
`GET/POST /supabase/storage/buckets` and `GET /supabase/db/schemas`/`tables` still return hardcoded fake data with a 200 status when the real backend is unreachable — a prior audit flagged this exact pattern and a later changelog claims it's fixed, but only the *persistence* half of that finding was actually addressed; the fake-fallback-data behavior for these specific routes was not. Confirmed the dashboard UI has no way to detect this (no `isFallback` flag in the response), unlike `routes/traefikStatus.ts` elsewhere in the same codebase, which does this correctly.
*Fix:* return a clear error status instead of fabricated data; add an `isFallback` flag the frontend can act on, matching the pattern already used in `traefikStatus.ts`.

**`apps/dashboard/lib/api.ts` (`deployments.create`, `redeploy`) + `apps/api/src/routes/deployments.ts` — false "success" on rejected deployments**
*Category: Bug. Severity: High.*
Both client functions assume the response body is always a newline-delimited stream of build events, with no check of `res.ok` or content-type first — unlike the sibling `updateEnv()` a few lines above, which does this correctly. But the server returns early, plain, single-shot JSON error responses (400/403/404/409) for schema validation failures, the abuse scanner banning the account, git-account-ownership failures, missing templates, and more — all *before* the real ndjson stream starts. Since a JSON error object is itself valid JSON, `JSON.parse()` on it doesn't throw; it just produces an object that doesn't match the `{phase, log, message}` shape the UI's `onEvent` callback checks for, so nothing happens, the read loop exits normally, and the calling code's `try` block completes without ever hitting `catch`. Traced directly into `app/(protected)/deployments/page.tsx`: the result is a green "Deployment created & live!" toast for a deployment the server explicitly rejected — including the case where the customer's account was just banned.
The same pattern (unwrapped streaming fetch, no `res.ok` check) also reaches `app/(protected)/admin/nodes/page.tsx`'s SSH-provision-node flow, with a milder symptom (silently does nothing rather than false success).
*Fix:* check `res.ok`/content-type before entering the streaming-read loop, matching `updateEnv()`'s existing pattern; ideally centralize into one shared streaming-fetch helper so this isn't a three-times-repeated bug.

**`packages/auth` (`@shanutechx/auth`) — completely non-functional, contradicting the "everything fixed" changelog**
*Category: Broken reference / Incomplete work. Severity: High.*
Every method (`login`, `register`, `refresh`, `changePassword`) calls `/api/auth/*` routes. Confirmed via repo-wide grep: **no such routes exist anywhere in `apps/api`**, and no router is mounted at `/api/auth`. Only `me()` works (it correctly calls `/api/me`). A prior internal audit called this out explicitly as "the starkest example" of a broken SDK; a later changelog documenting fixes to `packages/node-agent` and `packages/client` never mentions `packages/auth` at all, and its closing claim that "everything from the original audit is now addressed" is demonstrably false for this package.
*Fix:* either implement the missing `/api/auth/*` routes, or delete/deprecate this package until they exist — right now it silently ships as if functional.

**`apps/api/src/routes/email.ts` — deleting a mailbox never deletes the real mail account**
*Category: Bug. Severity: High.*
`DELETE /email/mailboxes/:id` only does `prisma.smtpAccount.delete(...)`. `lib/wildduckClient.ts` has a fully implemented `deleteUser()` method, and the exact ID needed (`SmtpAccount.wildduckUserId`) is a real, populated column on the row being deleted — but the delete handler never calls it. The actual mail account keeps working indefinitely after the platform believes it's gone, and the username+domain stays occupied on the mail server.
*Fix:* `if (account.wildduckUserId) await wildduckClient.deleteUser(account.wildduckUserId)` before/alongside the Prisma delete.

**Non-git deployment paths create a DB row but never deploy anything (3 instances)**
*Category: Incomplete work. Severity: High (contained today).*
`routes/dockerDeployments.ts` (both Docker-image and Docker-Compose endpoints) and `routes/zipDeployments.ts` (ZIP upload) all create a real `Deployment` row, reserve a subdomain, and report success — none of them ever call node-agent's build/run path. Confirmed nothing downstream (no job, worker, or queue consumer) ever reads the `docker://`/`compose://`/`zip://` repoUrl prefixes these routes write. Currently not called from anywhere in the reviewed `apps/dashboard` frontend, so this is dormant rather than actively deceiving customers today — but "upload a zip instead of connecting git" reads like a natural, likely-advertised feature for a hosting platform, making this a real risk the moment a frontend button gets wired to it without re-discovering this gap.
*Fix:* implement the actual build/run path through node-agent for at least the ZIP-upload case (most likely to be customer-facing), or clearly gate these routes as unavailable.

**`firebase/database.rules.json` + `apps/dashboard/lib/chat.ts` — customer can spoof a "staff" chat reply, confirmed exploitable**
*Category: Bug / Security. Severity: High (self-contained to the attacker's own thread).*
Chat is written directly from the browser via the Firebase SDK with no server mediation — Firebase's rules are the entire enforcement boundary. The rules validate that `senderRole` is one of `'customer'`/`'staff'` but never check it against the real staff list (`root.child('staff').child(auth.uid).exists()`), and `chatIndex/$uid` has no validation at all. Traced into `lib/chat.ts`: `senderRole` is passed through freely by whatever calls `sendChatMessage()`. A customer can write a message claiming `senderRole: "staff"` in their own thread, or manipulate their own inbox metadata (e.g. suppress the "unread" flag staff rely on).
*Fix:* add a `.validate` rule requiring `senderRole === 'staff'` to also satisfy `root.child('staff').child(auth.uid).exists()`; add a real `.validate` block to `chatIndex/$uid`.

**No price snapshot anywhere in the order pipeline — invoices and cart totals use live catalog prices**
*Category: Bug (data model). Severity: High.*
`OrderItem` has no `price`/`unitPrice` field at all. `routes/invoices.ts` computes each line's price from the *current* `service.price`/`plan.price` at whatever moment the invoice is first lazily generated (which can be long after the order). `routes/orders.ts`'s `recalculateTotal()` confirms this is structural, not a one-off: cart totals are recomputed from live prices on every mutation and again at checkout, with no reconciliation if a price changed in between. This also risks an internally inconsistent invoice PDF — line items computed from current prices, `total` field showing the actual historical charge — that won't sum correctly if a price ever changed.
*Fix:* add a price-snapshot column to `OrderItem`, populated at checkout, and have invoices/anything else needing "what was this line item worth" read from it instead of the live catalog.

**`apps/dashboard/lib/sanitize.ts` — real bypass in the sanitizer used for untrusted email HTML**
*Category: Bug / Security. Severity: High.*
Used by `WebmailMessageViewer.tsx` to render actual received email bodies via `dangerouslySetInnerHTML`. Both call sites are `'use client'` components, which Next.js still server-renders once before hydration — meaning the file's own regex-only "SSR fallback" path is a genuinely reachable production code path, not a hypothetical. That fallback's script-tag regex requires a literal closing `</script>`; an **unclosed** `<script>` tag passes through completely untouched, and script execution happens at HTML-parse time, before hydration could ever "correct" it. Separately, the stronger client-side path's `javascript:` URL check does a plain `startsWith()` with no control-character normalization, so `href="java\tscript:..."` survives the filter (a known, documented bypass technique) even though browsers still execute it.
*Fix:* replace the hand-rolled sanitizer with a maintained library (DOMPurify or equivalent) run consistently on both server and client.

**`apps/api/src/lib/abuseDetector.ts` — ban audit log always blames the banned user**
*Category: Bug. Severity: Medium-High.*
`banUserAndTeardownResources()` hardcodes `adminId: userId` on the AuditLog row it writes — `userId` is the account *being banned*, not the caller. All three call sites have the real acting admin's ID available (used elsewhere in the same call for a notification string) but it's never threaded through. Every ban's audit trail incorrectly says the banned user banned themselves.
*Fix:* accept an explicit `actorId` parameter and use it for `adminId`.

**Two independently-maintained Docker Compose stacks with real service divergence**
*Category: Inconsistency / duplicated logic. Severity: Medium-High (operational risk).*
Root `docker-compose.local.yml` (428 lines) and `infra/control-plane/docker-compose.yml` (636 lines) both independently define the same core service set (`api, worker, dashboard, web, whatsapp-bot, discord-bot, buildkit, node-agent, postgres, redis, minio`) but diverge from there — the root file adds Postal mail services, the infra file adds Traefik, LiveKit, and its own separate Supabase service definitions. The `config/scripts/START-ALL.ps1`/`.cmd` helper scripts only exercise the `infra/control-plane` one, even though the root `.env.example` explicitly documents the *other* one as the way to run local dev.
*Fix:* pick one as canonical, or clearly document that they serve genuinely different topologies (local dev vs. real node control-plane) if that's the actual intent — the current state looks like accidental drift, not a documented split.

### Medium severity

**`apps/api/src/routes/admin.ts` — ban/unban has no protection against admin-on-admin action**
*Category: Inconsistency. Severity: Medium.* This file explicitly protects the `dev` role from being touched by a plain admin in two other places (creating a dev user, changing a role to/from dev) but `POST /admin/users/:userId/ban` only excludes `dev`-role targets — any admin can ban any other admin, or themselves, with no equivalent guard. *Fix:* apply the same dev-only-can-touch-this-tier pattern already used elsewhere in the file.

**`apps/api/src/lib/orderFulfillment.ts` — "AI Subscription" detection matches almost anything**
*Category: Bug. Severity: Medium.* `productName.includes('ai')` fires for any product name containing that two-letter substring anywhere — including this codebase's own "Mail" hosting plans (m-**ai**-l). Customers buying unrelated products get a bogus "your AI subscription is active" notification. *Fix:* rely on the category check alone (already present and sufficient) or use a word-boundary-aware match.

**`apps/api/src/routes/cms.ts` — contact form failures are silently swallowed**
*Category: Bug. Severity: Medium.* `POST /cms/contact`'s DB write is wrapped in a completely empty `catch {}` with no logging, and unconditionally reports success regardless of outcome. There's also no staff notification on success, unlike other intake flows in the same codebase. *Fix:* log the error at minimum; consider notifying staff on success.

**`apps/api/src/routes/analytics.ts` — "top services" report groups by a legacy, mostly-null field**
*Category: Bug. Severity: Medium.* Groups by `OrderItem.serviceId`, which the schema's own comments mark legacy/superseded by `planId`; current orders have `serviceId: null` and are filtered out entirely. *Fix:* group by `planId` instead.

**`apps/api/src/routes/internalBot.ts` — Discord payment review picks a payment row by unordered array index**
*Category: Bug. Severity: Medium.* `order.payments[0]` with no `orderBy`, no guaranteed order from Prisma/Postgres. Confirmed via the Discord bot's actual slash-command code that only `order_id` (never a specific `payment_id`) is ever sent — the *dashboard's* equivalent review endpoint (`routes/payments.ts`) correctly targets a specific payment ID, showing the more correct pattern already exists elsewhere in the codebase. *Fix:* pass and use a specific `paymentId`, or add an explicit `orderBy`.

**`packages/deployments/src/EnvManager.ts` — calls a route that doesn't exist**
*Category: Broken reference. Severity: Medium-High.* `getEnvVars()` calls `GET /api/deployments/:id/env`; confirmed only the `PATCH` variant exists anywhere in the API. All three of `EnvManager`'s instance methods depend on this and are non-functional (its two static string-parsing helpers still work). Same root cause as the `@shanutechx/auth` finding — a published SDK helper written without verifying the target route exists, which a TypeScript build can't catch. *Fix:* add the missing `GET` route, or have `load()` read `envVars` off the regular deployment-detail response.

**`apps/api/src/routes/email.ts` — mailbox credentials endpoint has broader access than the mailbox list**
*Category: Inconsistency. Severity: Low-Medium.* The list endpoint scopes admin visibility to assigned/allowlisted admins; the credentials endpoint (which reveals plaintext SMTP passwords) allows any admin/dev regardless of assignment. May be intentional; worth a deliberate decision either way.

**`templates/supabase-lite.yaml` — missing required service, misconfigured metadata URL**
*Category: Bug. Severity: Medium-High for this template.* Missing the `postgres-meta` service the real self-hosted Supabase stack requires; `STUDIO_PG_META_URL` points directly at Postgres's raw wire-protocol port (5432) rather than an HTTP metadata API. Supabase Studio would start but its core table/SQL-browsing functionality would not work. *Fix:* add the `postgres-meta` service, point the URL at its HTTP port.

**`templates/hermes-agent.yaml` — Docker image likely doesn't exist**
*Category: Broken reference (unconfirmed). Severity: Medium.* `hermesagent/hermes-agent:latest` did not turn up as an established image in a web search; what exists under similar names are small unrelated personal projects and a differently-namespaced product. Worth a manual `docker pull` check before shipping, given the consequence of a customer paying to deploy a template that can't start.

**`.env.example` (root) is stale relative to the actual code and the per-app `.env.example` files**
*Category: Inconsistency. Severity: Medium.* Lists `JWT_SECRET`, which is never read anywhere in `apps/api` (confirmed via grep — the real cross-service variable is `PROJECT_AUTH_JWT_SECRET`), and `ENCRYPTION_KEY`, when the code actually reads `SECRETS_ENCRYPTION_KEY` (confirmed correct in `apps/api/.env.example`, which is otherwise accurate and well-maintained). The `ENCRYPTION_KEY` placeholder value is also a sequential, non-random-looking hex string (`0123456789abcdef...`) rather than a `CHANGE_ME`-style textual placeholder like every other secret in the file — and I confirmed in `lib/secretsVault.ts` that any 64-hex-char string is accepted as-is as the literal AES-256-GCM key with no strength validation, so if this exact value ever reached a real `.env`, every encrypted secret in the database would be decryptable by anyone who's seen this public repo.

### Low severity / minor

- **`config/scripts/CHECK-HEALTH.cmd`** — bare `curl -s` (no `-f`) and a `findstr "HTTP"` check both report "OK" for any HTTP response including 4xx/5xx, so this health check can't actually detect an erroring-but-reachable service.
- **`apps/api/src/lib/nodeSelector.ts`'s `failoverDeadNode()`** and **`apps/api/src/lib/alerts.ts`'s `checkMetricAlerts()`** — both fully built, both self-documented via their own `TODO` comments as never wired into a scheduler, both confirmed unreachable. Included for completeness per the review's "TODOs/stubs" category; not urgent since neither is currently reachable.
- **`apps/dashboard/lib/api.ts`'s `discordWebhooks.delete()`** — the one method in this 1,222-line file that doesn't wrap its fetch in the shared `asJson()` error-throwing helper (every other delete/remove method does). A failed delete silently shows a green "removed" success toast.
- **`apps/dashboard/app/(protected)/admin/staff/page.tsx`** — shows a "Make Dev" button to plain admins, who will always be rejected server-side (correctly) when they click it. Server-side protection holds; this is a UI-truthfulness nit, not a security issue.
- **`apps/dashboard/lib/AppUserContext.tsx`** — caches the user's role/profile in `localStorage` (not scoped per-Firebase-uid) and renders optimistically from it before background revalidation completes; on a shared/public computer this could very briefly show a stale role after a permission change. Backend authorization is enforced independently, so this is a UI-staleness issue, not a privilege-escalation one.
- **`apps/dashboard/components/PasswordLockGuard.tsx`** — the "Settings Unlocked (Active Security Session)" unlock state is stored in `localStorage`, which (unlike `sessionStorage`) persists across full browser restarts, not just tab closes — a mismatch between what the UI copy implies and what the storage mechanism actually does.
- **`apps/api/src/middleware/rbac.ts`** — `canAccessResource`/`canSeeTicket`/`canReviewPayment` all fail *open* (grant admin access) if the resource-owner lookup comes back null. Consistent across all three (so likely intentional), but worth a deliberate second look given it's the opposite of "deny by default."
- **`.gitignore`/packaging hygiene** — `ci-logs-1/`, `.vscode/settings.json` are both gitignored yet present in this archive, and `config/scripts/README.md` hardcodes a personal Windows path (`c:\Users\tiros\...`) — all evidence this zip was a raw folder dump rather than a clean export, none of it functionally harmful but worth cleaning up before any public/client-facing distribution.
- **`.skills.json`** — an orphaned, unrelated AI-tooling metadata file with no connection to the product; harmless but shouldn't be in the repo.
- **`packages/supabase-js/package.json`** — leftover `pnpm`-specific scripts (`serve:coverage`, `update:test-deps:expo`) vendored from the upstream monorepo, which uses pnpm; this project uses npm, so these specific scripts (not on any critical path) would fail if anyone tried to run them.

### CI/CD and dependency findings (verified by actually running things, not just reading)

- **Confirmed real, dated CI failure**: `ci-logs-1/` contains a downloaded log for the "Publish SDK" workflow, run 2026-08-22, that failed with `npm error Unsupported URL Type "workspace:"` — a pnpm/yarn-only dependency protocol that broke plain `npm ci`. I searched the current snapshot exhaustively and found no remaining `workspace:*` references anywhere, so this specific defect appears already fixed since that run — but this log directory (gitignored, yet present in the archive) shouldn't ship as part of a delivered codebase either way.
- **I ran `npm ci` myself.** It fails as CI runs it today, but for a *different*, still-current reason: `packages/supabase-js`'s `puppeteer` devDependency tries to download a pinned Chrome build with no `PUPPETEER_SKIP_DOWNLOAD` fallback anywhere in the repo, and puppeteer exists purely to support the vendored SDK's own browser tests, which this project's CI never runs — pure install fragility for no benefit. With that env var set, install succeeds (1,418 packages).
- **`npm audit --omit=dev`** on the resulting install: 23 vulnerabilities (18 moderate, 5 high) in production dependencies, concentrated in the `firebase-admin` chain (`@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `gaxios`, transitively `undici`) and `dockerode`.
- **CI gap:** `.github/workflows/ci.yml` never builds, typechecks, lints, or tests any of the three `services/*` (discord-bot, node-agent, whatsapp-bot) — a broken service would not be caught. It also never runs the real `tests/integration/` or `tests/e2e/` suites that exist in the repo (no npm script exists to run them at all, only `test:unit`).
- **I actually ran the unit test suite** (`npm run test:unit`, the exact command CI runs), twice. First pass (no env vars): 107/112 passed, 5 failures, all traced to a missing `DATABASE_URL` at import time. Second pass, after setting CI's exact dummy env vars: 131/132 passed, 1 remaining failure traced to my sandbox's network restrictions blocking Prisma's binary CDN (not reachable from this environment) — confirmed CI's own step order runs `prisma generate` immediately before tests, so this would not occur in real CI. **Net conclusion: I found no test that would genuinely fail in CI.** This is good news, arrived at by actually running the suite rather than assuming.

---

## 4. On the two prior audit documents found in the repo

`docs/ShanuTechX_Code_Audit_Report.md` (undated, findings C1–C7/H1–H10/M1–M8) and `docs/CHANGELOG_fixes_applied.md` (dated 2026-08-24, claiming all of them fixed) are both present in the repository. I did not take either at face value — I independently verified essentially every claim against the live code. The large majority of claimed fixes (CORS, the settings-PIN bypass, the hardcoded cluster secret, log redaction, dead AI-verification code removal, the Git OAuth rewrite, the billing/uptime scheduler, webmail's IDOR, the Docker-catalog-templates bug, and more) **checked out as genuinely, correctly fixed** — this is a real, substantial, well-executed remediation pass, not just paperwork. But two things did not hold up: the `@shanutechx/auth` package (still completely broken, contradicting the changelog's closing claim) and the `supabase.ts` fake-fallback-data behavior (only half-fixed). Both are detailed above. I'd treat the changelog as a mostly-reliable but not fully complete record going forward.