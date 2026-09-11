# 🚨 Comprehensive Codebase Audit Report
### Shanutechx-hostingplatfrom-main

**Date:** September 11, 2026
**Repository:** `Shanutechx-hostingplatfrom-main` (1,295 total files / 851 `.ts`/`.tsx`/`.js` source files)

---

## Methodology & Coverage

Automated, repository-wide scans (100% file coverage) were run for every checklist category — `TODO`/`FIXME`/`HACK`, hardcoded secrets, hardcoded IPs, emoji, demo/bypass flags, mock emails, weak randomness, unsanitized render sinks, and silent exception swallowing. Every hit was then manually opened and traced through its actual call path (not just the matched line). Beyond that, deep manual, line-by-line review was performed on the highest-risk subsystems:

- Authentication & RBAC (`middleware/auth.ts`, `middleware/rbac.ts`)
- Payments, billing, and subscription transactions (`routes/payments.ts`, `lib/billing.ts`, `lib/paymentMatcher.ts`, `routes/sms.ts`)
- Webhook ingestion & signature verification (`routes/prWebhooks.ts`, `routes/internalBot.ts`)
- The remote filesystem / browser IDE and SSH terminal gateway (`routes/filesystem.ts`, `lib/sshTerminalGateway.ts`, `services/node-agent/src/filesystem.js`)
- Custom domain / CNAME / SSL lifecycle (`lib/domain/manager.ts`, `routes/domains.ts`)
- The node-agent provisioning service (`services/node-agent/*`) and its network-facing auth gate
- The Discord and WhatsApp bot services and their internal API trust boundary
- `apps/mobile-admin`'s API client and payment-review flow
- All first-party `packages/*` (`auth`, `deployments`, `db` scripts, `client`, `catalog`, `tracing`, `types`)

The six vendored `@shanutechx/{auth,postgrest,realtime,storage,supabase,functions}-js` packages (~300 files, forked upstream Supabase SDKs) were included in the automated scans but **not** individually hand-audited — they are not proprietary business logic and returned no anomalies. `apps/dashboard`'s and `apps/web`'s remaining UI-only screens (analytics, CMS editor, admin panels) beyond what's cited below were not separately audited, since the backend routes they call were already covered directly.

Every finding below was verified by reading the actual source file; nothing was inferred from a filename or a partial grep match without opening the file.

---

## Summary Statistics
- Total Files Audited (automated pattern scan, full coverage): **851** source files
- Files Manually Line-by-Line Verified (highest-risk subset): **~60**
- Total Defects Found: **20**
- Critical Vulnerabilities / Bugs: **1**
- High Severity: **7**
- Medium Severity: **8**
- Low Severity: **4**
- Hardcoded / Mock Items: **4** (one spanning 17 lines in one file)

---

## Detailed Findings by Component

### Component: `apps/api` — Authentication

#### 1. `apps/api/src/middleware/auth.ts` — Account takeover via unverified-email auto-linking
- **Category**: Bug (Logic error / Auth flaw)
- **Severity**: Critical
- **Line Number(s)**: L83-L98
- **Actual Code**:
  ```ts
  if (!user && decoded.email) {
    // Check if a user already exists with this email (e.g. manually created)
    // and link the Firebase UID to them.
    const existingByEmail = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          firebaseUid: decoded.uid,
          displayName: existingByEmail.displayName || decoded.name || null,
        },
      });
    }
  }
  ```
- **Description & Risk**: `decoded` is the Firebase-verified token, but the code never checks `decoded.email_verified` before treating the email as proof of identity. Firebase issues valid ID tokens for email/password sign-ups immediately, with `email_verified: false`, before the address is ever confirmed. An attacker can sign up with Firebase Auth using a victim's real email, call any authenticated endpoint, and this code will find the victim's existing account by email and silently rewrite its `firebaseUid` to the attacker's — handing over full access to that account (billing, VPS/domains, deployments, etc.).
- **Required Remediation**: Only auto-link when `decoded.email_verified === true`. If false, either reject the request (require email verification first) or create a new, separate `pending` account rather than merging into the existing one.

---

### Component: `services/node-agent`

