# ShanuTechX — Full Codebase Audit & Implementation Plan

**Scope reviewed:** `apps/api` (Express backend, 45+ route files, ~55 lib files), `apps/dashboard` (Next.js 14 admin/customer portal), `apps/web` (Next.js 14 marketing site), `apps/mobile-admin` (Expo/React Native), `services/whatsapp-bot`, `services/discord-bot`, `services/node-agent`, `packages/db` (Prisma schema/migrations), root Docker Compose, CI workflows, and env configuration across all apps.

Follow-up pass added deep review of `leaseweb.ts` (24 routes), `gitConnect.ts`, and `filesystem.ts`'s git-push path. A third pass covered the remaining `apps/api` route files (`nodes.ts`, `domains.ts`, `orders.ts`, `projects.ts`, `projectAuth.ts`, `sms.ts`, `cms.ts`, `containers.ts`, `discordWebhookConfig.ts`), plus cross-referenced the real `services/node-agent` HTTP routes against both `apps/api`'s internal client and the published `@shanutechx/node-agent` npm SDK package. A fourth pass covered the self-hosted app catalog (`templates/*.yaml` + `lib/catalog/*`), the `apps/api` Dockerfile, and the remaining SDK packages (`packages/client`, `packages/auth`, `packages/deployments`, `packages/types`, `packages/tracing`).

**Not deep-audited:** the vendored copies of the open-source Supabase client libraries under `packages/{postgrest-js,auth-js,realtime-js,storage-js,functions-js,supabase-js}` (these are third-party code, not ShanuTechX's own), and `templates/` / `templates_removed_phase15/` (self-hosting app catalog YAML definitions — spot-checked, not line-by-line).

**Overall impression:** the core billing, RBAC, and deployment-pipeline code is genuinely well engineered — timing-safe secret comparisons, a documented and mostly-consistent ownership/scoping model (Phase 15 "scoped admin"), good test coverage on the pure logic (`billingRules`, `env-validator`, property tests). The problems cluster tightly in a handful of **admin-panel "feature" modules that were stubbed with in-memory demo data and never finished**, plus a few **infrastructure/config gaps** that would only surface at deploy time. That combination — solid core, unfinished edges — is good news: the fix list below is concentrated, not spread evenly across the whole codebase.

---

## 🔴 Critical

### C1. Real secrets are present in this archive
`apps/api/.env` (and to a lesser extent `apps/dashboard/.env`, `apps/web/.env`) contain what appear to be live values, not placeholders — a full PEM-format Firebase private key, a Postgres connection string, Cloudflare API token, Firebase Realtime DB URL, and multiple internal shared secrets (`SECRETS_ENCRYPTION_KEY`, `PROJECT_AUTH_JWT_SECRET`, `BILLING_CRON_SECRET`, etc.), all with realistic-length values rather than the `.env.example` placeholders.

- **Impact:** anyone who receives this zip now has your database credentials, Firebase admin identity, and every internal service secret.
- **Fix:**
  1. Treat every value in `apps/api/.env` as compromised. Rotate: the Firebase service-account key (regenerate in Firebase Console and revoke the old one), `DATABASE_URL` password, `CLOUDFLARE_API_TOKEN`, `SECRETS_ENCRYPTION_KEY`, `PROJECT_AUTH_JWT_SECRET`, `NODE_AGENT_SECRET`, `WHATSAPP_INTERNAL_SECRET`, `DISCORD_INTERNAL_SECRET`, `SMS_WEBHOOK_SECRET`, `BILLING_CRON_SECRET`.
  2. Rotating `SECRETS_ENCRYPTION_KEY` means every existing encrypted value in the DB (SMTP passwords, VPS root passwords, LiveKit secrets, git tokens, OAuth client secrets — see C-cluster below) becomes undecryptable. Write a one-off migration script that decrypts with the old key and re-encrypts with the new one *before* rotating, or budget for customers re-entering credentials.
  3. Check `git log` / any git history bundled elsewhere for this repo — if `.env` was ever committed and later just added to `.gitignore`, the values are still in history and rotation is non-negotiable regardless of what you do here.
  4. Going forward: never zip/export a working directory without excluding `.env`; use `.env.example` + a secrets manager for anything shared.

### C2. `GET /api/supabase/config` leaks the Supabase service-role key to any authenticated user
`apps/api/src/routes/supabase.ts:487` — every other route in this file requires `requireAuth, requireAdminOrDev`. This one route only has `requireAuth`:
```ts
supabaseRouter.get('/supabase/config', requireAuth, async (_req: AuthedRequest, res: Response) => {
  res.json({ supabaseUrl: SUPABASE_KONG_URL, anonKey: SUPABASE_ANON_KEY,
             serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY, ... });
});
```
Any logged-in **customer** (not just admin/dev) can call this and receive the Supabase `service_role` key — the highest-privilege credential in a Supabase stack, capable of bypassing all Row Level Security.
- **Fix:** add `requireAdminOrDev` to this route. One-line fix, do it first.

### C3. `/api/webmail/*` is a single global, unscoped message store — cross-tenant IDOR
`apps/api/src/routes/webmail.ts` — `messagesStore` is one `Map` shared by every user of the platform. No route filters by `userId`/`smtpAccountId`:
```ts
webmailRouter.get('/webmail/messages/:id', (req, res) => {
  const msg = messagesStore.get(id);   // any authenticated user, any id
  ...
});
```
Any authenticated customer can read, mark-read, or delete **any other customer's** webmail messages simply by guessing/enumerating message IDs (`msg_in_01`, `msg_sent_1234...`). Right now the store is seeded with demo content only, so the live blast radius is small — but this is wired up as if it were the real feature (there's a working `POST /webmail/send` that actually calls SMTP), and the product clearly intends this to become real customer email.
- **Fix:** before this goes anywhere near real mail, back it with a `WebmailMessage` Prisma model scoped by `smtpAccountId`/`userId`, and apply `ownedResourceWhere`/`verifyResourceOwnershipAsync` the same way `email.ts` and `smtp.ts` already do correctly.

