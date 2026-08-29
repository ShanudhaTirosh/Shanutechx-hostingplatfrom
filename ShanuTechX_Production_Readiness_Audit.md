# ShanuTechX Production-Readiness Audit

**Scope:** full monorepo (`apps/api`, `services/node-agent`, `apps/dashboard`, `apps/web`, `services/discord-bot`, `services/whatsapp-bot`, `packages/*`, `apps/mobile-admin`, `templates/`, `infra/`, `docker/`)
**Method:** static source review against every claim in `BUG_AUDIT.md` and `docs/COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md`, plus a full first-party bug/security/config sweep. Where verification was tractable, claims were checked dynamically, not just read: dependencies were installed, `npm audit` was run, and the CI-run unit-test suite was executed twice — once under the real CI workflow's exact environment, once under environment values matching the app's actual contract — to get ground truth rather than inference.

---

## Executive summary

The two prior audit documents are a mixed bag: most of the **critical** items (C1–C7) were genuinely and correctly fixed on re-verification — the SSH-gateway null-deref, the node-agent path-traversal, the encryption-key handling, the PIN-bypass, the Supabase config auth gate, and the webmail in-memory-store issue all check out against current source. Three of the critical/high items (auth.ts JWT fallback, role-mutation via auth.ts, missing auth.ts rate limiting) reference a file (`routes/auth.ts`) and module (`lib/jwt.ts`) that **do not exist anywhere in this codebase** — the platform uses Firebase ID tokens exclusively, so these three items describe an architecture this repo doesn't have, not a regression.

The most consequential findings in this audit are **new**, not re-confirmations:

1. **The CI pipeline's unit-test step is very likely broken on every real run** — reproduced directly, not inferred (see finding #1). This means the regression tests written specifically to lock in prior fixes have probably never executed successfully in CI.
2. **Any Discord server member can approve or decline any customer's payment** via the `/review-payment` slash command — there is no code-level authorization check at all, bot- or API-side (finding #2).
3. **One-click catalog apps (WordPress, n8n, Redis, etc.) almost certainly can never be torn down through the platform** — the correct teardown endpoint exists on the node-agent but is never called; deletion instead calls a single-container endpoint with a project name that doesn't match any real container, leaving orphaned multi-container stacks and volumes running forever (finding #3).
4. **The node-agent's HTTP API — full filesystem, Docker, and SSH-terminal control over every customer's containers on that node — is published to the public internet by the production infra-as-code**, directly contradicting the loud warning the service prints about exactly this at startup (finding #4).
5. A real, if lower-severity, payment-approval **race condition survives in one of two near-identical code paths** — `payments.ts` was hardened with an atomic compare-and-swap, `internalBot.ts`'s parallel path for the same operation was not.

Below is the full workspace-by-workspace writeup, in the order requested, followed by the summary table and the decision checklist.

---

## 1. `apps/api`

### 1.1 Re-verification of BUG_AUDIT.md / COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C1 | No secrets committed in `.env` files | **Confirmed** | No `.env` files with real values found in the archive. |
| C2 | `GET /api/supabase/config` requires admin/dev | **Confirmed** | Every route in `routes/supabase.ts` declares `requireAuth, requireAdminOrDev` inline, not just at router level. |
| C3 | Webmail uses a DB model scoped by `userId`, not an in-memory Map | **Confirmed** | `routes/webmail.ts` uses `prisma.smtpAccount`/`webmailMessage` with a `canAccessMailbox()` ownership check; no `Map` anywhere in the file. |
| C4 | Settings PIN uses bcrypt, no bypass string | **Confirmed** | `routes/settings.ts` hashes with bcrypt and fails closed (412) if no PIN is configured — no magic string. |
| C5 | No hardcoded fallback for `NODE_AGENT_SECRET`/cluster secret; timing-safe compare | **Confirmed** | `env.ts` has no fallback (`required()` throws); `lib/gateAuth.ts`'s `verifySharedSecret()` is a correct HMAC-then-`timingSafeEqual` comparison, used by both `routes/nodes.ts` and `services/node-agent/src/index.js`. |
| C6 | node-agent has a deployment metrics route | **Confirmed** | Present. |
| C7 | Dockerfile copies `templates/` | **Confirmed** | Present. |
| C3/C5/C11 (auth.ts role-bypass, JWT fallback secret, missing rate limit) | Reference `routes/auth.ts` and `lib/jwt.ts` | **Files do not exist** | Exhaustive search of `apps/api/src` found no `routes/auth.ts`, no `lib/jwt.ts`, and no use of `JWT_SECRET` anywhere in application code. Auth is 100% Firebase ID tokens verified in `middleware/auth.ts`. `routes/me.ts`'s own profile-update endpoint uses a Zod `.strict()` schema that doesn't include `role`, so the underlying "spread untrusted fields into `prisma.user.update`" risk doesn't exist under any current filename either. These items describe an architecture this repo does not have — not confirmable as fixed *or* regressed. |
| H1 | In-memory stores (knowledgebase, SMTP, email domains, secrets vault, Supabase panel) moved to DB | **Confirmed** for webmail/SMTP/secrets; see §1.2 for `supabase.ts`'s panel data, which is DB-backed for core resources but still has several **hardcoded mock** display endpoints (not the same failure mode as an in-memory store, but adjacent — see finding below). |
| H2 | node-agent `AGENT_BIND_HOST`/`AGENT_ALLOWED_IPS`, timing-safe compare | **Confirmed in code** — see finding #4 below for why this doesn't help in the actual deployed configuration. |
| H4 | `DELETE /vps-plans/:id` soft-deletes | **Confirmed** for that route specifically — but see the systemic hard-delete finding in §1.2, which covers five *other* order-linked resource types that were apparently not brought in line with the same guardrail. |
| H5 | Pino redact config for `Authorization`, etc. | **Confirmed** — `index.ts` redacts the documented header set. |
| H6 | BullMQ repeatable jobs replace ad hoc cron | **Confirmed structurally** — see the retry/isolation gap noted in §1.2. |
| H7 | GitHub App / GitLab OAuth with signed state tokens | **Confirmed** — `lib/gitProviders/state.ts` is a correct HMAC-signed, expiry-checked, timing-safe-verified state token. |
| H9 | Audit logs for VPS credential viewing / SSH tickets | **Confirmed** — `routes/leaseweb.ts` and `routes/cockpit.ts` log `vps.view_credentials`, `vps.reveal_password`, etc. See finding below for a much higher-blast-radius route that has *no* equivalent logging. |
| M1 | CORS via `isOriginAllowed()` | **Confirmed.** |
| M6 | Billing/admin fallback permits `dev` in addition to `admin` | **Confirmed**, and consistently applied — `middleware/auth.ts`'s `requireAdmin` already includes `dev`. |
| M7 | Removed `verifyPayment.ts.disabled`, `gemini.ts`, `groq.ts` | **Confirmed removed**; no `GEMINI_API_KEY`/`GROQ_API_KEY` reference remains in `apps/api/src`. |
| M8 | `settingsRouter` mounted once | **Confirmed** — but see finding below: `supabase.ts` has its own, new instance of the identical *class* of bug (a duplicate route registration), just for `/supabase/config` rather than `/api/settings`. |
| Part 3 | GitHub App/GitLab OAuth signed state | **Confirmed**, see H7 above. |
| Part 3 | `managedDatabases.ts`/`projects.ts` real `pg_dump`/`psql` execution with a `validateIdentifier()` guard | **Not found.** No function named `validateIdentifier`/`sanitizeIdentifier`/`isValidIdentifier` exists anywhere in the repository. Neither `managedDatabases.ts` nor `projects.ts` contains any `pg_dump`/`psql`/`exec`/`spawn` call at all — they only manage container lifecycle via node-agent HTTP calls. The **only** real `pg_dump`/`psql` usage anywhere in the repo is `lib/backup.ts`, which backs up the **platform's own** database, not a customer-managed one — a different feature entirely from what the claim describes. See finding below for what `backup.ts` actually does and the one real gap in it. |
| Part 3 | `leaseweb.ts`/`vps.ts` use `resolveLeasewebVpsId`/`canAccessResource` | **Confirmed**, and audit-logged. |
| Part 3 | `deployments.ts`/`dockerDeployments.ts`/`zipDeployments.ts` `validateCustomSubdomain()` | Function confirmed to exist in `lib/subdomain.ts`; not independently re-derived beyond confirming its presence given time constraints — **treat as plausible but not fully re-verified**. |
| Part 3 | `internalBot.ts`/`discordWebhookConfig.ts` timing-safe `x-internal-secret` | **Confirmed for `internalBot.ts`** (correct HMAC-then-`timingSafeEqual`, fails closed if unconfigured). `discordWebhookConfig.ts` turned out to be an unrelated `requireDev`-gated *configuration* route, not a webhook receiver — the claim as I originally read it doesn't apply to this file; no issue found there either way. |

### 1.2 New findings

---

**#1 — CRITICAL — Bug / Test gap — CI's unit-test job is very likely broken on every run**
`.github/workflows/ci.yml:13-17`; `apps/api/src/env.ts:1-40`

The CI workflow's `env:` block sets only `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `SKIP_ENV_VALIDATION=true`. `env.ts` eagerly calls `required()` at module load for 13 other variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `WHATSAPP_INTERNAL_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `ROOT_DOMAIN`, `NODE_AGENT_SECRET`, `SMS_WEBHOOK_SECRET`, `DISCORD_INTERNAL_SECRET`, `SECRETS_ENCRYPTION_KEY`, `PROJECT_AUTH_JWT_SECRET`, `BILLING_CRON_SECRET`), none of which the workflow sets. `JWT_SECRET`/`ENCRYPTION_KEY` are not read anywhere in current application code, and `SKIP_ENV_VALIDATION` is never referenced in `env.ts` at all — it's a complete no-op, presumably left over from an earlier version of the file or copy-pasted from a different project's convention.

**This was directly reproduced, not inferred.** Dependencies were installed and `tests/unit/audit_fixes.test.ts` was run under the *exact* environment variables the CI workflow sets:

```
Error: Missing required env var: FIREBASE_PROJECT_ID
# tests 1 / # pass 0 / # fail 1
```

Re-running the same file (and the full `tests/unit/*.test.ts` suite) with the actual 13 required variables set to dummy values: all 3 real assertions in `audit_fixes.test.ts` pass, and 129/132 tests pass suite-wide (the 3 remaining failures are explained below and are not env-related). This isolates the problem precisely: **the underlying fix code is correct; the CI wiring around it is not.**

Since `npm run test:unit` runs every file in a single `tsx --test` invocation and any one failing file makes the whole command — and therefore the whole CI step and job — exit non-zero, this means the "Run Unit Test Suite" step, and every later step in the same job (building `apps/api`, `apps/web`, `apps/dashboard`), has very likely been failing on essentially every commit. This directly undercuts any claim in either audit document that a fix is "verified by CI" — the regression test written specifically to lock in the XSS fixes (`audit_fixes.test.ts`) has probably never actually run successfully in the pipeline.

*Fix:* replace the `env:` block with the actual 13 required variables (dummy/placeholder values are fine — these are unit tests with no real network or DB calls), using `ROOT_DOMAIN: shanutechx.com` specifically (see next finding for why). Drop `JWT_SECRET`, `ENCRYPTION_KEY`, and `SKIP_ENV_VALIDATION` — all dead.

---

**#2 — MEDIUM — Test gap — a test hardcodes the production domain instead of deriving it from config**
`tests/unit/email_and_env.test.ts:56`

This test asserts the literal substring `'my-wa-bot.shanutechx.com'`, which only passes if `ROOT_DOMAIN` happens to be exactly `"shanutechx.com"` in whatever environment runs it. Directly confirmed: the same test with `ROOT_DOMAIN=example.com` fails; with `ROOT_DOMAIN=shanutechx.com` it passes (5/5 in that file). The underlying code (`lib/emailTemplates.ts:337`) is correct — it just reads `env.rootDomain` as it should. This is a test-portability nit, not a functional bug, but it matters for fixing finding #1: whoever repairs the CI env block needs to set `ROOT_DOMAIN=shanutechx.com` specifically, or this test will keep failing for an unrelated reason even after the main fix.

---

**#3 — HIGH — Test gap — `tests/unit/audit_fixes_v2.test.ts`'s order-ID-prefix regression test is trivially true and asserts nothing about real code**
`tests/unit/audit_fixes_v2.test.ts` (the "Order ID search handles both full UUID and 8-character short prefix" test)

This test defines its own local `buildWhere()` helper *inside the test file* and asserts that the object it just built contains the values it just put into it (e.g., `query.OR[0].id === 'A1B2C3D4'`), plus a native-JS `String.prototype.startsWith` sanity check on hardcoded literals. It never imports or calls any real application code. It would pass identically whether the actual vulnerable `{ id: { startsWith: orderId } }` OR-clause pattern is present anywhere in the real routes or not. (For what it's worth, I independently confirmed the real order lookup in `internalBot.ts` uses exact `findUnique({ where: { id: orderId } })` — the underlying fix appears genuinely present — but this test provides zero regression protection for it either way.) This is exactly the "trivially-true check masquerading as a regression test" failure mode called out as something to check for.

*Fix:* import the actual query-building logic (or the actual route handler with a mocked Prisma client) and assert against *that*, not a reimplementation.

---

**#4 — CRITICAL — Security / bug — the payment-approval race condition was fixed in one code path and not its near-identical twin**
`apps/api/src/routes/payments.ts:138-150` vs. `apps/api/src/routes/internalBot.ts:152-217`

`payments.ts`'s `POST /payments/:id/review` (the dashboard-triggered admin approval flow) uses a proper atomic compare-and-swap: `prisma.payment.updateMany({ where: { id, status: { in: ['manual_review','pending'] } }, data: {...} })`, checking `count === 0` to detect and reject a lost race. This is a well-built, genuinely correct fix.

`internalBot.ts`'s `POST /internal/review-payment` (the Discord-bot-triggered equivalent, doing the *same* business operation) does **not** use this pattern. It reads `order.status`, branches on it, then unconditionally runs `.update()` calls inside a `$transaction` and calls `fulfillOrder()`. Two concurrent approvals for the same order (a double-click, or a bot retry after a timeout) can both pass the read-then-branch check and both trigger fulfillment.

Blast radius of a double `fulfillOrder()`:
- `SmtpAccount`/`LiveKitProject` are protected by a DB-level `orderItemId @unique` constraint (`packages/db/prisma/schema.prisma:568,619`) — one `create` wins, the other throws and is caught/logged. Safe, but by accident of the schema, not by this route's own logic.
- `ManagedDatabase` (`schema.prisma:1009-1022`) has **no `orderItemId` field at all** and no unique constraint of any kind. Its idempotency check in `lib/orderFulfillment.ts:199-201` (`userId + type + createdAt >= order.createdAt`) is a pure application-level check with a real time-of-check/time-of-use gap. A genuine race here provisions two real database containers for one paid order, and the second is a permanent orphan with no way to link it back to any order.

*Fix:* apply the same `updateMany`-based compare-and-swap to `internalBot.ts`'s handler (or better, have it call the same underlying function `payments.ts` uses instead of maintaining a second implementation of the same operation). Separately, add a unique, nullable `orderItemId` to `ManagedDatabase` and use it as the idempotency key the way `SmtpAccount`/`LiveKitProject` already do.

---

**#5 — HIGH — Security — the SSRF guard is a classic incomplete hostname blocklist**
`apps/api/src/routes/smtp.ts:66-72` (`isSsrfTarget`), applied at line 107 in `POST /smtp/verify`

The guard checks the literal `host` string against a short exact-match list (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `169.254.169.254`) plus a regex for `10.x`/`172.16-31.x`/`192.168.x`. It never resolves DNS before checking, so any attacker-controlled hostname with an A record pointing at an internal address sails straight through — the check never sees the IP the code will actually connect to. It also misses most of `127.0.0.0/8` (only the exact `.1` is blocked), general `169.254.0.0/16`, IPv6 ULA/link-local ranges beyond `::1`, IPv4-mapped IPv6 (`::ffff:127.0.0.1`), and decimal/octal IP obfuscation.

This route requires `requireDev`, so exploitation needs an already-compromised or malicious dev/admin account — not a random customer — which limits but doesn't eliminate the severity, especially since SSRF protection here is an explicit claimed fix in the resolution document. Separately, `POST /smtp/verify-dns` (line 131) is reachable by **any** authenticated customer (only `requireAuth` at router level) and performs `dns.promises.resolveMx`/`resolveTxt` on a customer-supplied domain with no `isSsrfTarget` check at all — lower severity since it's resolution-only, no raw TCP connect, but still worth a look.

*Fix:* resolve the hostname first, then classify the *resulting* IP (Node's `net.isIP` plus a maintained CIDR-range check), and re-validate on every redirect/retry rather than trusting the caller-supplied hostname string once. If continuing to use the `ip-address` package for this anywhere, pin it above 10.3.0 — see the dependency section, its own CVEs are specifically SSRF-classification bypasses.

---

**#6 — HIGH — Dummy/config — `POST /supabase/db/query` falls back to unrestricted raw SQL against the platform's shared production database, with no audit log**
`apps/api/src/routes/supabase.ts:430-449`

Takes `sql` directly from the request body. It tries to proxy to `SUPABASE_META_URL` (a single global constant — `process.env.SUPABASE_META_URL || 'http://localhost:8080'`, not scoped per project); if that call fails for any reason, it falls back to `prisma.$queryRawUnsafe(sql)` using the platform's own main Prisma client — the same connection used for every one of `apps/api`'s own tables (`User`, `Order`, `Payment`, `ManagedDatabase` credential refs, everything). It's gated by `requireAdminOrDev`, and `dev` is documented elsewhere in this codebase as having "full permissions equivalent to admin across all API surfaces" — so any dev-level account can run arbitrary read/write/DDL SQL against production with one request. There is no audit logging anywhere in this file (confirmed by grep), in contrast to the VPS-credential-viewing routes elsewhere, which do log who accessed what. A much higher-blast-radius action here has strictly *less* audit coverage than viewing a VPS panel password.

This isn't necessarily wrong as a feature — a break-glass SQL console for trusted staff is a legitimate thing to offer — but as built it has no statement restrictions, no read-only mode, and leaves no record of who ran what.

*Fix:* audit-log every query (actor, timestamp, SQL text) the same way the credential-viewing routes do; consider restricting to true admin rather than dev; consider a read-only toggle or a confirmation step for destructive statements.

---

**#7 — MEDIUM — Bug — dead duplicate route in `supabase.ts`, plus several endpoints return fully hardcoded fake data**
`apps/api/src/routes/supabase.ts:499` and `:618`

Two separate `supabaseRouter.get('/supabase/config', ...)` definitions exist. Express matches in registration order, so the second (larger, env-var-driven) handler at line 618 can never execute — pure dead code. Both carry the same auth guard, so this isn't a security gap, just a maintenance trap: anyone editing the block at 618 believing they're changing the config endpoint's behavior will see no effect.

Separately, `/supabase/functions`, `/supabase/integrations`, and parts of `/supabase/advisors`/`/supabase/logs` return fully hardcoded literal arrays (a fake Edge Function, a fake webhook row, fake vault secret entries for `STRIPE_SECRET_KEY`/`RESEND_API_KEY`, fake FDW connections) rather than live introspection. This is admin/dev-facing, so customers can't exploit it to fake platform state, but it can mislead staff into believing integrations/vault secrets exist and are configured when the panel is purely decorative in these sections.

---

**#8 — CRITICAL — Bug — one-click catalog apps almost certainly can never be properly torn down; every "delete" likely orphans a full multi-container stack**
`services/node-agent/src/index.js` (compose endpoints) vs. `apps/api/src/routes/catalog.ts` / `routes/deployments.ts` / `lib/nodeAgentClient.ts:90-115`

node-agent's compose-aware teardown (`DELETE /agent/compose/:project`, runs `docker compose -p <project> down -v`) is fully implemented and correctly sanitized. An exhaustive search of `apps/api/src` for `agent/compose` found exactly **one** reference anywhere in the whole app: the `POST /agent/compose/up` call inside `catalog.ts`'s deploy handler. There is no caller for the `DELETE` (or the compose-scoped logs `GET`) endpoint anywhere in `apps/api`.

Instead, the generic `DELETE /deployments/:id` route calls `stopDeployment(node, containerId)`, which hits `/agent/deployments/${containerId}/stop` — a single-container-by-ID endpoint. For a catalog deploy, `containerId` is set to the compose *project* name (e.g. `wordpress-abc123`), but Docker Compose actually names its containers `<project>-<service>-1` (e.g. `wordpress-abc123-wordpress-1`, `wordpress-abc123-mysql-1`) — not the bare project name. This stop call is very likely to fail outright for every catalog deployment, and even in a best case would only ever touch one container, never the sidecar database container(s), network, or named volumes. Compounding this, the delete route wraps the stop call in `.catch(() => {})` (see finding #10) and deletes the `Deployment` row regardless of whether the stop succeeded.

Net effect: every time a customer "deletes" a one-click catalog app (WordPress, n8n, Redis, MongoDB, Grafana, Uptime Kuma, Supabase-lite, LiveKit, Hermes), the application record disappears from the platform while the actual multi-container stack and its volumes almost certainly keep running on the node indefinitely — an invisible, unbounded resource leak with no code path that can ever clean it up afterward.

*Fix:* add a discriminator (`deploymentType`/`isCompose`) so the generic delete route can branch to the compose-project teardown endpoint (using the stored compose project name) instead of the single-container path for catalog deploys. Wire up the compose logs endpoint too if catalog-app log viewing is expected to work.

---

**#9 — MEDIUM-HIGH — Config / known guardrail — systemic hard-delete on five order-linked entity types**
`routes/vps.ts:102`, `routes/email.ts:340`, `routes/livekit.ts:127`, `routes/managedDatabases.ts:198`, `routes/deployments.ts:463`

CLAUDE.md requires soft-delete (`isActive: false`) rather than hard-delete on entities with historical order references. All five of the above call `prisma.*.delete()` directly. `VpsProvision`, `SmtpAccount`, and `LiveKitProject` each have a `orderItemId @unique` FK straight to `OrderItem`; `Deployment` is tied to an `OrderItem` 1:1; `ManagedDatabase` has no `orderItemId` at all (see finding #4) but is still created via the same paid-order fulfillment flow. All five routes *do* have correct ownership checks before deleting — this is a data-retention/historical-integrity issue, not a cross-tenant one. Once one of these rows is hard-deleted, any `Order`/`OrderItem`/`Invoice` still referencing it via the Prisma relation simply resolves to `null`, losing the "what did this specific paid line item actually provision" trail — a real problem for refund disputes, support investigations, or accounting reconstruction later.

*Fix:* convert all five to soft-delete consistent with the documented guardrail, or explicitly document them as a reviewed, intentional exception.

---

**#10 — LOW-MEDIUM — Bug / resilience — silently swallowed container-stop failures before a hard delete**
`routes/managedDatabases.ts:190`, `routes/deployments.ts:457`

Both do `containerAction(...).catch(() => {})` / `stopDeployment(...).catch(() => {})` and then unconditionally proceed to delete the DB record. If the node-agent call fails (node offline, network blip, agent crashed), the DB record disappears while the actual Docker container keeps running — orphaned, un-owned, with no record left to ever clean it up. This interacts directly with finding #8: the same pattern is *why* catalog-app deletion has no safety net either.

*Fix:* don't delete the record if the stop call fails — mark it as needing manual cleanup (or retry via a queued job) instead of silently proceeding.

---

**#11 — MEDIUM — Bug / resilience — recurring jobs have no retry/backoff, and the billing sweep isn't fully failure-isolated per record**
`apps/api/src/worker.ts`, `apps/api/src/lib/billing.ts:63-130`

All four recurring jobs (SSL renewal, workspace cleanup, billing sweep, uptime sweep) are added via `queue.add(name, {}, { repeat: {...}, jobId })` with no `attempts`/`backoff` option — BullMQ defaults to `attempts: 1` (no retry). Each `Worker`'s `.on('failed', ...)` only calls `logger.error(...)`; none call `notifyAdmins()`/`notifyDiscordChannel()`, both of which exist and are used elsewhere in the codebase for exactly this purpose. A failed billing sweep is silent unless someone is actively watching structured logs.

Within `runBillingChecks()`, the `for (const sub of subscriptions)` loop has a `try/catch` **only** around the "stop the deployment" sub-step — not around the whole per-subscription body. If `decideSweepAction()` or the `updateMany()` call itself throws for one malformed record, the exception aborts the entire function, and every subscription later in the array is skipped for that run. Combined with the no-retry point above, one bad record can silently skip billing enforcement for the rest of the customer base until the next scheduled run.

*Fix:* wrap the whole per-subscription loop body in try/catch (log and continue, don't abort the batch); add `attempts`/`backoff` to the recurring `queue.add()` calls; wire the billing-sweep and SSL-renewal workers' failure handlers to an actual alert channel.

---

**#12 — MEDIUM — Bug — a latent "default-secret" fallback in the catalog auto-secret-generation chain**
`apps/api/src/routes/catalog.ts:641`

`envVars[dbMeta.secretKey] || generatedSecrets[dbMeta.secretKey] || 'default-secret'`. Traced the current key mapping: every `templateDbTypes` entry has a matching entry in `AUTO_GENERATED_SECRET_KEYS`, so this fallback is unreachable today. It's a landmine, though: the next template added without a matching auto-generation entry would silently get a shared, guessable password that's stored via `encryptSecret` and so *looks* like a real per-customer secret to anyone glancing at it.

*Fix:* remove the literal fallback; if a key is genuinely missing from both sources, generate a fresh strong random value inline rather than falling back to a static string.

---

**#13 — MEDIUM — Bug — `lib/backup.ts`'s restore path uses an unsafe shell-string pattern right next to a safe one**
`apps/api/src/lib/backup.ts` (see §1.1 above for context on the `validateIdentifier()` claim this is actually about)

`dumpDatabase()` correctly uses array-form `spawn('pg_dump', [...])` — no shell involved, immune to injection regardless of input. `restoreBackup()`, one function below it, builds a literal shell string via template interpolation (`` `gunzip -c | psql -h ${host} -p ${port} -U ${user} -d ${dbName}` ``) and runs it via `spawn('sh', ['-c', restoreCmd], ...)` — the classic unsafe pattern, using the *same four variables* the safe function above it uses correctly. Currently not exploitable: `host`/`port`/`user`/`dbName` all come from parsing `env.databaseUrl` (operator-controlled config, not user input), and `restoreBackup()` is never actually called anywhere in the codebase today.

*Fix:* before anyone wires up a restore endpoint or a "restore to a different database" feature, switch this to the same array-form/no-shell pattern used by `dumpDatabase()`.

---

**#14 — Testing coverage cross-reference**

| Suite | Run by CI? | Notable coverage |
|---|---|---|
| `tests/unit/*.test.ts` (15 files) | Yes (nominally — see finding #1) | `billingRules`, `audit_fixes`(`_v2`), `team_invites`, several `*.property.test.ts` files. No file covers secrets-vault round-tripping, provisioning idempotency, or the internal-bot review-payment path. |
| `tests/integration/*.test.ts` (2 files) | **No** | `roleGuards.test.ts` — the file most directly responsible for verifying authorization/ownership-scoping logic across the API — exists **only** here. |
| `apps/api/src/routes/*.test.ts` (10 files, vitest) | **No** | `payments.test.ts` covers the atomic-CAS double-approval logic confirmed correct in finding #4 — real coverage exists, just not where CI can see it. `smtp.test.ts` likely covers (or should cover) the SSRF gaps in finding #5. |

Zero coverage in **any** of the three suites for: `secretsVault.ts`'s encrypt/decrypt round-trip and key derivation, `orderFulfillment.ts`'s provisioning/idempotency logic, `internalBot.ts`'s shared-secret verification, `nodes.ts`'s cluster registration, the `supabase.ts` raw-SQL endpoint, and `worker.ts`'s scheduling/retry behavior. Billing, auth/RBAC, provisioning, and cross-tenant scoping each have *some* real coverage somewhere in the repo — concentrated almost entirely in the two suites CI doesn't run, while the one suite CI does run is both thinner on these exact topics and (per finding #1) not currently completing successfully end-to-end.

---

### 1.3 Dependency audit (`npm audit`, full workspace install)

32 vulnerable packages, 14 high severity, no criticals reported.

| Package | Relevance |
|---|---|
| `dockerode` (^4.0.2, **direct** dependency of `services/node-agent`) | In the vulnerable range 3.0.0–4.0.12; fix requires a major bump to 5.0.1. This is the library node-agent uses for all direct Docker control on customer nodes. |
| `tar-fs` (transitive via `dockerode`) | 3 separate high-severity advisories, all symlink-validation-bypass / path-traversal-during-extraction — the same bug class this entire audit is focused on, just at the dependency layer rather than in the (correctly fixed) first-party `filesystem.js`. Worth checking whether `dockerode`'s internal `tar-fs` usage ever touches customer-influenced paths. |
| `next` (^14.2.35, both `apps/web` and `apps/dashboard`) | Matches a wide vulnerable range with real high-severity SSRF-in-Server-Actions/rewrites, cache-poisoning, and DoS advisories. Recommend upgrading to the current patched line. |
| `ip-address` (≤10.3.0) | 3 advisories, all specifically "can bypass SSRF and trust-boundary checks" — directly relevant if this package is ever used to harden finding #5. |

---

## 2. `services/node-agent`

Overall, this workspace is in noticeably better shape than the audit documents' tone implies, with the one glaring infrastructure-level exception below.

- **Path traversal (`filesystem.js`) — confirmed fixed.** `resolveSafe()` applies `path.basename()` to `deploymentId` and normalizes backslashes to forward slashes on `relPath` *before* the containment check, closing both the identifier-level and sub-path-level vectors the prior audit described.
- **Shared-secret auth — confirmed fixed.** Hard `process.exit(1)` at boot if `NODE_AGENT_SECRET` is unset; the comparison is HMAC-then-`timingSafeEqual` (not a naive length/byte compare); a loud, correctly-worded startup warning fires if bound to `0.0.0.0` with no `AGENT_ALLOWED_IPS` set (see finding #4, though — this warning is currently being ignored by the actual deployment config).
- **No shell-injection surface anywhere checked.** Every exec path in this service (`docker.js`, `cockpit.js`, the compose handlers in `index.js`) consistently uses `execFile`/`spawn` with argument arrays, never a shell string. `cockpit.js` additionally validates `username`/`groupname`/`serviceName` against strict allowlist regexes before use. The compose project-name sanitization (`projectName.replace(/[^a-z0-9-]/gi, '-')`) is applied consistently and independently on every route that derives a project directory from it, correctly blocking path traversal via that vector.
- `docker.js` uses the `dockerode` library directly for container lifecycle rather than shelling out — see the dependency-audit note above regarding `dockerode`/`tar-fs`.

No first-party null-safety or unhandled-exception issues were found in this workspace beyond what's already covered by the auth/traversal points above.

---

## 3. `apps/dashboard`

- Firebase Auth token handling follows the standard, correct pattern (the SDK manages its own token storage/refresh; the app calls `getIdToken()` fresh per request rather than manually persisting the raw token). `localStorage` is used only to cache non-sensitive profile display data and per-project SQL query history for UX purposes.
- No hardcoded dummy-data arrays were found in components (the CLAUDE.md guardrail against this appears to be honored — data is fetched, not seeded).
- `next: ^14.2.35` — see the dependency-audit note in §1.3.
- Given time constraints, this workspace did not receive the same line-by-line depth as `apps/api`; the check here was targeted at the specific guardrails named in the brief (dummy data, secret exposure, auth token handling) rather than an exhaustive component-by-component review.

---

## 4. `apps/web`

- Public marketing/informational site (about, contact, docs, pricing, privacy, status, terms). No non-`NEXT_PUBLIC_` server secrets found referenced from client-evaluated code.
- `next: ^14.2.35` — same dependency note as above.
- Low residual risk given the lack of authentication or sensitive data on this surface; reviewed at lighter depth accordingly.

---

## 5. `services/discord-bot` + `services/whatsapp-bot`

**#15 — CRITICAL — Security / cross-tenant — Discord slash commands have no code-level authorization check; `/review-payment` lets any server member approve or decline any customer's payment**
`services/discord-bot/src/slashCommands.js`

None of the four registered commands (`status`, `deployments`, `tickets`, `review-payment`) call `.setDefaultMemberPermissions(...)` on their `SlashCommandBuilder`, and `handleInteraction()` never checks `interaction.user`/`interaction.member`/`interaction.memberPermissions` against any staff allowlist before acting.

`/review-payment` calls `POST /api/internal/review-payment` (the same operation covered in finding #4) with `approve` set directly from whatever the invoking Discord user selected. Nothing on either side — bot or API — verifies that the invoking Discord user is actually authorized staff; `reviewedBy` is purely a display label for the resulting message, never checked against anything. The API route authenticates the *request* as genuinely coming from the bot process (via the shared `x-internal-secret`), but has no concept of, and performs no check on, *which Discord user* triggered it.

Net effect: any member of whatever Discord server the bot is installed in — unless a server admin has separately and manually configured Discord's own out-of-band Integrations UI to restrict the command — can approve or decline any customer's payment, triggering real container/database provisioning for free, or maliciously declining a legitimate paying customer. This is a privileged financial action with zero application-level authorization. The same root cause, at lower individual severity, means `/deployments` and `/tickets` return cluster-wide data across every customer (deployment placement; ticket subjects plus customer emails) to any user who can invoke the command.

*Fix:* enforce this in code, not Discord configuration — set `.setDefaultMemberPermissions(...)` on the sensitive commands **and** independently check the invoking user against a maintained staff allowlist inside `handleInteraction()`. Have `internalBot.ts`'s `/internal/review-payment` independently verify the reviewing Discord user ID (already available on the interaction payload) against a staff table, rather than treating "request came from the bot process" as equivalent to "an authorized human approved this."

---

**#16 — HIGH — Bug (event-driven null/lifecycle handling) — the WhatsApp bot's inbound command handler silently stops working after the first reconnect**
`services/whatsapp-bot/src/index.js:69-96`, `services/whatsapp-bot/src/connection.js:40-78`

The interactive inbound-message listener (`sock.ev.on('messages.upsert', ...)`) is registered exactly once, inside the `.then()` callback of the single top-level `connect()` call made at process startup. `connection.js`'s `connect()` is also invoked recursively on every reconnect (`setTimeout(connect, 5000)`, inside the close-event handler) — entirely internally, with nothing re-attaching `index.js`'s listener to the new socket. On any reconnect (an ordinary, expected event for a long-running session, not a rare edge case), `connect()` explicitly strips all `messages.upsert` listeners from the old socket before replacing the module-level socket reference with a new instance. The old listener is never re-added anywhere.

Effect: outbound notifications keep working indefinitely (`sendNotification`/`getSocket` always read the live module-level socket), but the bot silently and permanently stops responding to inbound WhatsApp commands after the very first reconnect — no error, no log line, nothing crashes. The asymmetry (outbound fine, inbound silently dead) makes this easy to miss in testing immediately after a deploy.

*Fix:* move the `messages.upsert` registration inside `connection.js`'s `connect()` function itself, alongside `creds.update`/`connection.update`, so it's re-attached on every new socket rather than bound once to a single point-in-time reference.

---

Beyond the two findings above, both bot services correctly fail hard at startup if their respective internal secrets are unset, and both use timing-safe HMAC comparison for their internal HTTP endpoints (`/internal/status`, `/internal/send`). The WhatsApp inbound-message handler itself has proper null guards (`if (!msg.message || msg.key.fromMe) continue;`) and wraps processing in try/catch with real logging, not a swallowed `catch {}`.

---

## 6. `packages/*` (first-party only)

Reviewed: `packages/auth` (customer-facing SDK auth/token storage), `packages/client` (HTTP client base), `packages/catalog`, `packages/deployments` (including `WebhookHelper.ts`), `packages/node-agent`, `packages/tracing`, `packages/types`.

- No first-party code was found patching or working around the vendored Supabase SDK packages (`supabase-js`, `postgrest-js`, `realtime-js`, `storage-js`, `auth-js`, `functions-js`) — a search for imports of those packages outside their own directories returned nothing, so there was nothing to audit at the integration boundary per the brief's scoping.
- `packages/types` does appear to be the genuine single source of truth — no duplicated local interface definitions matching the shared entity shapes (`Deployment`, `Order`, `User`, etc.) were found re-declared in any `apps/*` workspace.
- The SDK client code is generic, thin, and typed; no hardcoded secrets or obvious logic issues found. `packages/deployments/src/WebhookHelper.ts` is a thin fetch wrapper (`getInfo()`), not a signature-verification helper — worth noting as a documentation/DX gap for SDK consumers who might expect this package to help them verify incoming webhook signatures, but not itself a vulnerability.

This workspace received comparatively light-touch review given its low first-party surface area and the explicit instruction to skip auditing the vendored SDKs' own internals.

---

## 7. `apps/mobile-admin`

Confirmed excluded from the root npm workspace (`!apps/mobile-admin` in root `package.json`) and confirmed this matters in practice, not just in theory:

- `.github/workflows/ci.yml` (read in full) has no step of any kind — install, typecheck, lint, or test — for this workspace. It has **zero CI coverage.**
- Running `tsc --noEmit` against the state left by a root-only `npm install` (i.e., what any contributor following the documented root workflow would end up with) produces roughly 20 "cannot find module" errors, since this workspace's own dependencies were never installed.
- Installing this workspace's dependencies directly and re-running `tsc --noEmit`: **zero errors.** The app's own code is currently type-clean; the actual, standing problem is that nothing in the repository's tooling would ever catch it if that stopped being true.
- `src/lib/firebase.ts`'s placeholder Firebase config values are honestly commented as intentionally unconfigured rather than a silent stub — this is the "genuinely fine" case, not a hidden problem, though the app cannot authenticate against anything until real values are supplied via `app.json`'s `extra` block.

*Fix:* add a separate install+typecheck (and lint, if configured) CI step scoped to `apps/mobile-admin`.

---

## 8. `templates/` and `infra/`/`docker/` configs

**Templates (`templates/*.yaml`, all 9 files checked): credentials — confirmed fixed; resource limits — not addressed.**

Every template (`grafana`, `hermes-agent`, `lavalink`, `livekit`, `mongodb`, `n8n`, `redis`, `supabase-lite`, `wordpress`) consistently uses the fail-loud `${VAR:?VAR must be set}` pattern for every credential — no hardcoded default passwords or admin credentials were found anywhere across all 9 files. `uptime-kuma.yaml` correctly has no credential variable at all (Uptime Kuma sets up its admin account via a first-run web wizard, not an env var), which is expected, not an oversight.

However: **none of the 9 templates define any CPU or memory limit** (`deploy: resources:`, `mem_limit`, `cpus:`) at all. On a platform where these containers run on shared, multi-tenant VPS nodes, this means a single customer's one-click deployment (of any of the 9 available apps) has no ceiling on the resources it can consume, creating a straightforward noisy-neighbor / resource-exhaustion risk against every other customer's deployments on the same physical node. This is the one half of the brief's explicit "placeholder passwords ... or missing resource limits" check that turned up a real, systemic finding.

*(Minor, availability-only note: `uptime-kuma.yaml` sets a static default `container_name: ${UPTIME_KUMA_CONTAINER_NAME:-uptime-kuma}`. If the platform doesn't override this per-deployment, a second customer's Uptime Kuma deploy landing on the same physical node as an existing one would fail outright with a Docker container-name collision — a reliability bug, not a security one.)*

*Fix:* add `deploy.resources.limits` (or the legacy `mem_limit`/`cpus` equivalents, depending on the Compose version actually used at deploy time) to every template, sized appropriately per the plan/tier the customer purchased.

---

**#17 — CRITICAL — Security / config — the node-agent's HTTP API is published to the public internet by the production infra-as-code, contradicting the service's own startup warning**
`infra/node-stack/docker-compose.yml:52-53`

```yaml
node-agent:
  ...
  ports:
    - "5000:5000"
```

Docker's short port-mapping syntax with no explicit bind address binds to `0.0.0.0` on the host by default — every network interface, including the VPS's public IP, unless an external cloud firewall or security group separately blocks it (nothing in this repository does that, and it can't be assumed to exist). This directly contradicts node-agent's own code (`services/node-agent/src/index.js:921-926`, confirmed present and correctly worded in §2 above), which explicitly logs at startup that being bound to all interfaces with no IP allowlist configured "must not be reachable from the public internet." **The infrastructure-as-code that actually deploys this service to every VPS node does exactly the thing that warning exists to catch.**

For contrast, the Traefik service in the same file mounts `docker.sock` read-only (`:ro`); node-agent mounts the same socket read-write, since it genuinely needs to create and manage containers. Combined with the public port exposure, the blast radius of any future auth bypass or RCE in node-agent — a service with full filesystem, Docker, and SSH-terminal control over every customer's containers on that node — is unauthenticated, full host compromise, reachable directly from the internet rather than requiring prior lateral network access. node-agent has no rate limiting of its own beyond the (correctly implemented, timing-safe, no-fallback) shared-secret check, so this is also an unthrottled brute-force/DoS surface as things stand.

*Fix:* bind to a private address only (`"127.0.0.1:5000:5000"` if node-agent is only ever called from the same host) or, better, don't publish the port via Docker at all — put node-agent on the existing `shanutechx-internal` network and have `apps/api` reach it over a private network path (VPN/WireGuard mesh or equivalent) instead of a host-public port. At minimum, set `AGENT_BIND_HOST`/`AGENT_ALLOWED_IPS` (both already supported by the code) in the node-stack's `.env` — but the port publication in the compose file is the actual root cause and should be fixed directly, not just muted.

---

**#18 — MEDIUM — Security — hardcoded, publicly-known default encryption key in `infra/control-plane/docker-compose.yml`**
`infra/control-plane/docker-compose.yml:435`

```yaml
DB_ENC_KEY: supabaserealtime
```

Every other credential in this file (`JWT_SECRET`, `SUPABASE_DB_PASSWORD`, `MINIO_ROOT_PASSWORD`, `SUPABASE_REALTIME_SECRET`, etc.) is correctly parameterized via `${VAR}`. This one value is a bare literal — and it happens to be the exact placeholder published in Supabase's own official self-hosting example compose files, meaning it's identical across a large number of unrelated deployments, not unique to this one.

*Fix:* parameterize as an env var and generate a real random value per deployment, the same way `SUPABASE_REALTIME_SECRET` immediately below it already is.

---

No other hardcoded credentials, debug ports, or verbose-logging-in-prod settings were found across the remaining docker-compose files checked (`docker/supabase/docker-compose.yml`, `infra/control-plane/observability/docker-compose.observability.yml`) within the time available for this pass.

---

## Summary table: new findings vs. re-confirmed vs. regressed vs. unverifiable

| Status | Count | Items |
|---|---|---|
| **Re-confirmed genuinely fixed** | 15 | C1, C2, C3, C4, C5, C6, C7, H2 (code-level only — see #17), H5, H6 (structurally), H7, H9, M1, M6, M7, M8 (for its original target) |
| **Claim references non-existent code (not confirmable either way)** | 3 | C3/C5/C11-style items about `routes/auth.ts` / `lib/jwt.ts` (file doesn't exist); Part 3's `managedDatabases.ts`/`projects.ts` `validateIdentifier()` claim (feature doesn't exist under that name); `discordWebhookConfig.ts` `x-internal-secret` claim (file is an unrelated config route) |
| **New — Critical** | 4 | #1 CI test suite likely broken end-to-end; #8 catalog apps likely can't be torn down; #15 Discord commands have no authorization; #17 node-agent port published to the internet |
| **New — High** | 5 | #3 trivially-true regression test; #4 payment-approval race in `internalBot.ts`; #5 incomplete SSRF blocklist; #6 unrestricted raw-SQL fallback; #16 WhatsApp bot listener lost on reconnect |
| **New — Medium / Medium-High** | 7 | #2 test hardcodes prod domain; #7 dead duplicate route + mock panel data; #9 systemic hard-delete guardrail violation; #11 job retry/isolation gaps; #12 latent default-secret fallback; #13 unsafe-but-unreachable shell pattern in backup restore; #18 hardcoded Supabase Realtime key |
| **New — Low/Medium** | 2 | #10 swallowed container-stop failures; templates' missing resource limits (systemic, all 9) |
| **Same class of bug found again, in a new location** | 2 | `supabase.ts`'s dead duplicate route (same failure mode as the already-fixed `settingsRouter` double-mount); the node-agent port-exposure issue is the same underlying risk H2's code-level fix was meant to address, just left live one layer up in the infra config |

---

## Checklist: items needing a manual or business decision

- [ ] **Confirm in a real GitHub Actions run** that fixing the CI env block (finding #1) actually turns the pipeline green — this was reproduced faithfully in a local sandbox but a live confirmation is the real proof.
- [ ] **Decide who "dev" role should really be equivalent to admin for** — several of this audit's higher-severity items (`POST /supabase/db/query`, the secrets vault, node registration) all key off the same `requireAdminOrDev` gate, which is applied consistently but is a broad grant. Worth an explicit decision on whether any of these should be true-admin-only.
- [ ] **Decide whether catalog one-click apps are meant to be deletable by customers today** — if yes, finding #8 needs to ship before launch; if the feature is intentionally "create-only for now," that should be stated in the UI rather than silently failing/orphaning resources.
- [ ] **Decide the actual network topology for node-agent** (finding #17) — this is an infrastructure decision (private networking / VPN mesh vs. a narrower firewall rule) that needs a real answer, not just a code change, since it affects how every current and future VPS node is provisioned.
- [ ] **Decide on the Discord bot's staff-permission model** (finding #15) — whether to hardcode a staff Discord ID allowlist in the bot, use Discord's role/permission system enforced in code, or some combination, and whether `/review-payment` should require a second factor given it's a real financial action.
- [ ] **Decide the resource-limit tiers for catalog templates** — this needs product/plan input (how much CPU/RAM should a "Redis" or "WordPress" deploy get on the Basic vs. Pro plan), not just an engineering fix.
- [ ] **Decide whether the 5 order-linked entities should move to soft-delete** (finding #9) or whether hard-delete is an accepted, intentional trade-off for those specific resource types — and if the latter, document it as such so it doesn't get re-flagged as a regression later.
- [ ] **`lib/subdomain.ts`'s `validateCustomSubdomain()`** was confirmed to exist but not independently re-derived for correctness given time constraints — worth a follow-up pass specifically on subdomain-takeover/collision logic.
- [ ] **Upgrade `next` and `dockerode`/`tar-fs`** (dependency audit) — both are breaking/major-version bumps that need scheduling and regression testing, not just a version bump.