#### 2. `services/node-agent/src/nodeEngine.js` — Silent exception swallowing across all node-status collectors
- **Category**: Bug (Exception swallowing)
- **Severity**: High
- **Line Number(s)**: L162-163, L204-205, L269-270, L354-355, L452-453
- **Actual Code**:
  ```js
  async function listDockerContainers() {
    try {
      const containers = await docker.listContainers({ all: true });
      return containers.map((c) => ({ ... }));
    } catch (err) {
      return [];
    }
  }
  ```
  (Identical `catch (err) { return []; }` pattern also in `getListeningPorts`, `listSystemdServices`, `listLinuxUsers`, `listDockerNetworks`.)
- **Description & Risk**: If the Docker daemon is down, `docker.sock` is unreachable, or `ss`/`systemctl`/`/etc/passwd` reads fail (permissions, wrong agent user, corrupted install), every one of these five collectors reports "zero containers / zero services / zero ports / zero users" instead of an error. Since this data feeds node health/monitoring dashboards, a genuinely broken node looks identical to an empty, healthy one. `err` is never logged.
- **Required Remediation**: Log `err` (with the operation name) before returning, and return a distinguishable error/`null` shape so callers can differentiate "no data" from "collection failed."

#### 3. `services/node-agent/src/nodeEngine.js` — Comment claims yum/CentOS support the code doesn't have
- **Category**: Bug (Missing logic / doc-vs-code mismatch)
- **Severity**: Medium
- **Line Number(s)**: L95-L131
- **Actual Code**:
  ```js
  // ── 2. OS PACKAGE INSTALLATION & SYSTEM UPGRADES ──────────────────────────
  // Detect package manager (debian/ubuntu apt-get, alpine apk, centos yum)
  async function installSystemPackage(packageName) {
    try {
      const { stdout } = await execFileAsync('apt-get', ['update', '-y'], { timeout: 60000 });
      ...
    } catch (aptErr) {
      try {
        const { stdout } = await execFileAsync('apk', ['add', '--no-cache', packageName], { timeout: 60000 });
        ...
      } catch (apkErr) {
        throw new Error(`Package installation failed: ${aptErr.message || apkErr.message}`);
      }
    }
  }
  ```
- **Description & Risk**: The comment explicitly claims CentOS/`yum` is supported, but only `apt-get` and `apk` are ever attempted (same pattern in `upgradeSystemPackages`, L117-131). On a yum/dnf-based node, both commands fail with `ENOENT`, and package install/upgrade silently doesn't work on a platform the code claims to support.
- **Required Remediation**: Implement the `yum`/`dnf` branch, or correct the comment.

#### 4. `services/node-agent/src/nodeEngine.js` — Image pull failure silently swallowed before container creation
- **Category**: Bug (Exception swallowing)
- **Severity**: Medium
- **Line Number(s)**: L137-139
- **Actual Code**:
  ```js
  async function createDockerContainer({ name, image, env = [], ports = [], volumes = [], network }) {
    // Pull image if not local
    try {
      await docker.pull(image);
    } catch (e) {}
    ...
  ```
- **Description & Risk**: A pull failure (bad tag, private registry auth failure, network issue) is discarded with no logging, and execution continues into `docker.createContainer`, producing a confusing downstream error with no hint the real cause was a failed pull.
- **Required Remediation**: Log `e`; fail fast with a clear "image pull failed" error if the image isn't already cached locally.

#### 5. `services/node-agent/src/projects.js` — Deterministic API port assignment with no collision check
- **Category**: Bug (Logic error)
- **Severity**: High
- **Line Number(s)**: L59-61
- **Actual Code**:
  ```js
  const apiPort = 18000 + (Math.abs(hashCode(projectId)) % 1000);
  ```
- **Description & Risk**: Only 1,000 possible ports for potentially unlimited projects, with no check against ports already bound by other running containers. Two projects hashing to the same value collide, and `docker run -p <port>:3000` fails for the second — an unexplained provisioning failure for a paying customer.
- **Required Remediation**: Query in-use ports (or track allocations in a DB table) and retry/select an unused port instead of a pure hash.

#### 6. `services/node-agent/src/projects.js` — Deprovisioning errors silently discarded
- **Category**: Bug (Exception swallowing)
- **Severity**: Medium
- **Line Number(s)**: L96-101
- **Actual Code**:
  ```js
  if (dbName) {
    await pgExec(`DROP DATABASE IF EXISTS "${dbName}";`).catch(() => {});
  }
  if (dbUsername) {
    await pgExec(`DROP ROLE IF EXISTS "${dbUsername}";`).catch(() => {});
  }
  ```