### C4. `/api/settings/verify-password` has a built-in bypass; `/change-pin` has a hardcoded master override
`apps/api/src/routes/settings.ts` gates the dashboard's "Settings Protection" screen (`PasswordLockGuard.tsx`, used to re-confirm identity before viewing Secrets/SMTP/system config):
```ts
} else {
  // Default fallback verification...
  isValid = inputPass === '123456' || inputPass === 'admin'
         || inputPass === req.user!.email || inputPass.length >= 4;
}
```
With no `SETTINGS_PIN`/`DEV_PIN` env var and no custom PIN set (the default state), **any string 4+ characters long unlocks it.** And in `/change-pin`:
```ts
if (currentPin !== existingPin && currentPin !== '123456' && currentPin !== 'admin') {
  return res.status(401)...
}
```
`'123456'`/`'admin'` work as a master override to overwrite a PIN *even after* a real custom PIN has been set — and the PIN itself lives only in an in-memory `Map`, so it's forgotten on every restart, silently re-opening the "any 4-char string" hole.
- **Note on real severity:** this only gates already-authenticated admin/dev users re-confirming their identity — it is not a path from `customer` to `admin`. But it's the one line of defense the product explicitly markets as protecting "sensitive system configurations," and it currently protects nothing.
- **Fix:** remove the length≥4 / `'123456'` / `'admin'` fallbacks entirely; require an explicitly configured PIN (fail closed, not open, when unset — e.g. refuse to unlock and tell the admin to set one). Persist the per-user PIN in the DB (`User` or a small `SecurityPin` table), hashed, not in memory.

### C5. The node-registration "cluster secret" has a hardcoded fallback — and this archive's real `.env` uses that exact fallback value
`apps/api/src/routes/nodes.ts:9`:
```ts
const CLUSTER_SECRET = process.env.NODE_AGENT_SECRET
  || 'f1e2d3c4b5a697887766554433221100abcdef1234567890abcdef1234567890';
```
This secret is what authenticates `POST /api/nodes/register` — a **deliberately public, pre-auth endpoint** (by design: a brand-new bare VPS running `install.sh` has no platform login yet, so it can only prove itself via this shared secret). Whoever holds this value can register an arbitrary, attacker-controlled server as a trusted compute node — one the control plane will then deploy real customer container workloads onto (customer source code, build-time env vars/secrets, and per H2, possibly database-container provisioning).

This would already be worth flagging as a landmine if the env var were ever left unset. But it's worse here: **`apps/api/.env` in this archive sets `NODE_AGENT_SECRET` to this exact same hardcoded literal value** — i.e. this isn't a hypothetical fallback, it's (as shipped) the actual secret protecting node registration, and it's now known to anyone who has this codebase. Also, like H4/H2, the comparison is `!==` rather than `crypto.timingSafeEqual`.
- **Fix:** on top of the general secret rotation in C1, treat `NODE_AGENT_SECRET` as maximum priority — generate a fresh, high-entropy value with no hardcoded fallback at all (fail to start the API, or refuse `/nodes/register` entirely, if the env var is unset — never default to a baked-in literal). Switch the comparison to `timingSafeEqual`. Audit `Node` table entries for any registrations you don't recognize before rotating, in case this was already exploited.

### C6 (functional, not security). Live deployment resource-usage metrics are completely broken — the API calls a node-agent endpoint that doesn't exist
`apps/api/src/lib/nodeAgentClient.ts:208`'s `getResourceUsage()` — used by `GET /api/deployments/:id` to show live CPU/memory/storage usage on a deployment's detail page ("Requirement 17.7: Display resource usage metrics") — calls:
```
GET /agent/deployments/${containerId}/metrics
```
**No such route exists anywhere in `services/node-agent/src/index.js`.** The real service defines `/agent/stats` (node-wide hardware stats) and per-container start/stop/restart/logs routes, but nothing under `.../metrics`. Every call to this endpoint will 404. `deployments.ts:311` catches the failure and gracefully falls back to `resourceUsage: null`, so nothing crashes — but this means the resource-usage panel is **permanently empty** for every customer and admin, for every deployment, with only a `logger.warn` as the trace.

This is exactly the kind of bug automated tests can hide rather than catch: `deployments-resource-metrics.test.ts` (and the `getResourceUsage` unit tests) mock `getResourceUsage` itself (`vi.mock(... getResourceUsage: vi.fn())`) rather than exercising a real or fake HTTP server — so the test suite is green while the real wire contract between the two services is broken. The two sides of this contract (the Express routes in `services/node-agent` and the client that calls them in `apps/api/src/lib/nodeAgentClient.ts`) drifted out of sync with no integration test to catch it.
- **Fix:** add a real `GET /agent/deployments/:containerId/metrics` route to `services/node-agent/src/index.js` (likely `docker stats` for the container, shaped into the `ResourceMetrics` type already defined in `nodeAgentClient.ts`), then add at least one integration-style test that spins up the real Express app (or an equivalent lightweight fake) rather than mocking the client function, so a future path mismatch between these two services fails CI instead of shipping silently.