- **Description & Risk**: A real failure (e.g., `DROP DATABASE` blocked by active connections) is swallowed with zero logging, leaving orphaned databases/roles that accumulate silently.
- **Required Remediation**: Log the error at minimum; consider surfacing a "deprovision incomplete" status so the caller can retry or alert.

---

### Component: `docker/` (self-hosted Supabase stack)

#### 7. `docker/supabase/docker-compose.yml` — Hardcoded default DB password and JWT secret with no forcing mechanism
- **Category**: Hardcoded Value
- **Severity**: High
- **Line Number(s)**: L28, L42, L109, L116, L133, L137, L152, L156, L158, L176, L177, L208, L219, L224, L244, L245, L248 (17 occurrences)
- **Actual Code**:
  ```yaml
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-shanutechx_super_secret_postgres}
  ...
  AUTH_JWT_SECRET: ${JWT_SECRET:-shanutechx_super_secret_jwt_token_32chars}
  ```
- **Description & Risk**: Unlike `infra/control-plane/docker-compose.yml`, which requires these secrets with no default, this file falls back to a fixed, now-public password and JWT-signing secret across every Postgres role and Supabase service if the operator forgets to set env vars. Since these secrets sign auth tokens, a stack brought up with defaults is trivially compromised by anyone who has read this repository.
- **Required Remediation**: Remove the `:-shanutechx_super_secret_*` fallbacks entirely so compose fails loudly without the real secrets, or generate/persist random values on first run.

---

### Component: `apps/dashboard`

#### 8. `apps/dashboard/app/(protected)/email/page.tsx` — Real-looking IP hardcoded as SPF/MX fallback record
- **Category**: Hardcoded Value
- **Severity**: Low
- **Line Number(s)**: L752, L758, L761
- **Actual Code**:
  ```tsx
  <button onClick={() => copyToClipboard(dom.mxRecord || '10 mail.shanutechx.com', 'MX Record')} ...>Copy</button>
  <td className="truncate max-w-xs">{dom.spfRecord || 'v=spf1 mx ip4:154.53.56.88 ~all'}</td>
  ```
- **Description & Risk**: When a domain has no configured `spfRecord`/`mxRecord`, the UI shows and lets the user copy a specific hardcoded, real-looking IP (`154.53.56.88`) as if it were their DNS record — misleading whether or not it's a real infrastructure IP.
- **Required Remediation**: Use an obviously-fake placeholder (e.g., `YOUR_MAIL_SERVER_IP`) rather than a specific real-looking IP as silent UI fallback.

#### 9. `apps/dashboard/components/webmail/WebmailOnboardingWizard.tsx` — Unsanitized `dangerouslySetInnerHTML`
- **Category**: Bug (unsafe render sink)
- **Severity**: Medium
- **Line Number(s)**: L318-327
- **Actual Code**:
  ```tsx
  <div
    className="bg-white/5 rounded-xl px-4 py-3 text-sm text-slate-300"
    dangerouslySetInnerHTML={{ __html: signatureContent }}
  />
  ```
- **Description & Risk**: Every other place in this webmail module that renders HTML (`WebmailMessageView.tsx`, `WebmailMessageViewer.tsx`, `WebmailThreadViewer.tsx`) wraps it in `sanitizeHtml(...)` first. This one doesn't — raw user-typed HTML is rendered live via `dangerouslySetInnerHTML` with no sanitization, an inconsistency with the codebase's own established pattern.
- **Required Remediation**: Wrap with the same `sanitizeHtml()` used elsewhere in this module.

---

### Component: `apps/web` (public marketing site)

#### 10. `apps/web/lib/api.ts` — Hardcoded localhost fallback + silent failure masks production outages
- **Category**: Bug / Hardcoded Value
- **Severity**: Medium
- **Line Number(s)**: L26, L32-39
- **Actual Code**:
  ```ts
  export const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  ...
  export async function fetchProducts(category?: string): Promise<Product[]> {
    try {
      ...
      if (!res.ok) return [];
      ...
    } catch (error) {
      return [];
    }
  }
  ```
- **Description & Risk**: If none of the three env vars are set in production, requests silently go to `localhost:4000`, fail, and `fetchProducts` returns `[]` with **zero logging**. The public products page would render empty with no error trail pointing to the misconfiguration.
- **Required Remediation**: Drop the `localhost` fallback in favor of a build-time assertion the env var is set, and log the caught error before returning `[]`.

---

### Component: Cross-cutting dead code

#### 11. `apps/api/src/lib/traefik/example.ts` and `apps/api/src/middleware/rbac.example.ts` — Dead demo files left in production `src/`
- **Category**: Mock/Demo Data
- **Severity**: Low
- **Line Number(s)**: Whole files (302 and ~60+ lines respectively)
- **Actual Code**:
  ```ts
  /**
   * Traefik Configuration Module - Usage Examples
   * DO NOT import this file in production code - it's for documentation purposes only.
   */
  ```
- **Description & Risk**: Verified via grep that neither file is imported anywhere. They compile with the rest of `apps/api` and sit alongside real route/middleware code, risking confusion for future contributors.
- **Required Remediation**: Move into `docs/`, or delete if the patterns are already documented elsewhere.

#### 12. `apps/api/src/routes/prWebhooks.ts` — Non-byte-faithful raw-body fallback for signature verification
- **Category**: Bug (Logic error / robustness)
- **Severity**: Low
- **Line Number(s)**: L30
- **Actual Code**:
  ```ts
  const rawBody = (req as any).rawBody || JSON.stringify(payload);
  const expected = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  ```
- **Description & Risk**: `req.rawBody` is populated globally in `index.ts`, so this fallback is effectively dead in normal operation — but if a provider ever sends a body Express's JSON parser skips, the fallback reconstructs the body via `JSON.stringify`, which isn't guaranteed to match the exact bytes that were signed. The HMAC then mismatches and a legitimate webhook is rejected with a misleading "invalid signature" (fails safe/closed, but is a debugging trap).
- **Required Remediation**: If `rawBody` is missing, reject immediately with a distinct "raw body unavailable" error instead of silently reconstructing an approximation.

---

### Component: `services/discord-bot` + `apps/api/src/routes/internalBot.ts`

#### 13. `services/discord-bot/src/slashCommands.js` — Payment approval authority silently widens if two env vars are left unset
- **Category**: Bug (Authorization flaw)
- **Severity**: High
- **Line Number(s)**: L52-60
- **Actual Code**:
  ```js
  function isStaffAuthorized(member, user) {
    if (ALLOWED_DISCORD_USERS.length > 0 && ALLOWED_DISCORD_USERS.includes(user.id)) return true;
    if (ALLOWED_DISCORD_ROLES.length > 0 && member?.roles?.cache) {
      return member.roles.cache.some((role) => ALLOWED_DISCORD_ROLES.includes(role.id) || ALLOWED_DISCORD_ROLES.includes(role.name));
    }
    if (member?.permissions?.has && (member.permissions.has('Administrator') || member.permissions.has('ManageGuild'))) {
      return true;
    }
    return false;
  }
  ```
- **Description & Risk**: `/review-payment` calls `POST /api/internal/review-payment`, which authenticates the *bot process* via a shared secret but never independently checks who the human behind the Discord command is — it fully trusts `isStaffAuthorized()`. If `ALLOWED_DISCORD_USERS`/`ALLOWED_DISCORD_ROLES` are left unset (both empty by default), the check falls back to Discord's own `Administrator`/`ManageGuild` permission — commonly held by community moderators who aren't company staff. Anyone with "Manage Server" in the bot's guild could approve/decline real customer payments, triggering `fulfillOrder()` (provisioning paid services for free). Compare with the web/mobile path (`routes/payments.ts`), which uses `requireAdmin` checking the server's own `role` column — a materially stronger boundary.
- **Required Remediation**: Fail closed if both allowlists are empty (log a startup warning) rather than falling back to generic Discord guild permissions; ideally have `internalBot.ts` verify the reviewing identity against your own staff table.

---

### Component: `packages/deployments`