### C7 (functional). The self-hosted app catalog ("one-click deploy WordPress/n8n/MongoDB/Redis/Lavalink/LiveKit") is completely non-functional in the production Docker image — the `templates/` directory is never copied into the container
Two different modules both read the six `templates/*.yaml` catalog definitions straight off disk at request time (5-minute in-memory cache, not bundled at build time):
```ts
// apps/api/src/lib/catalog/catalog-manager.ts
const TEMPLATES_PATH = path.resolve(__dirname, '../../../../../templates');
// apps/api/src/routes/catalog.ts
const TEMPLATES_DIR = path.resolve(process.cwd(), '../../templates');
```
`apps/api/Dockerfile`'s final `runner` stage copies `node_modules`, `packages/db`, `apps/api/dist`, and `apps/api/package.json` — **but never `templates/`**. Since `WORKDIR /repo/apps/api` and `CMD ["node", "dist/index.js"]`, `process.cwd()` at runtime is `/repo/apps/api`, so `catalog.ts`'s `../../templates` path is directionally correct (`/repo/templates`) — it's just that nothing ever put a `templates/` folder at `/repo` inside the built image. Both catalog readers will get `ENOENT`/an empty listing in any deployment built from this Dockerfile, meaning the entire self-hosted-app catalog feature — arguably a headline feature of a VPS/app-hosting platform — returns empty or errors for every customer, in production, 100% of the time.
- As a secondary, lower-priority issue: the two modules resolve the same directory two different ways (`__dirname`-relative vs. `process.cwd()`-relative). They happen to agree given this Dockerfile's specific `WORKDIR`, but that's incidental, not intentional — a future change to either the Dockerfile's `WORKDIR` or how the process is launched (e.g. via a process manager that changes `cwd`) would silently break `catalog.ts` while `catalog-manager.ts` keeps working, or vice versa. Pick one strategy for both.
- **Fix:** add `COPY templates ./templates` (relative to the repo-root build context) to the Dockerfile's `runner` stage. Then unify both readers to the same `__dirname`-relative resolution (more robust than `process.cwd()`, which depends on how the process happens to be launched). Add a startup-time check/log (not just a 5-minute-cache silent empty array) so this class of bug fails loudly next time instead of shipping silently.

### Note: the templates themselves ship weak, guessable default credentials, and expose every service directly to the host
Once C7 is fixed and the catalog actually works, worth fixing before it does: all six `templates/*.yaml` files (`wordpress.yaml`, `n8n.yaml`, `mongodb.yaml`, `redis.yaml`, `lavalink.yaml`, `livekit.yaml`) fall back to a **hardcoded, weak, now-public default password** if the deploying customer doesn't override the relevant env var — e.g. `MYSQL_ROOT_PASSWORD:-wordpress_root_secret_2026`, `MONGO_INITDB_ROOT_PASSWORD:-change_me_mongo_pass_2026`, `REDIS_PASSWORD:-change_me_redis_secret`, `LAVALINK_SERVER_PASSWORD:-AeroX`, `LIVEKIT_KEYS=devkey:secretkey`. Every one of these templates also publishes its service port straight to the host (`ports: "6379:6379"`, `"27017:27017"`, etc.) rather than routing through the platform's Traefik/TLS layer, so a customer who deploys any of these without immediately setting a real password gets an internet-reachable database/cache/media server with a widely-known default credential.
- **Fix:** drop the weak literal fallbacks — either require these env vars with no default (fail the deploy with a clear "set REDIS_PASSWORD" error) or auto-generate a strong random value per-deployment if the customer leaves it blank, and surface the generated value back to them once. Consider not publishing raw ports by default for anything that isn't meant to be public-facing (databases, caches) — bind to the node's internal Docker network only and let the customer opt into external exposure explicitly.

---

## 🟠 High

### H1. Multiple "admin panel" features are pure in-memory mocks with no persistence
This is the single biggest pattern in the codebase and violates the project's own stated guardrail in `CLAUDE.md` ("Avoid hardcoded dummy data arrays in production components... use dynamic database queries"). All of the below reset to their seed data on every restart/redeploy, and — because Node processes don't share memory — are **inconsistent across multiple API instances** if you ever scale horizontally:

| File | What's mocked | Also missing |
|---|---|---|
| `routes/secrets.ts` | Entire "Secrets Vault" project/secret/audit-trail feature (`secretProjects`, `auditTrail` Maps/arrays) | Not wired to the app's own `encryptSecret`/`decryptSecret` (`lib/secretsVault.ts`) that every other credential-handling route uses correctly |
| `routes/supabase.ts` | Client projects, SMTP config, email templates, delivery logs (`clientProjectsStore`, `smtpConfig`, `emailTemplatesStore`, `smtpDeliveryLogsStore`) | Falls back to **fabricated fake success data** ("Query executed", a fake `users` table with 24 rows, a fake `avatars` bucket) whenever the real Supabase Meta/Kong backend is unreachable, instead of surfacing an error — an admin could believe a DB query or bucket creation succeeded when it silently didn't |
| `routes/knowledgebase.ts` | Full article CRUD (`let articles = [...SEEDED_ARTICLES]`) | No `KbArticle`/`KbCategory` Prisma model exists at all |
| `routes/smtp.ts` | Platform-wide outbound SMTP config (`globalSmtpConfig`), and `accountDetailsStore` (per-account custom domain/aliases) | — |
| `routes/email.ts` | `emailDomainStore` (per-account custom email domains) | — |
| `routes/webmail.ts` | See C3 above | — |

- **Fix:** for each, add the corresponding Prisma model + migration, and swap the `Map`/array reads-writes for `prisma.*` calls. `email.ts`/`smtp.ts`'s *account* CRUD already does this correctly for `SmtpAccount` — use those as the template. Priority order: Secrets Vault and Webmail first (security-sensitive + actively used), Knowledge Base and Supabase panel next.