#### 14. `packages/deployments/src/EnvManager.ts` — Read-modify-write race condition on env var updates
- **Category**: Bug (Race condition)
- **Severity**: Medium
- **Line Number(s)**: L17-30
- **Actual Code**:
  ```ts
  async set(newVars: Record<string, string>): Promise<Record<string, string>> {
    const current = await this.load();
    const merged = { ...current, ...newVars };
    await this.client.deployments.updateEnvVars(this.deploymentId, merged);
    return merged;
  }
  ```
- **Description & Risk**: No version/ETag/compare-and-swap. Two concurrent `set()`/`unset()` calls race: whichever `updateEnvVars` lands second silently overwrites the first's changes with a stale snapshot, dropping the first caller's edits with no error or conflict signal.
- **Required Remediation**: Version/ETag-gate `updateEnvVars` server-side, or move the merge/delete logic server-side inside a transaction.

---

### Component: `packages/db/scripts`

#### 15. `packages/db/scripts/set-dev-user.ts` — Hardcoded personal identity committed to source, with no safety checks
- **Category**: Hardcoded Value
- **Severity**: High
- **Line Number(s)**: L4-5
- **Actual Code**:
  ```ts
  const firebaseUid = 'mrTThasIt7RXPk7QgbplnDK0FkR2';
  const email = 'tiroshbrot123@gmail.com';

  const updated = await prisma.user.updateMany({
    where: { OR: [{ firebaseUid }, { email }] },
    data: { role: 'dev' },
  });
  ```
- **Description & Risk**: A real Firebase UID and personal email are hardcoded, unconditionally granting the highest-privilege (`'dev'`) role to whichever account matches. This is both a personal-data/OPSEC leak in source control and a duplicate of `seed-dev-owner.ts` in the same folder, which does this correctly — parameterized via env var/CLI flag, and explicitly enforcing "there must only ever be exactly one 'dev' user," refusing to run without `--force` if one already exists. This script bypasses all of that.
- **Required Remediation**: Delete `set-dev-user.ts` in favor of `seed-dev-owner.ts`; scrub the hardcoded UID/email from git history if this repo has ever had broader access than intended.

---

### Component: `apps/api` — Billing (transaction integrity)

#### 16. `apps/api/src/lib/billing.ts` — Subscription writes bypass the transaction client, breaking the payment-approval atomicity the code claims to guarantee
- **Category**: Bug (Logic error / data-consistency)
- **Severity**: High
- **Line Number(s)**: L28 (signature), L48, L53 (the bug); cross-referenced with `routes/payments.ts` L161-195 and `routes/billing.ts` L152 (`extendSubscription`)
- **Actual Code**:
  ```ts
  export async function activateOrExtendSubscription(orderItemId: string, db: PrismaClient = prisma): Promise<void> {
    const orderItem = await db.orderItem.findUnique({ ... });      // uses `db` ✓
    const existing = await db.subscription.findUnique({ ... });    // uses `db` ✓
    if (existing) {
      await prisma.subscription.update({ ... });   // ← global `prisma`, NOT `db`
    } else {
      await prisma.subscription.create({ ... });    // ← same problem
    }
  }
  ```
  ```ts
  // payments.ts — the comment states the guarantee this breaks:
  // BUG-H04 FIX: activateSubscriptionsForOrder now runs inside the transaction
  // so both the order status update AND subscription activation are atomic.
  await prisma.$transaction(async (tx) => {
    ...
    await activateSubscriptionsForOrder(payment.orderId, tx);
    await tx.invoice.upsert({ ... });
  });
  ```
- **Description & Risk**: `activateOrExtendSubscription` accepts a transaction client specifically so its work rolls back together with order/invoice updates, and correctly uses it for both reads — but both writes hardcode the non-transactional global `prisma` client. The subscription commits immediately, independent of the surrounding `$transaction`. If anything later in that transaction fails and rolls back, the order reverts to unpaid, but the subscription stays extended/active — a customer could end up with an active subscription and running deployment tied to an order that never actually committed as paid. The same pattern exists in `extendSubscription()` (used for renewals in the same transaction), which doesn't accept a transaction client at all.
- **Required Remediation**: Change both writes in `activateOrExtendSubscription` to use `db` instead of `prisma`; give `extendSubscription` the same `db` parameter and thread `tx` through at its call site.

---

### Component: `services/node-agent` (security control bypass)

#### 17. `services/node-agent/src/index.js` — `AGENT_ALLOWED_IPS` allowlist trusts a client-controlled header
- **Category**: Bug (Security control bypass)
- **Severity**: High
- **Line Number(s)**: L48-53
- **Actual Code**:
  ```js
  app.use((req, res, next) => {
    if (ALLOWED_IPS.length > 0) {
      const remoteIp = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.socket.remoteAddress;
      if (!ALLOWED_IPS.includes(remoteIp)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    ...
  ```
- **Description & Risk**: The repo's own `docs/COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md` (row H2) claims this exact area is "✅ Fixed" via `AGENT_ALLOWED_IPS`, and `docs/DEPLOYMENT_GUIDE.md` recommends operators set it for defense-in-depth. But the check reads `x-forwarded-for` — a header any client can set — before ever consulting the real TCP peer address. There's no `trust proxy` configuration anywhere in this file justifying that trust. Anyone who can reach the node-agent's port can send `X-Forwarded-For: <an-allowlisted-IP>` and bypass the allowlist, leaving the shared `x-agent-secret` as the only real control — exactly the single-layer-of-defense scenario the code's own adjacent comment warns against.
- **Required Remediation**: Use `req.socket.remoteAddress` directly (or `req.ip` only with `trust proxy` correctly configured to a specific, trusted proxy hop). Never take a client-suppliable header as the enforcement value for an IP allowlist.

---

### Component: `apps/api` — Filesystem/Git audit coverage gap

#### 18. `apps/api/src/routes/filesystem.ts` — Inconsistent audit-log coverage across equally sensitive operations
- **Category**: Missing Logic
- **Severity**: Medium
- **Line Number(s)**: Audited: L76 (`fs.write`), L111 (`fs.delete`). Not audited: `mkdir` (L92), `rename` (L134), `upload-binary` (L146), `extract` (L158), `git-commit-push` (L170-262, entire handler)
- **Description & Risk**: This file's sibling feature, VPS SSH ticket issuance, is properly audit-logged with an `actorRole` column. Filesystem operations are equally sensitive, but only 2 of 7 mutating operations are logged, and `git-commit-push` — which pushes to a customer's real external GitHub/GitLab repo using their stored OAuth token — has no audit trail at all.
- **Required Remediation**: Add `prisma.auditLog.create(...)` calls for `mkdir`, `rename`, `upload-binary`, `extract`, and especially `git-commit-push` (recording provider, repo, branch, resulting commit SHA).

---

### Component: `apps/api/src/lib/domain/manager.ts`

#### 19. `apps/api/src/lib/domain/manager.ts` — Traefik route can survive its own database record if a mid-flow update fails
- **Category**: Bug (Logic error / orphaned resource)
- **Severity**: Medium
- **Line Number(s)**: L505-511, L661
- **Actual Code**:
  ```ts
  // configureTraefikRoute() — route is LIVE on the node before this DB write:
  await this.traefik.addRoute(/* applies real Traefik config on the node */);
  await prisma.customDomain.update({ data: { status: 'active', ... } });
  ```
  ```ts
  // removeDomain() — only tears down Traefik if the DB says 'active':
  if (customDomain.status === 'active') {
    try { await this.traefik.removeRoute(...); } catch (routeError) { /* logged, continues */ }
  }
  await prisma.customDomain.delete({ where: { id: customDomainId } });  // always runs
  ```