### H2. Node-agent communication has no transport security and binds to all interfaces by default
`apps/api/src/lib/nodeAgentClient.ts:8` builds every request to a deployed VPS node as:
```ts
function agentUrl(node: Node, path: string) {
  return `http://${node.ip}:${env.nodeAgentPort}${path}`;   // plain HTTP, public IP
}
```
protected only by a static header (`x-agent-secret`). `services/node-agent/src/index.js` itself says in a comment *"This service must NEVER be exposed publicly — bind it to a private interface/VPN/overlay network"* — but the actual code does `app.listen(PORT, () => ...)` with **no host argument**, i.e. it binds `0.0.0.0` (all interfaces) by default. Since these are Leaseweb-provisioned VPS nodes (public IPs, not necessarily on a shared private network with the control plane), the realistic deployment is: build commands, environment variables (including customer secrets — see `buildAndRun`'s `envVars`), SSH-key registration, and DB-provisioning credentials all travel across the public internet in cleartext, protected only by one shared static secret that's compared with `!==` (not timing-safe — see H4).
- **Fix:** put node-agent behind mutual TLS or at minimum HTTPS with a private CA, or require a WireGuard/VPN overlay between control plane and every node and make the agent refuse to bind to a non-private address by default. Short-term mitigation: enforce an IP allowlist (control-plane IP only) at the OS firewall level as documented setup, and say so explicitly in the node-agent README/onboarding docs (currently it's just a code comment).

### H3. Docker-networking bug: WhatsApp/Discord bot notifications are silently broken under `docker-compose.local.yml`
`services/whatsapp-bot/src/index.js` and `services/discord-bot/src/index.js` both do:
```js
app.listen(PORT, '127.0.0.1', () => { ... });
```
Binding to loopback **inside a container** makes the service unreachable from *any* other container on the same Docker network — including via Docker Compose's own service-name DNS. But `apps/api/.env` (correctly, for Compose) sets:
```
WHATSAPP_BOT_URL=http://whatsapp-bot:4100
DISCORD_BOT_URL=http://discord-bot:4200
```
A request from the `api` container to `http://whatsapp-bot:4100` resolves to the right container but hits nothing listening on its external interface → connection refused. Because `lib/notifications.ts`'s `postInternal()` catches this and only logs a `warn`, **the failure is completely silent** — WhatsApp/Discord notifications will never be delivered in the provided Docker Compose stack, with no visible error to admins or customers.
- **Fix:** change both services to `app.listen(PORT, () => ...)` (bind all interfaces inside the container — the container boundary itself is the isolation, matching how `node-agent` already does it). Keep them off any public port mapping in Compose (see L-cluster below) since they should still only be reachable from `api` on the internal Docker network, not the host/internet.

### H4. `vps-plans.ts` and `catalog.ts` violate the project's own delete-safety guardrail; `secrets.ts`'s bypass values weaken node-agent's auth too
- `routes/vps-plans.ts:162` `DELETE /vps-plans/:id` and `routes/catalog.ts:452` `DELETE /catalog/:slug` both do a straight `prisma.*.delete()` with no fallback — if the plan/template has historical order references, this throws a Prisma FK-constraint error and the route returns a raw `500`. `CLAUDE.md` explicitly calls out **VPS Plans** as the guardrail-2 example ("gracefully set `isActive: false`... rather than crashing with foreign key constraint errors") — `routes/products.ts:109-131` implements this correctly (try hard-delete, catch, fall back to `isActive: false`, tell the admin why) and should be the template for both.
- `services/node-agent/src/index.js:43` compares the shared secret with `!==` rather than `crypto.timingSafeEqual` — every other internal-secret check in the codebase (`billing.ts`, `status.ts`, `backup.ts`, `deployWebhooks.ts`, `smsSignature.ts`) already uses the timing-safe HMAC-compare pattern; node-agent (arguably the most sensitive one, given H2) is the one place that doesn't.
- **Fix:** apply the `products.ts` deactivate-on-conflict pattern to `vps-plans.ts` and `catalog.ts`; switch node-agent's comparison to the same `crypto.timingSafeEqual(createHmac(...))` pattern used elsewhere.

### H5. No log redaction — bearer tokens land in plaintext logs on every request
`apps/api/src/lib/logger.ts` and the `pinoHttp(...)` setup in `index.ts` have no `redact` configuration. `pino-http`'s default request serializer includes `req.headers`, so every request's `Authorization: Bearer <firebase-id-token>` header — as well as `x-agent-secret`, `x-internal-secret`, `x-cron-secret`, `x-webhook-secret` on the relevant routes — is written to the structured JSON logs in full. Logs are commonly shipped to a less-trusted aggregator and retained far longer than a token's lifetime.
- **Fix:** add a `redact` option to both the `pino()` base logger and the `pinoHttp()` instance covering `req.headers.authorization`, `req.headers["x-agent-secret"]`, `req.headers["x-internal-secret"]`, `req.headers["x-cron-secret"]`, `req.headers["x-webhook-secret"]`, and any `req.body.password`/`clientSecret`/`token` fields that get logged elsewhere (grep for `logger.info({ ...req.body` patterns too).

### H6. Billing sweep and uptime monitoring have no scheduler wired up anywhere in this repo
`routes/billing.ts`'s own comment says *"see `.github/workflows/billing-cron.yml`, which is what actually calls this in production on a schedule"* — that file **does not exist**. `.github/workflows/` contains only `publish-sdk.yml`. `routes/status.ts`'s uptime-check sweep has the identical dual-trigger design (cron secret or admin button) and is in the same boat. Unlike these two, `jobs/ssl-renewal.ts` correctly self-schedules via a BullMQ repeatable job in `worker.ts` — so the fix pattern already exists in the codebase, it just wasn't applied here.
- **Impact:** past-due subscriptions won't be swept to `cancelled` and uptime won't be checked unless a human manually clicks the button in the dashboard every day, or an external cron system (crontab on some server, a GitHub Actions workflow, a hosted cron service) that isn't part of this repo is separately configured and kept in sync with `BILLING_CRON_SECRET`.
- **Fix:** either (a) add the missing `.github/workflows/billing-cron.yml` (+ an uptime equivalent) using `schedule:` + `curl` with the secret from GH Actions secrets, or (b) move both into BullMQ repeatable jobs in `worker.ts` alongside SSL renewal, which is more consistent with the rest of the app's self-contained design and doesn't depend on GitHub Actions being enabled/funded.