- **Description & Risk**: If the `status: 'active'` write fails after `addRoute()` already succeeded, the DB row stays at `'ssl_provisioning'` while the node is actively routing the domain. A later `removeDomain()` call then skips the Traefik teardown (status check fails) but deletes the DB row anyway — leaving an orphaned, still-live route with no corresponding record, and freeing the domain string for someone else to attach elsewhere.
- **Required Remediation**: Track "route applied" as its own durable fact instead of inferring it from the status enum, and attempt `traefik.removeRoute()` unconditionally in `removeDomain` (assuming it's safe/idempotent to call on a non-existent route).

---

### Component: `apps/api/src/lib` (dead code)

#### 20. `apps/api/src/lib/pdfInvoiceGenerator.ts` — A complete, unused second invoice-PDF implementation
- **Category**: Mock/Demo Data (dead code)
- **Severity**: Low
- **Line Number(s)**: Whole file, 283 lines
- **Description & Risk**: Verified via grep that no file imports from `pdfInvoiceGenerator.ts`. `routes/invoices.ts` uses `lib/invoicePdf.ts` instead — a different, HTML-based generator with an incompatible `InvoiceData` shape. This dead file uses `pdf-lib` as a dependency that nothing else needs, and reads like a complete, abandoned attempt at the same feature — a real risk that a future contributor imports the wrong one.
- **Required Remediation**: Delete the file; check whether `pdf-lib` can be dropped from `package.json`.

---

## Positive Findings (verified, worth noting)
- **No** genuine `TODO`/`FIXME`/`HACK`/`XXX` markers anywhere in proprietary code.
- **No** emoji found anywhere in `.ts`/`.tsx`/`.js` source across the entire repo.
- **No** `DEMO_MODE`/`BYPASS_AUTH`/`SKIP_AUTH`-style backdoor flags anywhere in `apps/`, `services/`, or first-party `packages/`.
- API key generation (`lib/apiKeys.ts`) correctly uses `crypto.randomBytes(24)`, not `Math.random()`.
- Webhook HMAC verification (`prWebhooks.ts`) correctly uses `crypto.timingSafeEqual` with a length check.
- `services/node-agent/src/projects.js` SQL is properly parameterized/escaped (`quoteSqlLiteral`, `validateIdentifier`, `execFile` instead of `exec`) — no SQL/command injection found in the provisioning path.
- `services/node-agent/src/filesystem.js`'s path-jailing (`resolveSafe`) and zip-slip protection in `extractArchive()` are correctly implemented.
- `lib/sshTerminalGateway.ts` correctly checks role/ownership on both the infra-node and customer-VPS terminal paths, using single-use, 30-second Redis-backed tickets.
- `routes/domains.ts` consistently enforces resource ownership on all four endpoints, and domain uniqueness is enforced globally, not per-user.
- The payment-scoring algorithm (`lib/paymentMatcher.ts`) is weighted so no single weak signal (e.g., missing amount) can force an auto-approval on its own, and the SMS-based payment path explicitly hardcodes `manual_review` regardless of score, with a comment warning future editors not to reintroduce auto-approval there.
- Cross-checking this repo's own `docs/COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md` against actual code confirmed several of its claimed fixes genuinely hold up: billing cron scheduling (H6), `settingsRouter` single-mount (M8), SSH-ticket audit logging (H9), and removal of dead payment-verification files (M7).

---

## Action Plan & Priority Matrix

**P0 (Immediate Fix Required):**
1. #1 — Auth account-takeover via unverified email linking
2. #7 — Hardcoded default DB/JWT secrets in self-hosted Supabase compose
3. #15 — Hardcoded personal credentials + bypassed dev-role safety invariant

**P1 (High Priority):**
4. #16 — Billing transaction atomicity broken (subscription writes escape `tx`)
5. #17 — Node-agent IP allowlist bypassable via spoofed `X-Forwarded-For`
6. #13 — Discord bot payment-approval authorization fallback
7. #2 — Systemic silent exception swallowing in node status collectors
8. #5 — Port allocation collision risk in project provisioning
9. #3 — yum/CentOS support claimed but not implemented
10. #6 — Deprovisioning errors silently discarded
11. #4 — Docker image pull failure silently swallowed
12. #14 — Race condition in deployment env var read-modify-write
13. #10 — Hardcoded localhost fallback + silent failure on public site

**P2 (Medium Priority):**
14. #19 — Orphaned Traefik route possible on partial domain-activation failure
15. #18 — Inconsistent audit-log coverage on filesystem/git-push operations
16. #9 — Unsanitized `dangerouslySetInnerHTML` in signature preview
17. #8 — Hardcoded real-looking fallback IP in webmail DNS UI
18. #11 — Dead example files left in production `src/`
19. #12 — Non-byte-faithful webhook raw-body fallback
20. #20 — Unused duplicate invoice-PDF generator (dead code + unused dependency)

---

*Report compiled from a multi-pass audit covering authentication, RBAC, payments/billing, webhooks, the remote filesystem/SSH terminal surface, custom domains/SSL, the node-provisioning agent, both bot services, mobile admin, and all first-party shared packages.*