### H7. "Connect GitHub/GitLab via OAuth" is non-functional end-to-end — no callback route exists
`apps/api/src/routes/gitConnect.ts`'s `/git/connect/:provider/authorize` endpoint builds and returns a real GitHub/GitLab OAuth consent-screen URL with:
```ts
const redirectUri = `${protocol}://${host}/api/git/connect/${provider}/callback`;
```
But **no route matching `/git/connect/:provider/callback` exists anywhere in the codebase** — not in `gitConnect.ts`, not elsewhere in `apps/api`, not in the dashboard frontend. Confirmed via a full-repo search. A customer who clicks "Connect via GitHub," approves access on GitHub's real consent screen, gets redirected back to a 404 — the flow dead-ends with no error surfaced to the user beyond a broken redirect. The only path that actually works is the separate `POST /git/connect/:provider/token` endpoint, which expects the customer to paste a raw personal access token — i.e., the real, working feature is "paste a PAT," while the "Connect via OAuth" button/flow the code half-builds is dead. Two related issues in the same flow:
- The OAuth `state` parameter is just `req.user!.id` — a predictable, non-random value, rather than a single-use signed nonce. Low-impact only because the callback that would consume it doesn't exist yet, but must be fixed together when this flow is completed (a guessable `state` enables OAuth account-linking CSRF).
- `POST /git/connect/:provider/token` doesn't gate on whether the token actually validated: if the GitHub/GitLab profile lookup fails (bad/expired/revoked token), the code silently falls through and still saves the token as a "connected" account, returning `{ ok: true }` — the customer only discovers the token doesn't work later, on the first actual push/repo-list attempt, with a confusing downstream error.
- **Fix:** either finish the OAuth flow properly (implement the callback route, exchange `code` for a token via GitHub's/GitLab's token endpoint, use a signed single-use `state`), or remove the `/authorize` endpoint and the "Connect via OAuth" UI entirely and ship only the PAT-paste flow (already working) until OAuth is actually built. Either way, make `/token` return a `400` when the provider profile lookup fails instead of saving an unverified token.

### H8. Same unpersisted in-memory pattern: connected Git accounts (`gitUserAccounts`)
`gitConnect.ts`'s `gitUserAccounts` is another `Map<userId, GitAccount[]>` (the same class of bug as H1) — every customer's connected GitHub/GitLab account (and its encrypted token) is lost on every API restart/redeploy. Worse than the other H1 instances: `filesystem.ts`'s git-commit-push feature directly imports and depends on this same map (`import { gitUserAccounts } from './gitConnect'`), so an in-progress or soon-to-happen commit-push can start failing the moment the backend gets redeployed for an unrelated reason, with the customer having to reconnect their account each time.
- **Fix:** same as H1 — persist to a `GitAccount` Prisma model scoped by `userId`, continue using the existing `encryptSecret`/`decryptSecret` pattern already correctly used for the token itself.

### H9. Audit logging is inconsistent exactly where it matters most (`leaseweb.ts`)
Two issues in the VPS instance-management routes, which are otherwise well-scoped (see the "what's solid" section — `resolveLeasewebVpsId` correctly enforces per-customer ownership via `canAccessResource`):
- `GET /leaseweb/instances/:kind/:id/credentials` (retrieves the VPS root/Administrator password) and `POST /leaseweb/instances/:kind/:id/ssh-ticket` (grants a live SSH terminal session) — arguably the two most sensitive actions in this entire route file — write **no audit log entry at all**. Meanwhile the less sensitive `reset-password` and `terminate` actions right next to them do call `prisma.auditLog.create(...)`. If a VPS is ever compromised, there will be no record of who viewed its root password or opened a terminal to it.
- `reset-password`'s audit entry uses the schema's `AuditLog.adminId` field — a required FK explicitly named/related as `"AdminAuditLogs"` in `schema.prisma`, and documented in `admin.ts`'s own comment as tracking "every **admin** action" — but this route is explicitly designed for **customer self-service** ("Owner... or staff can call this"). A customer resetting their own VPS password gets logged into the admin audit trail under their own account, indistinguishable from a staff action when viewed on `/admin/audit-log`, polluting what's meant to be a staff-accountability log.
- **Fix:** add audit logging to `credentials` and `ssh-ticket` (at minimum: who, which VPS, when — not the credential itself). For `reset-password`, either add a boolean/enum `actorRole` column to `AuditLog` so the admin-log UI can filter/label customer-initiated entries distinctly, or route customer self-service actions to a separate `CustomerActivityLog` instead of overloading the admin-only table.

### H10. Systemic drift between the published SDK packages (`@shanutechx/client`, `@shanutechx/node-agent`) and the real API — this isn't one bug, it's a pattern
Once the node-agent SDK mismatch (below) turned up, checking the customer-facing `@shanutechx/client` package's other resources found the same problem repeated. None of these are used by `apps/api`/`apps/dashboard` themselves (both talk to the real routes directly), so nothing internal exercises this package's correctness — it's purely for external integrators, and it appears to have drifted since whenever it was last actually tested against the live API:

| SDK method | SDK calls | Real route |
|---|---|---|
| `packages/node-agent`: `stopContainer`/`startContainer`/`restartContainer` | `POST /agent/{stop,start,restart}/:id` | `POST /agent/{containers,deployments}/:id/{stop,start,restart}` (action last, not first) — **404** |
| `packages/client` `DeploymentsResource.getResourceUsage` | `GET /api/deployments/:id/stats` | No such route exists — usage is embedded in the `GET /api/deployments/:id` response body — **404** |
| `packages/client` `DeploymentsResource.delete` | `DELETE /api/deployments/:id` | No `DELETE` handler is registered for that path at all — **404** |
| `packages/client` `GitResource.removeAccount` | `DELETE /api/git/accounts/:id` | Real route is `POST /api/git/disconnect` with `{ accountId }` in the body — **404** |
| `packages/client` `GitResource.getGitHubAuthUrl`/`getGitLabAuthUrl` | builds `/api/git/{github,gitlab}/auth` | Real route is `/api/git/connect/:provider/authorize` — entirely different path shape — **404**, and moot anyway per H7 (no callback exists) |
| `packages/client` `GitResource.resolveAccountForRepo` | reads `a.login` off each account | The real `GitAccount` shape (and the SDK's own imported `GitAccount` type) uses `username`, not `login` | always returns `undefined`, matches nothing, silently |
| **`packages/auth` (`@shanutechx/auth`, the whole package)** | `login`/`register`/`refresh`/`me`/`changePassword` → `POST/GET /api/auth/{login,register,refresh,me,change-password}` | **There is no `/api/auth/*` router mounted anywhere in `apps/api`** (confirmed against every `app.use('/api', ...)` line in `index.ts`) — the real platform auth is entirely Firebase-based (`middleware/auth.ts` verifies a Firebase ID token; there's no email/password endpoint on this API at all). If this was instead meant to hit a *project's own* auth (`projectAuth.ts`'s `/projects/:id/auth/signup` etc.), the paths are still wrong — they're missing the `:id` segment entirely. Either way, **every method in this package 404s** |

The last row is the starkest example: `@shanutechx/auth` is a whole published package, named for and seemingly dedicated to authenticating against this platform, with zero working methods.

Every method in `git.ts` except `listAccounts()`/`listRepos()` is broken. This isn't a one-off typo — it's a maintenance gap: nothing in CI exercises these packages against a running (or even mocked) API, so the SDKs and the API have been free to drift apart silently since whichever point they last matched.
- **Fix:** the durable fix is structural, not per-method: add a contract test that spins up the real (or lightly-faked) Express app and drives every published SDK method against it, so a path/shape mismatch fails CI the same way it would fail a real integrator. Until that exists, do a manual pass over every method in both packages against the current route tables (I've listed the ones I found; there may be more I didn't check line-by-line) and fix or remove what's broken.

---

## 🟡 Medium

### M1. Wide-open CORS reflection with credentials
`apps/api/src/index.ts`'s manual CORS middleware reflects **any** `Origin` header back with `Access-Control-Allow-Credentials: true`:
```ts
if (origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
```
This is partly mitigated by (a) Bearer-token auth rather than cookies for the primary session, and (b) `csrfProtection.ts` checking Origin on state-changing methods — but GET requests aren't checked at all, and reflecting arbitrary origins with credentials enabled is a well-known anti-pattern regardless. If any endpoint ever starts relying on a cookie (session, refresh token, etc.), this becomes directly exploitable for cross-origin data theft via GET.
- **Fix:** use the `cors` package (already a dependency!) with an explicit origin allowlist function — reuse the same list `csrfProtection.ts` already maintains rather than a separate hand-rolled reflect-everything middleware — and drop `Access-Control-Allow-Credentials` unless you actually need cookie-based auth.

### M2. `.env.example` values that are actively wrong for the provided Docker Compose stack
`apps/api/.env.example` sets:
```
WHATSAPP_BOT_URL="http://localhost:4100"
DISCORD_BOT_URL="http://localhost:4200"
```
These are correct only for running every service directly on the host; they're wrong for `docker-compose.local.yml`, which needs the Compose service names (`http://whatsapp-bot:4100`, `http://discord-bot:4200` — as the real, gitignored `.env` in this archive correctly has). A developer who copies `.env.example` and follows the Docker Compose instructions will get silent notification failures with no error (see H3).
- **Fix:** either ship two example files (`.env.example` for host dev, `.env.docker.example` for Compose) or add a comment at the top of `.env.example` noting which values change under Docker and why.

### M3. Roughly 30 environment variables are used in code but undocumented in `.env.example`
Including OAuth credentials for the Git-connect feature (`GITHUB_CLIENT_ID/SECRET`, `GITHUB_APP_CLIENT_ID/SECRET`, `GITLAB_CLIENT_ID/SECRET`, `GITLAB_APP_CLIENT_ID/SECRET`), `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `POSTAL_API_URL/KEY/FROM_ADDRESS` (documented in the actual `env.ts` but missing from `.env.example`), `AWS_ACCESS_KEY_ID`/`S3_BUCKET` (alternate R2 config path), `LEASEWEB_CUSTOMER_ID`, `SERVER_IP`, `WEBMAIL_URL`, and the undocumented `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_PORT` fallback vars from H1/webmail. A new developer has no way to discover these exist short of grepping the source.
- **Fix:** run a script that diffs `process.env.X` usages against `.env.example` keys (the same one used to produce this finding) as a CI check, and backfill the missing entries with comments.

### M4. `routes/webmail.ts` "send" silently no-ops in most deployments
`POST /webmail/send` builds SMTP transport config from `process.env.SMTP_HOST/USER/PASS/PORT` directly (bypassing `env.ts` entirely), which are the same undocumented vars from M3, defaulting to a **hardcoded literal password** (`'smtp_pass'`) if unset. The send call is wrapped in `.catch()` that only logs a warning, so the API still returns `201 { ok: true }` to the customer even when the underlying SMTP send fails outright. Combine this with C3 (unscoped store) and this whole feature needs to be rebuilt on the real per-account `SmtpAccount` credentials already used correctly elsewhere in `smtp.ts`/`email.ts`.
- **Fix:** route webmail send through the account's own decrypted SMTP credential (`decryptSecret(account.credentialRef, ...)`), not a separate global env-var path; surface delivery failures to the caller instead of swallowing them.

### M5. `smtp.ts`'s global outbound config has the same hardcoded-fallback-password problem
`globalSmtpConfig.pass` defaults to the literal string `'smtp_secret_pass'` when `SMTP_PASS` is unset, and the whole object lives in memory only (lost on restart). Related to H1/M3.
- **Fix:** persist to DB (a `PlatformConfig` singleton row, or reuse the `Settings`-style pattern already in the schema if one exists) and never default a password to a literal string — fail closed with a clear "not configured" state instead.

### M6. Billing cron-fallback role check is stricter than the rest of the app
`billing.ts`'s manual-trigger fallback checks `role !== 'admin'` only, excluding `dev` — every other admin-tier endpoint in the app (via `requireAdmin`) treats `dev` as having full admin-equivalent access. A `dev` user clicking "run billing checks" manually in the dashboard would get an unexpected 403.
- **Fix:** change to `role !== 'admin' && role !== 'dev'`, matching `requireAdmin`.

### M7. Dead code left in the tree
`apps/api/src/lib/verifyPayment.ts.disabled`, `lib/gemini.ts`, `lib/groq.ts` — confirmed via grep that nothing imports any of these three files; the AI-based payment verification path was deliberately removed (per `worker.ts`'s own comment) in favor of human review. Harmless as-is, but adds confusion for new contributors and keeps unused API-key env vars (`GEMINI_API_KEY`, `GROQ_API_KEY`) alive in `.env.example`.
- **Fix:** delete all three files and their env var entries, or if you want to keep them for reference, move them to a `docs/archive/` folder instead of `src/`.

### M8. `settingsRouter` mounted twice
`apps/api/src/index.ts`:
```ts
app.use('/api/settings', settingsRouter);
app.use('/api', settingsRouter);
```
Since every route inside `settingsRouter` is already defined with a full `/settings/...` or dual-path (`['/verify-password', '/settings/verify-password']`) prefix, this double-mount means several endpoints are reachable at two or three different URLs (e.g. both `/api/settings/verify-password` reachable via the second mount's `/settings/verify-password` path, *and* a redundant, confusing `/api/settings/settings/verify-password` isn't hit only because of the explicit dual-array — but it's fragile and easy to break next time someone adds a route without checking both mount points).
- **Fix:** pick one mount point (`app.use('/api', settingsRouter)` matches how every other router in the file is mounted) and remove the other; drop the redundant `['/verify-password', '/settings/verify-password']` array in favor of the single canonical path.

---

## 🟢 Low / cleanup

- **`CLAUDE.md` says "Next.js 15 App Router"** — both `apps/dashboard/package.json` and `apps/web/package.json` actually pin `"next": "^14.2.35"`. Minor doc drift, but worth fixing so AI assistants (and new developers) reading `CLAUDE.md` don't reach for Next 15-only APIs that don't exist here.
- **`docker-compose.local.yml` publishes ports `4100`/`4200`** for `whatsapp-bot`/`discord-bot` to the host, but (once H3 is fixed) these should stay internal-only — drop the `ports:` blocks for both services once the loopback-binding fix lands, so they're not reachable from the host/LAN unintentionally.
- **`Node.js` app-level Prisma relations:** 40 of 51 `@relation` fields have no explicit `onDelete` behavior (defaults to `Restrict`). This is *probably* intentional given the isActive-deactivate pattern the app already uses elsewhere (H4), but it's worth an explicit pass to confirm every relation that *should* cascade (e.g. deleting a `Deployment` should clean up its own log/env-var rows) actually does, and everything that shouldn't (Users, Orders, Payments — anything with financial/audit history) explicitly stays `Restrict` rather than relying on the implicit default.
- **`apps/mobile-admin/app.json`** ships literal `"REPLACE_WITH_REAL_FIREBASE_API_KEY"` placeholders — this is clearly intentional/documented in `firebase.ts`'s own comment (no real Firebase project credentials were available to whoever built this), not a bug, but it does mean the mobile app cannot authenticate out of the box; flagging so it isn't missed during setup.
- **`SMS_WEBHOOK_SECRET`, `smsSignature.ts` already do this right** — used as a positive reference pattern above; no action needed, just noting it as one of the well-built pieces.

---

## What's already solid (no action needed)

Worth calling out so effort isn't wasted "fixing" things that are fine:
- RBAC/ownership model (`middleware/rbac.ts`) — the Phase-15 "scoped admin" design (dev unrestricted, admin scoped to `assignedAdminId`, customer self-only) is consistently applied across deployments, invoices, tickets, payments, subscriptions, and is well-commented with the reasoning behind each choice.
- `billing.ts`/`billingRules.ts` — correctly unit-tested, correct renewal/grace-period math, timing-safe cron auth.
- `products.ts`'s soft-delete pattern (the one other delete routes should copy — see H4).
- `secretsVault.ts` (AES-256-GCM, unique IV per secret) and its consistent use in `smtp.ts`, `vps.ts`, `projects.ts`, `livekit.ts`, `gitConnect.ts`, `managedDatabases.ts`, `projectAuth.ts`, `deployments.ts`, `email.ts`, `webhooks.ts`, `deployPipeline.ts`, `orderFulfillment.ts`, `discordWebhooks.ts` — this is the right pattern, it's just not used by the routes flagged in H1.
- SSL renewal job's self-contained BullMQ scheduling (`worker.ts`) — the template the billing/uptime cron gap (H6) should follow.
- Dashboard/web internal navigation — checked every `<Link href>` in both apps against the actual page tree; no broken links found.
- Customer-supplied-Cloudflare-token design in `deployments.ts`'s custom-domain flow — correctly never persists the customer's own DNS credential, least-privilege by design.
- `leaseweb.ts`'s `resolveLeasewebVpsId` — correctly enforces per-customer VPS ownership (via `canAccessResource`) and dev-only access to raw platform nodes, consistently applied across all 19 instance-management routes.
- `leaseweb.ts`'s `firewall`/`dns` endpoints honestly return `{ supported: false, reason: ... }` when the integration isn't confirmed against Leaseweb's actual API, rather than fabricating data — the right pattern, and a useful contrast to `supabase.ts`'s fake-fallback-data anti-pattern (H1).
- `projects.ts`, `domains.ts`, `orders.ts`, `sms.ts`, `containers.ts`, `discordWebhookConfig.ts` — all correctly scoped (router-level RBAC or explicit `verifyResourceOwnershipAsync`/`req.user!.id` filtering, and `sms.ts`'s inbound webhook correctly signature-verifies via `verifySmsSignature` + rate-limits before touching the DB).
- `projectAuth.ts`'s "no auth on signup/login/magic-link/oauth" is intentional and correct, not a gap — those routes are the auth API *for a hosted project's own end-users* (ShanuTechX's in-house Supabase-clone auth-as-a-service), not for ShanuTechX platform accounts.

---

## Prioritized Implementation Plan

### Phase 0 — Immediate (before anything else, today)
1. Rotate every secret in `apps/api/.env` (C1) — **treat `NODE_AGENT_SECRET` as top priority** (C5): it's not just present in `.env`, it's hardcoded as the source's own fallback value, so it must be assumed known. Audit the `Node` table for unrecognized registrations before rotating.
2. One-line fix: add `requireAdminOrDev` to `GET /supabase/config` (C2).
3. Remove the `'123456'`/`'admin'`/`length >= 4` fallback in `settings.ts` (C4) — fail closed instead.
4. Remove the hardcoded fallback literal from `nodes.ts`'s `CLUSTER_SECRET` (C5) — refuse to start (or refuse registrations) if `NODE_AGENT_SECRET` is unset, never default to a baked-in value.
5. Add `COPY templates ./templates` to `apps/api/Dockerfile` (C7) — the self-hosted app catalog is currently returning empty/erroring for every customer in production. One-line-ish fix, big visible impact.

### Phase 1 — This sprint (security-sensitive gaps)
6. Scope `webmail.ts` to a real, owned Prisma model (C3) — or, if webmail isn't launching soon, disable the route entirely (`requireAdminOrDev`-gate it or comment it out of `index.ts`) until it is rebuilt, rather than leaving a live cross-tenant IDOR reachable by any customer.
7. Add `redact` config to the logger (H5) — quick, high-value.
8. Fix the WhatsApp/Discord `listen('127.0.0.1', ...)` → `listen(...)` bug (H3) and verify notifications actually arrive through the Docker Compose stack end-to-end.
9. Switch node-agent's and `/nodes/register`'s secret comparisons to `timingSafeEqual` (H4/C5); document/enforce the private-network requirement for node-agent beyond a code comment (H2 — at least the firewall-allowlist mitigation).
10. Add audit logging to `leaseweb.ts`'s `credentials` and `ssh-ticket` routes (H9) — the two most sensitive actions in that file currently leave no trail.
11. Add the missing `GET /agent/deployments/:containerId/metrics` route to `services/node-agent` (C6) so the resource-usage panel — currently silently broken for every deployment — actually works; add an integration-style test that exercises the real HTTP contract instead of mocking `getResourceUsage`.
12. Replace the hardcoded default passwords in `templates/*.yaml` with required-or-generated values before the C7 fix ships the catalog to customers (see the note after C7).

### Phase 2 — Next sprint (data integrity & consistency)
13. Apply the `products.ts` soft-delete pattern to `vps-plans.ts` and `catalog.ts` (H4).
14. Wire the CORS middleware to an explicit allowlist via the `cors` package (M1).
15. Add the missing scheduler for billing sweep + uptime checks — prefer folding into `worker.ts`'s BullMQ pattern over a GitHub Actions cron (H6).
16. Fix the `settingsRouter` double-mount (M8) and the `billing.ts` dev-role fallback gap (M6) — both trivial.
17. Decide the fate of "Connect via GitHub/GitLab OAuth" (H7): finish it (build the callback route, exchange the code, sign the `state`) or remove the dead `/authorize` path and ship PAT-paste only. Either way, make `/git/connect/:provider/token` reject unverified tokens instead of silently saving them.
18. Separate the `AuditLog` semantics so customer self-service actions (like `leaseweb.ts` reset-password) don't get recorded as admin actions (H9).
19. Fix (or add contract tests and then fix) the broken paths/shapes across `@shanutechx/client` and `@shanutechx/node-agent` (H10) — start with a CI contract test so this stops silently recurring.

### Phase 3 — Following sprint (finish the stubbed features)
20. Pick one in-memory feature at a time from H1/H8 and give it a real Prisma model + migration, in this order: Secrets Vault → connected Git accounts (`gitUserAccounts`, since `filesystem.ts` already depends on it) → global SMTP config / email domains → Knowledge Base → Supabase management panel. Each is a self-contained, independently shippable unit of work.
21. Rebuild webmail send to use the account's real decrypted SMTP credential instead of the undocumented global env-var fallback (M4/M5).

### Phase 4 — Hygiene (anytime, low risk)
22. Delete dead code (`verifyPayment.ts.disabled`, `gemini.ts`, `groq.ts`) and their env vars.
23. Backfill `.env.example` with the ~30 missing vars (M3); split or annotate it for Docker vs. host dev (M2).
24. Fix the `CLAUDE.md` Next.js version claim; drop the now-dead host port mappings for the bot services once Phase 1 step 8 lands.
25. Do an explicit pass over the 40 Prisma relations without `onDelete` to confirm cascade behavior is intentional everywhere.

---

*This report reflects a manual, file-by-file review of the application's own code (not the vendored Supabase packages or the self-hosting template catalog). Line numbers reference the archive as provided; re-verify against your working tree before applying fixes, since line numbers shift as the file changes.*
