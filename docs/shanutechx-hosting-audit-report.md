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

The six vendored `@shanutechx/{auth,postgrest,realtime,storage,supabase,functions}-js` packages (~300 files, forked upstream Supabase SDKs) were included in the automated scans but **not** individually hand-audited — they are not proprietary business logic and returned no anomalies. `apps/dashboard`'s and `apps/web`'s UI components were swept in full for unsafe render sinks (`dangerouslySetInnerHTML`), unvalidated `postMessage` handlers, and hardcoded/fallback environment URLs; deep line-by-line review of the frontend was reserved for the specific components those sweeps flagged, plus the webmail, project-detail, and checkout/pricing surfaces, rather than every one of `apps/dashboard`'s ~190 screens individually.

Every finding below was verified by reading the actual source file; nothing was inferred from a filename or a partial grep match without opening the file.

---

## Summary Statistics

- Total Files Audited (automated pattern scan, full coverage): **851** source files
- Files Manually Line-by-Line Verified (highest-risk subset): **~170**
- Total Defects Found: **38**
- Critical Vulnerabilities / Bugs: **3**
- High Severity: **13**
- Medium-High Severity: **4**
- Medium Severity: **13**
- Low Severity: **5**
- Hardcoded / Mock Items: **6** (one spanning 17 lines in one file)

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
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
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
    if (
      ALLOWED_DISCORD_USERS.length > 0 &&
      ALLOWED_DISCORD_USERS.includes(user.id)
    )
      return true;
    if (ALLOWED_DISCORD_ROLES.length > 0 && member?.roles?.cache) {
      return member.roles.cache.some(
        (role) =>
          ALLOWED_DISCORD_ROLES.includes(role.id) ||
          ALLOWED_DISCORD_ROLES.includes(role.name),
      );
    }
    if (
      member?.permissions?.has &&
      (member.permissions.has("Administrator") ||
        member.permissions.has("ManageGuild"))
    ) {
      return true;
    }
    return false;
  }
  ```
- **Description & Risk**: `/review-payment` calls `POST /api/internal/review-payment`, which authenticates the _bot process_ via a shared secret but never independently checks who the human behind the Discord command is — it fully trusts `isStaffAuthorized()`. If `ALLOWED_DISCORD_USERS`/`ALLOWED_DISCORD_ROLES` are left unset (both empty by default), the check falls back to Discord's own `Administrator`/`ManageGuild` permission — commonly held by community moderators who aren't company staff. Anyone with "Manage Server" in the bot's guild could approve/decline real customer payments, triggering `fulfillOrder()` (provisioning paid services for free). Compare with the web/mobile path (`routes/payments.ts`), which uses `requireAdmin` checking the server's own `role` column — a materially stronger boundary.
- **Required Remediation**: Fail closed if both allowlists are empty (log a startup warning) rather than falling back to generic Discord guild permissions; ideally have `internalBot.ts` verify the reviewing identity against your own staff table.

---

### Component: `packages/deployments`

#### 14. `packages/deployments/src/EnvManager.ts` and `apps/api/src/routes/deployments.ts` — Read-modify-write race condition on env var updates, with a full-replace API and no server-side merge/versioning

- **Category**: Bug (Race condition)
- **Severity**: Medium-High
- **Line Number(s)**: `EnvManager.ts` L17-30; `deployments.ts` L1240-1256 (`PATCH /deployments/:id/env`)
- **Actual Code**:
  ```ts
  // EnvManager.ts (SDK helper)
  async set(newVars: Record<string, string>): Promise<Record<string, string>> {
    const current = await this.load();
    const merged = { ...current, ...newVars };
    await this.client.deployments.updateEnvVars(this.deploymentId, merged);
    return merged;
  }
  ```
  ```ts
  // deployments.ts — the actual production endpoint backing the dashboard's env var editor:
  deploymentsRouter.patch('/deployments/:id/env', async (req: AuthedRequest, res) => {
    ...
    const envVarsEncrypted = encryptSecret(JSON.stringify(parsed.data.envVars), env.secretsEncryptionKey);
    const updated = await prisma.deployment.update({ where: { id: deployment.id }, data: { envVarsEncrypted } });
    // ^ full replace of the entire env var set — whatever wasn't in this request body is gone.
  ```
- **Description & Risk**: Neither the SDK helper nor the real `apps/api` endpoint it (and the dashboard's `EnvVarsPanel.tsx`) call does anything but a full overwrite with no version/ETag/compare-and-swap. I traced the one official UI that edits this (`EnvVarsPanel.tsx`) and confirmed it always loads the full existing set into local state first and merges client-side before saving — so it's safe _in isolation_. But the API itself provides no protection against two concurrent editors (two browser tabs, or any other client/script that doesn't replicate that same load-then-merge discipline) racing each other: whichever `PATCH` lands second silently wins, discarding the other's changes with no conflict detection, no warning, and — because this endpoint restarts a running deployment with the new (possibly incomplete) env var set — a lost update can immediately break a live, running application.
- **Required Remediation**: Add server-side optimistic concurrency (a version/`updatedAt` check rejected on mismatch) to `PATCH /deployments/:id/env`, or support a genuine partial-merge mode (`PATCH` semantics rather than full `PUT`-style replace) so a client sending only the changed key(s) can't accidentally erase the rest.

---

### Component: `packages/db/scripts`

#### 15. `packages/db/scripts/set-dev-user.ts` — Hardcoded personal identity committed to source, with no safety checks

- **Category**: Hardcoded Value
- **Severity**: High
- **Line Number(s)**: L4-5
- **Actual Code**:
  ```ts
  const firebaseUid = "mrTThasIt7RXPk7QgbplnDK0FkR2";
  const email = "tiroshbrot123@gmail.com";

  const updated = await prisma.user.updateMany({
    where: { OR: [{ firebaseUid }, { email }] },
    data: { role: "dev" },
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

### Component: `apps/api/src/routes/gitConnect.ts`

#### 21. GitHub App installation ownership can be silently reassigned between customers

- **Category**: Bug (Authorization flaw)
- **Severity**: Medium-High
- **Line Number(s)**: L88-107
- **Actual Code**:
  ```ts
  await prisma.gitHubInstallation.upsert({
    where: { installationId: installation_id },
    create: { userId: verified.userId, installationId: installation_id, ... },
    update: {
      userId: verified.userId,   // ← reassigns ownership on every callback, no check against existing owner
      accountLogin: details.accountLogin,
      accountType: details.accountType,
      avatarUrl: details.avatarUrl,
    },
  });
  ```
- **Description & Risk**: `installation_id` is a GitHub-side identifier for one App installation on a GitHub org/account and can legitimately be reachable by more than one GitHub user if they're both members/admins of that org. `listConnectedAccounts` (`lib/gitProviders/github.ts:74`) is strictly scoped by `where: { userId }`. So if this `installation_id` is already linked to Customer A on ShanuTechX, and Customer B (also a member of the same GitHub org) completes their own connect flow against the same installation, the `update` branch silently overwrites `userId` to B. A loses the connected account (it disappears from their `/git/accounts` list) and B gains it — including the ability to browse/deploy from whatever private repos that installation grants.
- **Required Remediation**: On the `update` branch, if a row already exists with a different `userId`, don't silently reassign it — reject the callback or require the original owner to explicitly disconnect first.

---

### Component: `apps/api/src/routes/teams.ts` + `apps/api/src/middleware/rbac.ts`

#### 22. Team invite `resourcePermissions` are never validated against the granter's own access or the resource's existence

- **Category**: Bug (Authorization flaw / privilege escalation via delegation)
- **Severity**: Medium-High
- **Line Number(s)**: `teams.ts` L186-197 (schema), L215 (`canInvite` check), L227 (stored verbatim), L389-397 (`ResourcePermission.createMany` on accept); `rbac.ts` L124-163 (`canAccessResource`)
- **Actual Code**:
  ```ts
  // teams.ts — anyone who passes canInvite can specify ANY resourceId:
  const canInvite = isOwner || myMembership?.role === 'admin' || req.user!.role === 'dev';
  ...
  resourcePermissions: (parsed.data.resourcePermissions as any) ?? undefined,   // stored as-is, no cross-check
  ```
  ```ts
  // teams.ts, on accept — grants created directly from the invite's stored payload, no validation:
  await tx.resourcePermission.createMany({
    data: (rawPermissions as any[]).map((p) => ({
      teamMemberId: newMember.id,
      resourceType: p.resourceType,
      resourceId: p.resourceId,
      permission: p.permission,
    })),
  });
  ```
  ```ts
  // rbac.ts — the grant is honored purely by resourceType+resourceId match:
  return membership.permissions.some(
    (p) =>
      p.resourceType === resourceType &&
      p.resourceId === resourceId &&
      p.permission !== "none",
  );
  ```
- **Description & Risk**: `canAccessResource`'s team branch is correctly scoped to `team: { ownerId: resourceOwnerId }`, which does prevent one customer's team from granting access to a _completely unrelated_ customer's resources. But within a single team, nothing checks that (a) the granted `resourceId` actually belongs to the team owner at all, or (b) the team member _creating_ the invite (an "admin"-role member, not necessarily the owner) already holds `manage` permission on that specific resource themselves. A team owner might grant "admin" role purely for roster management, without intending that person to be able to unilaterally hand _new_ invitees `manage` access to any of the owner's deployments/VPS/managed databases/SMTP/LiveKit resources — but as written, any "admin"-role member can do exactly that, with the owner never in the loop.
- **Required Remediation**: When creating or updating resource permissions (here and in `PATCH /teams/:id/members/:memberId`), validate that each `resourceId` exists and belongs to the team owner, and that a non-owner actor already holds at least the permission level they're trying to grant.

---

### Component: `apps/api/src/routes/zipDeployments.ts`

#### 23. Unbounded archive extraction on the shared control-plane server — decompression-bomb DoS

- **Category**: Bug (Missing resource limit / multi-tenant isolation gap)
- **Severity**: Medium-High
- **Line Number(s)**: L23-26 (upload limit), L86-96 (extraction) — no decompressed-size cap, entry-count cap, or command timeout exists anywhere in the file
- **Actual Code**:
  ```ts
  const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max ZIP upload
  ...
  if (isZip) {
    await execFileAsync('unzip', ['-o', tempArchivePath, '-d', targetDir]);
  } else {
    await execFileAsync('tar', ['-xf', tempArchivePath, '-C', targetDir]);
  }
  ```
- **Description & Risk**: _(Note: I built and tested actual malicious archives — a `../../` relative traversal, an absolute-path entry, and a symlink-follow-through tar attack — against this environment's exact `unzip`/`tar` binaries. All three were correctly blocked, so this is **not** a path-traversal/RCE finding.)_ What does hold up: the only size control is a 100MB cap on the _compressed_ upload — nothing caps the _decompressed_ output size or entry count, and `execFileAsync` is called with no `timeout`. Extraction runs via `child_process` directly inside the **`apps/api` process itself** — the shared control-plane server handling every tenant's traffic — writing to local disk (`/var/lib/shanutechx/workspaces` by default), not an isolated per-customer node. A single authenticated customer (the bar is simply owning any one deployment) can upload a small, highly-compressible archive that decompresses to tens of gigabytes, filling shared disk or pinning CPU for every other tenant.
- **Required Remediation**: Cap decompressed size and entry count before/during extraction, add a `timeout` to the `execFileAsync` calls, and consider moving extraction into the same per-customer node-agent sandbox that already handles this safely for the browser-IDE file manager.

---

### Component: `apps/api/src/middleware/rbac.ts` (general-purpose authorization)

#### 24. `canAccessResource` grants any admin access to every unassigned customer's resources, contradicting its own documented behavior

- **Category**: Bug (Authorization flaw / doc-vs-code mismatch)
- **Severity**: Critical
- **Line Number(s)**: `rbac.ts` L124-134 (the check), L58-72 (the docstring it contradicts), L202-206 (a nearby helper that documents the _intended_, narrower scope of this rule)
- **Actual Code**:
  ```ts
  // rbac.ts docstring on verifyResourceOwnership, describing the intended rule:
  // "An admin can only act on a resource owned by a customer who
  //  is explicitly assigned to them (`User.assignedAdminId`)..."
  ```
  ```ts
  // canAccessResource — what's actually implemented:
  if (req.user?.role === "admin") {
    const owner = await prisma.user?.findUnique({
      where: { id: resourceOwnerId },
      select: { assignedAdminId: true },
    });
    if (!owner) return true;
    return (
      owner.assignedAdminId === req.user.id || owner.assignedAdminId == null
    );
  }
  ```
  ```ts
  // A separate, correctly-scoped helper a little further down in the SAME file
  // documents where this "unassigned is visible" rule was actually meant to apply:
  /**
   * Returns the set of customer user IDs visible under the "assigned OR
   * still unassigned" rule — used for anything that's a shared
   * work queue rather than a strictly-owned resource: tickets and the
   * payment review queue.
   */
  async function assignedOrUnassignedCustomerIds(req: AuthedRequest): Promise<string[] | null> { ... }
  ```
- **Description & Risk**: `User.assignedAdminId` is an optional field (`String?`, no default in `schema.prisma`) — meaning it is `null` for every customer until a `dev` user explicitly runs `PATCH /admin/customers/:userId/assign`. `canAccessResource` treats a `null` `assignedAdminId` as "any admin may access this," which is exactly the rule the codebase's own nearby comment says was designed _specifically_ for shared queues (support tickets, payment review) — not for strictly-owned, sensitive resources. But `canAccessResource`/`verifyResourceOwnershipAsync` is the general-purpose gate used across 12 route files: `smtp.ts`, `apiKeys.ts`, `domains.ts`, `vps.ts` (including SSH terminal ticket issuance), `livekit.ts`, `managedDatabases.ts`, `deployments.ts`, `filesystem.ts` (the remote IDE), `invoices.ts`, `deployWebhooks.ts`, `zipDeployments.ts`, and `nodeEngine.ts`. In practice this means **any `admin`-role staff account has full manage-level access to every customer who hasn't yet been manually assigned to a specific admin** — likely most or all customers, since assignment is a manual `dev`-only action with no evidence it happens automatically at signup. I also checked `admin.ts`'s ban/unban endpoints (L287, L318) and found they apply **no** `assignedAdminId` scoping at all, reinforcing that the "assign customers to admins" boundary isn't consistently enforced as a real security control anywhere it's used.
- **Required Remediation**: Decide the intended model explicitly: if unassigned-customer visibility should really be admin-wide, update the misleading docstring and treat it as accepted; if not (as the docstring suggests), split the "unassigned = visible" rule out of `canAccessResource` entirely and keep it only in `assignedOrUnassignedCustomerIds`'s narrower, ticket/payment-queue-specific callers.
  - **Additional corroborating evidence**: the same "assigned OR unassigned" rule is duplicated in `ownedResourceWhere` (`rbac.ts` L275-289, used to scope _list_ queries like "an admin's managed databases/deployments"), whose own docstring says "admin → only customers **assigned to them**" — again contradicted by the `{ assignedAdminId: null }` branch actually included in the query. This is the same mismatch appearing in a third place, confirming it's a consistent, systemic pattern across the RBAC module rather than an isolated slip.

#### 25. First-boot setup endpoint lets anyone with network access claim the permanent `dev` (platform owner) role, including by hijacking a pre-existing account

- **Category**: Bug (Authorization flaw / insecure first-run setup)
- **Severity**: High
- **Line Number(s)**: `apps/api/src/routes/setup.ts` L67-88 (unauthenticated when uninitialized), L173-187 (dev-user create/promote logic)
- **Actual Code**:
  ```ts
  setupRouter.post('/setup/initialize-main-node', async (req: Request, res: Response, next: NextFunction) => {
    const isInitialized = !!existingMainNode && devCount > 0;
    if (isInitialized) {
      return requireAuth(req as AuthedRequest, res, () => requireAdminOrDev(...));
    }
    // First run bootstrap — proceed directly (NO AUTH REQUIRED)
    return proceedWithInitialization(req, res);
  });
  ```
  ```ts
  // 4. Create/Ensure Dev Admin User
  let devAdmin = await prisma.user.findUnique({ where: { email: devAdminEmail.toLowerCase() } });
  if (!devAdmin) {
    devAdmin = await prisma.user.create({ data: { email: devAdminEmail.toLowerCase(), role: 'dev', ... } });
  } else if (devAdmin.role !== 'dev') {
    devAdmin = await prisma.user.update({ where: { id: devAdmin.id }, data: { role: 'dev' } });   // promotes an EXISTING account
  }
  ```
- **Description & Risk**: Before a main node and at least one `dev` user exist, this endpoint requires no authentication at all — by design, so a fresh deployment can bootstrap itself. Two real problems follow from how it's built: (1) there is no secondary secret (a console-printed token, a local-only bind, a one-time file) gating this — whoever reaches the endpoint first over the network _is_ the permanent platform owner, and the two existence checks that decide "is this still open" are plain, unlocked `SELECT`s with no transaction, so two concurrent callers during the bootstrap window can race each other; (2) the dev-user step looks up by e-mail and **promotes an existing user to `dev` if one is found**, rather than only ever creating a fresh account. If anyone had already signed up as an ordinary customer using the e-mail address the real operator intends to use for the platform's owner account (predictable addresses like an org's `admin@`/`hello@` are an obvious target), running the legitimate setup flow with that e-mail silently hands `dev` role to whoever already controls that pre-existing account/login, not to whoever runs the wizard.
- **Required Remediation**: Gate the unauthenticated branch behind a one-time setup token that's only available to whoever has server/console access (e.g., printed to logs or read from a local file at first boot, the way many self-hosted platforms do it), and make step 4 fail loudly instead of silently promoting a pre-existing account when the target e-mail already belongs to a non-dev user.

---

#### 26. Any `admin` can promote any user — including a customer — directly to `admin`, with only the `dev` role specially protected

- **Category**: Bug (Missing logic / least-privilege gap)
- **Severity**: Medium
- **Line Number(s)**: `apps/api/src/routes/admin.ts` L152-198
- **Description & Risk**: `PATCH /admin/staff/:userId/role` (mounted under `requireAuth, requireAdmin`) blocks self-role-changes, blocks demoting a `dev`, and blocks assigning the `dev` role unless the actor is already `dev` — but there is no equivalent restriction on an `admin` assigning the `admin` role itself to an arbitrary target, including a `customer` account that was never vetted as staff. Combined with Finding #24, a single compromised or malicious `admin` account can mint an unlimited number of peer `admin` accounts, each of which then inherits the same default access to every unassigned customer.
- **Required Remediation**: Require `dev`-level approval (or at least a second-admin confirmation step) for granting the `admin` role, not just the `dev` role.

---

### Component: `apps/api/src/routes/webmailAuth.ts`

#### 27. The "single-use" webmail SSO ticket is never actually invalidated after use

- **Category**: Bug (Logic error / Auth flaw — doc-vs-code mismatch)
- **Severity**: High
- **Line Number(s)**: L100-131 (mint, docstring claims single-use), L149-186 (exchange — no consumption tracking anywhere)
- **Actual Code**:
  ```ts
  /**
   * POST /api/webmail/auth/sso-exchange
   * Exchanges a single-use SSO ticket for a long-lived Webmail session token.
   */
  webmailAuthRouter.post('/webmail/auth/sso-exchange', async (req: Request, res: Response) => {
    ...
    const payload = jwt.verify(parsed.data.ssoToken, env.projectAuthJwtSecret, { algorithms: ['HS256'] }) as any;
    if (payload.type !== 'sso_ticket' || !payload.accountId) { ... }
    const account = await prisma.smtpAccount.findUnique({ where: { id: payload.accountId }, ... });
    ...
    const token = jwt.sign({ ..., type: 'webmail_session' }, env.projectAuthJwtSecret, { expiresIn: '7d', ... });
    res.json({ ok: true, token, account: omitCredentialRef(account) });
  });
  ```
- **Description & Risk**: The ticket minted at `/webmail/auth/sso-ticket` (returned as `webmailUrl: /webmail?ssoToken=${ssoToken}`) is a plain JWT valid for 60 seconds — but "single-use" is only enforced by the docstring's comment, not the code. There's no `jti`/nonce recorded anywhere and checked on exchange (no Redis call, no DB table — confirmed by grep across the whole file), so the _same_ ticket can be exchanged for a fresh 7-day `webmail_session` token as many times as it's presented within that 60-second window, by anyone who has it. Because the ticket travels as a URL query parameter, it's exactly the kind of value that leaks via browser history, `Referer` headers to any embedded third-party resource, and access/proxy logs — all with a much longer lifetime than 60 seconds. This same codebase's own `lib/sshTerminalGateway.ts` makes an identical "single-use" claim but actually backs it with a real Redis-stored, delete-on-consume ticket (verified in Addendum 3) — the webmail path doesn't follow that established, correct pattern.
- **Required Remediation**: Store each minted `ssoToken`'s `jti` in Redis (or the DB) with a short TTL matching the JWT expiry, and delete it in the same request that successfully exchanges it — reject exchange attempts for a `jti` that's already been consumed or was never issued, the same way `sshTerminalGateway.ts` already does.

---

### Component: `apps/api/src/routes/me.ts`

#### 28. Any authenticated customer can self-promote directly to `dev` (platform superuser) in a single API call

- **Category**: Bug (Logic error / complete authorization bypass)
- **Severity**: Critical — the most severe finding in this audit
- **Line Number(s)**: L74-121, specifically the missing check at L90-102
- **Actual Code**:
  ```ts
  const updateRoleSchema = z.object({
    role: z.enum(['customer', 'support', 'dev', 'admin']),
  });

  meRouter.patch('/me/role', requireAuth, async (req: AuthedRequest, res) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // BUG-M03 FIX: Admins must not be able to assign themselves the admin or dev role
    // via this endpoint — that would let a demoted admin re-promote themselves.
    const currentRole = req.user!.role;
    const targetRole = parsed.data.role;

    if (currentRole === 'dev') {
      return res.status(403).json({ error: 'Developer accounts cannot change roles via this endpoint. Use the admin panel.' });
    }
    if (currentRole === 'admin' && targetRole === 'admin') {
      return res.status(400).json({ error: 'You are already an admin.' });
    }
    // Prevent self-promotion to admin from support role
    if (currentRole === 'support' && targetRole === 'admin') {
      return res.status(403).json({ error: 'Role promotion must be performed by another admin via the staff panel.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { role: parsed.data.role },   // ← executes with NO check ever having rejected targetRole === 'dev'
      ...
    });
    ...
  });
  ```
- **Description & Risk**: The comment directly above this code claims the fix blocks self-assignment of "the admin **or dev** role" — but tracing every branch that actually executes, the only guards are: (1) an existing `dev` can't use this endpoint, (2) an `admin` can't redundantly re-set themselves to `admin`, and (3) a `support` user can't set themselves to `admin`. **There is no check anywhere in this function that rejects `targetRole === 'dev'` from a non-dev account.** `updateRoleSchema` explicitly allows `'dev'` as a valid value in the request body. The result: any authenticated user — including a brand-new `customer` signup, the lowest-privilege role in the system — can call `PATCH /api/me/role` with `{"role": "dev"}` and `prisma.user.update` will set their own role to `dev` immediately, with no approval step, no audit gate beyond the same best-effort `auditLog.create(...).catch(() => null)` every other change gets, and no server-side rejection at all. `dev` is this platform's superuser role — it bypasses the `assignedAdminId` scoping entirely (see Finding #24), can create/promote other staff (Findings #25, #26), and has unrestricted access to every customer's VPS, deployments, secrets, and mailboxes across the whole platform. This is a complete, one-request, self-service privilege escalation to full platform ownership, requiring nothing more than a normal account.
- **Required Remediation**: Add an explicit `if (targetRole === 'dev') return res.status(403)...` guard (matching what the comment already claims is there), and consider whitelisting only the specific _downward_ transitions this endpoint is meant for (e.g., `admin → support`) rather than blacklisting a growing set of forbidden transitions one at a time.

---

### Component: `apps/api/src/lib/wildduckClient.ts` + `infra/wildduck/api.toml`

#### 29. The self-hosted mail server ships with a fixed, publicly-known API access token

- **Category**: Hardcoded Value
- **Severity**: High
- **Line Number(s)**: `wildduckClient.ts` L67-68; `infra/wildduck/api.toml` L5 (the live config actually mounted into the container)
- **Actual Code**:
  ```ts
  // wildduckClient.ts — client-side fallback if WILDDUCK_API_KEY isn't set:
  const apiKey = env.wildduckApiKey || "secret-wildduck-api-token";
  ```
  ```ts
  // env.ts — confirms there's no required()/validation forcing a real value:
  wildduckApiKey: process.env.WILDDUCK_API_KEY ?? '',
  ```
  ```toml
  # infra/wildduck/api.toml — mounted read-only into the wildduck-api container
  # at infra/control-plane/docker-compose.yml:591 — this is the SERVER-SIDE
  # credential the mail API actually checks incoming requests against:
  [api]
  port = 8080
  host = "0.0.0.0"
  accessToken = "secret-wildduck-api-token"
  ```
- **Description & Risk**: The WildDuck mail server's REST API — which can create/delete mailboxes, reset passwords, and read/send mail for every customer's inbox — is configured via a static, committed file to accept the literal string `secret-wildduck-api-token` as its master access token, bound to `0.0.0.0`. This exact string is duplicated as the client-side fallback in `wildduckClient.ts`, so the two sides "just work" together out of the box — meaning an operator following the `docker/`/`infra/control-plane` self-hosted path gets a fully functional mail server whose API credential is already public in this repository, unless they separately notice and hand-edit `api.toml` (a step nothing prompts them to take). Note this is inconsistent with the _other_ deployment path, `infra/deploy-platform.sh` (L19), which correctly generates a random secret via `openssl rand -hex 16`.
- **Required Remediation**: Template `api.toml`'s `accessToken` from an environment variable (the same way `docker-compose.yml` already passes `WILDDUCK_API_KEY` to `apps/api`) instead of hardcoding it, and make `env.wildduckApiKey` a `required()` field like the platform's other genuine secrets rather than defaulting to `''`.

---

### Component: `apps/api/src/routes/managedDatabases.ts`

#### 30. "Additional database users" are pure metadata — no real user is ever created on the database engine

- **Category**: Missing Logic
- **Severity**: High
- **Line Number(s)**: L360-407 (create), L408-423 (delete), L424-470 (update) — none of the three call out to `nodeAgentClient`
- **Actual Code**:
  ```ts
  // POST /managed-databases/:id/users — the entire handler:
  const rawPassword = parsed.data.password || crypto.randomBytes(16).toString('hex');
  const passwordEnc = encryptSecret(rawPassword, env.secretsEncryptionKey);
  const newUser = await prisma.managedDatabaseUser.create({
    data: { databaseId: db.id, username: parsed.data.username, passwordEnc, role: parsed.data.role },
  });
  ...
  res.status(201).json({ user: { id: newUser.id, username: newUser.username, role: newUser.role, password: rawPassword, ... } });
  ```
  Compare with the master-password endpoint a little further down in the **same file**, which does it correctly:
  ```ts
  // POST /managed-databases/:id/master-password:
  if (db.containerId && db.node && db.status === "running") {
    const { rotateDatabasePasswordOnNode } =
      await import("../lib/nodeAgentClient");
    await rotateDatabasePasswordOnNode(db.node, db.containerId, {
      type: db.type as any,
      oldPassword,
      newPassword: parsed.data.newPassword,
    });
    // (and returns 502 if that live call fails, rather than silently proceeding)
  }
  ```
- **Description & Risk**: I checked every exported function in `lib/nodeAgentClient.ts` (20 functions total) — there is no function anywhere for creating, deleting, or altering an individual database user/role on the actual engine, and none of the three `/managed-databases/:id/users*` handlers import or call anything from `nodeAgentClient` at all. `POST /managed-databases/:id/users` generates a real-looking random password, encrypts it, stores a row in the platform's own `ManagedDatabaseUser` table, and returns `201 Created` with credentials that **do not exist on the real database server** — no `CREATE USER`/`CREATE ROLE`/`GRANT` statement is ever issued against the customer's actual Postgres/MySQL/MongoDB instance. A customer who creates an "additional user" for their team through this feature and hands out the returned password will find it simply doesn't authenticate against their real database. The same gap applies to `DELETE`/`PATCH` on that user — they only ever touch the metadata row. This is a fully-built, validated, audit-logged, REST-complete feature that does not perform the one action its name promises.
- **Required Remediation**: Add the missing engine-level operations to `nodeAgentClient.ts` (parallel to `rotateDatabasePasswordOnNode`) and call them from all three handlers, following the same "live call first, fail loudly (502) if it doesn't succeed, only then persist metadata" pattern already used for the master password.

---

### Component: `apps/api/src/routes/reviews.ts`

#### 31. "Strict" verified-purchase review gating is category-wide, not item-specific, and has no duplicate-review limit

- **Category**: Bug (Logic error / doc-vs-code mismatch)
- **Severity**: Medium
- **Line Number(s)**: L263 (comment claim), L296-320 (the actual match logic); duplicate-review gap confirmed against `schema.prisma`'s `Review` model (no unique constraint on `[userId, productId]`)
- **Actual Code**:
  ```ts
  // STRICT ITEM-LEVEL PURCHASE VERIFICATION CHECK FOR CUSTOMERS
  ...
  if (
    (targetId && (item.planId === targetId || item.serviceId === targetId)) ||
    (targetCategory && item.plan?.product?.category === targetCategory) ||   // ← any purchase in the category satisfies this
    (parsed.data.productName && item.plan?.name.toLowerCase().includes(parsed.data.productName.toLowerCase()))
  ) {
    matchingPurchase = true;
  }
  ```
- **Description & Risk**: Despite the comment's "STRICT ITEM-LEVEL" claim, a review submitted with only a `productCategory` (e.g., `'vps'`) is considered a verified match against _any_ paid order or active subscription anywhere in that category — a customer who bought the cheapest available VPS plan can post an `isVerified: true` review explicitly naming and rating a completely different, more expensive plan they never purchased. Separately, the `Review` model has no unique constraint tying a customer to at most one review per product (`schema.prisma` L1699-1716), and this endpoint doesn't check for an existing review before creating a new one, so the same verified purchaser can submit the same 5-star (or 1-star) review an unlimited number of times, inflating whatever review count/rating the public marketing site displays.
- **Required Remediation**: Require an exact `planId`/`serviceId` match (not category) for `isVerified: true` reviews when no specific item was purchased, and add a unique constraint (or an explicit existence check) on `(userId, productId)` to cap it at one review per customer per product, with updates going through an edit path instead of new inserts.

---

### Component: `apps/api/src/routes/deployments.ts`

#### 32. A second, differently-formatted copy of `getDecryptedEnvVars` is nested inside one route handler, shadowing the file's own top-level version

- **Category**: Bug (Dead/duplicate logic)
- **Severity**: Low
- **Line Number(s)**: L27-35 (the original, correct, module-level version, used at L313, L1155, L1236) vs. L939-947 (an unindented, word-for-word-equivalent duplicate sitting inside the body of `PATCH /deployments/:id/subdomain`, between two statements of that handler)
- **Actual Code**:
  ```ts
  // Top of file — the real, shared implementation, already used by three other handlers in this file:
  function getDecryptedEnvVars(deployment: any): Record<string, string> | undefined { ... }
  ```
  ```ts
  // Deep inside the subdomain-rename handler (deploymentsRouter.patch('/deployments/:id/subdomain', ...)),
  // at column 0 — breaking the surrounding indentation — sits a second, functionally
  // identical declaration of the exact same name:
    });
  } catch (err: any) {
    ...
  }

  function getDecryptedEnvVars(deployment: { envVarsEncrypted?: string | null }): Record<string, string> | undefined {
    if (!deployment.envVarsEncrypted) return undefined;
    try {
      const rawJson = decryptSecret(deployment.envVarsEncrypted, env.secretsEncryptionKey);
      return JSON.parse(rawJson);
    } catch (err) {
      logger.error({ err }, 'Failed to decrypt deployment envVarsEncrypted');
      return undefined;
    }
  }

    // Re-apply container Traefik labels on node if running
    if (deployment.status === 'running' && ...) { ... }
  });
  ```
- **Description & Risk**: Because it's a `function` declaration nested inside the subdomain handler's callback, it's syntactically legal and hoists within that handler's scope, shadowing the outer module-level version for the one call inside that same handler — so it doesn't currently cause a behavioral difference (both bodies do the same decrypt-or-undefined logic). But it's a clear, verifiable duplicate of code that already exists and is reused three other times in this same file, sitting at the wrong indentation level (a strong sign of a copy-paste or bad-merge artifact), which is exactly the kind of thing that causes real bugs later: if the shared version at L27 is ever fixed or extended (e.g., to add caching, better error context, or a new field), this shadowed copy silently keeps the old behavior for the one handler that (accidentally) uses it instead.
- **Required Remediation**: Delete the nested duplicate at L939-947 and let the subdomain handler use the shared top-level function like the rest of the file already does.

---

### Component: `apps/api/src/routes/email.ts`

#### 33. Live SMTP/IMAP password disclosure ignores this same file's own admin-scoping rules

- **Category**: Bug (Authorization flaw)
- **Severity**: High
- **Line Number(s)**: L106-125 (`/credentials`, the flat check) vs. L26-41 (`/mailboxes` list, the correctly-scoped check, in the same file)
- **Actual Code**:
  ```ts
  // GET /email/mailboxes — the LIST endpoint, a few lines above in the SAME FILE,
  // scopes admin visibility carefully:
  } else if (req.user!.role === 'admin') {
    where = {
      OR: [
        { userId: req.user!.id },
        { allowedAdminIds: { has: req.user!.id } },
        { user: { assignedAdminId: req.user!.id } },   // note: NO "OR null" fallback here
      ],
    };
  }
  ```
  ```ts
  // GET /email/mailboxes/:id/credentials — decrypts and returns the LIVE password,
  // and ignores all of the above entirely:
  const isOwner = account.userId === req.user!.id;
  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

  const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
  res.json({ smtpHost: account.smtpHost, smtpPort: account.smtpPort, username: account.smtpUsername, password, ... });
  ```
- **Description & Risk**: The mailbox-listing endpoint just above this one in the exact same file deliberately restricts what an `admin` can see to mailboxes they own, are explicitly allowlisted for (`allowedAdminIds`), or whose customer is assigned to them — with no permissive "unassigned = visible" fallback (unlike `canAccessResource`, Finding #24). But the credentials endpoint, which actually decrypts and returns the mailbox's live SMTP/IMAP password, throws all of that away and grants access to _any_ `admin` or `dev`, full stop — no ownership check, no `allowedAdminIds` check, no `assignedAdminId` check, and (checked) no audit log entry recording that a staff member viewed another customer's mail password, unlike the equivalent VPS password-reveal endpoint (`routes/vps.ts`), which does log cross-user access. The most sensitive action in the file (live credential disclosure — something customers may well reuse elsewhere) has the _weakest_ access control and the _only_ missing audit trail of everything nearby.
- **Required Remediation**: Reuse the exact `where` logic from the list endpoint (or centralize it) to gate `/credentials`, and add an audit log entry whenever an admin/dev views a mailbox password that isn't their own — matching the pattern already established for VPS.

---

### Component: `apps/api/src/routes/smtp.ts`

#### 34. `/admin/mail/telemetry` is missing its role guard — any customer can pull platform-wide mail metrics

- **Category**: Bug (Authorization flaw / missing guard)
- **Severity**: Medium
- **Line Number(s)**: L22 (router-level guard is `requireAuth` only), L118 (the route itself has no additional guard)
- **Actual Code**:
  ```ts
  smtpRouter.use(requireAuth);   // L22 — every route below requires only a valid session
  ...
  smtpRouter.get('/admin/mail/telemetry', async (_req: AuthedRequest, res) => {   // L118 — no requireAdmin/requireDev here
    const [totalMailboxes, totalStorage, sentTodayCount, accounts] = await Promise.all([
      prisma.smtpAccount.count(),
      prisma.smtpAccount.aggregate({ _sum: { storageQuotaMb: true } }),
      prisma.webmailMessage.count({ where: { folder: 'sent', createdAt: { gte: ... } } }),
      prisma.smtpAccount.findMany({ select: { customDomain: true } }),
    ]);
    res.json({ totalMailboxes, totalStorageMb: ..., totalSentToday: sentTodayCount, totalDomains: domains.size, activeRelayNodes: 1 });
  });
  ```
- **Description & Risk**: Every other route in this file that's meant to be staff-only adds an explicit `requireDev` argument (`/smtp/global-config`, `/smtp/verify`, `/smtp/send`, `/smtp-accounts` create) — this one route doesn't, so it falls through to the router-level `requireAuth` alone. I checked this pattern against every other `/admin/*` route in the codebase (`admin.ts`, `analytics.ts`, `email.ts`) and confirmed all of them are properly gated, either via a router-level `requireAdmin`/`requireDev` or an explicit in-body role check — this is the one genuine gap. The result: any authenticated customer — including a brand-new free-tier signup — can call `GET /api/admin/mail/telemetry` and learn platform-wide business metrics: total mailbox count, total provisioned storage, today's total outbound message volume, and total distinct domains hosted, across every customer on the platform.
- **Required Remediation**: Add `requireAdminOrDev` (or `requireDev`, matching this file's other staff-only routes) to this route's registration.

---

### Component: `apps/api/src/lib/r2Storage.ts` + `apps/api/src/routes/zipDeployments.ts`

#### 35. A failed archive backup to object storage is reported to the customer as a success, and the broken reference is persisted

- **Category**: Bug (Exception swallowing / false success reporting)
- **Severity**: Medium
- **Line Number(s)**: `r2Storage.ts` L64-83 (the swallow), `zipDeployments.ts` L105-124 (the unconditional success message and persisted reference)
- **Actual Code**:
  ```ts
  // r2Storage.ts — a failed upload is only logged, never surfaced to the caller:
  if (client) {
    try {
      ...
      await client.send(new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: buffer, ... }));
      return `${env.r2Endpoint}/${bucketName}/${objectKey}`;
    } catch (err) {
      logger.warn({ err, deploymentId }, 'Failed to upload ZIP to R2, fallback to local storage reference');
    }
  }
  return objectKey;   // ← just the bare key string, e.g. "zips/<id>/169...-file.zip" — nothing is actually stored at this reference
  ```
  ```ts
  // zipDeployments.ts — treats the call as unconditionally successful:
  const r2ObjectUrl = await uploadDeploymentZip(deployment.id, req.file.buffer, filename);
  res.write(JSON.stringify({ phase: 'fetch', message: 'ZIP archive extracted successfully and saved to object storage. ...' }) + '\n');
  ...
  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { ..., zipSourceUrl: r2ObjectUrl || filename, ... },
  });
  ```
- **Description & Risk**: If the R2 upload throws (network issue, expired/misconfigured credentials, bucket policy), the failure is only logged server-side — the function returns the bare object key as if it were a valid reference, described in its own comment as a "fallback to local storage," but nothing actually writes that buffer to local disk anywhere in this function. `zipDeployments.ts` then unconditionally streams "saved to object storage" to the customer's live progress feed regardless of whether the upload actually happened, and persists that non-working key into `deployment.zipSourceUrl`. The current build itself isn't affected (it runs from the already-extracted local `targetDir`), but the durability promise made to the customer is false, and any later feature that redeploys or restores from `zipSourceUrl` would silently fail against a reference that was never backed by real storage.
- **Required Remediation**: Have `uploadDeploymentZip` return a discriminated result (success/failure) instead of always a string, and have `zipDeployments.ts` only claim "saved to object storage" when it actually was — falling back to an explicit "archive backup unavailable" note (and a real local-disk copy, if that's the intended fallback) otherwise.

---

### Component: `apps/web` (public marketing site — frontend)

#### 36. Every primary "Login"/"Get Started" call-to-action on the marketing site falls back to `localhost:3001` if one env var is unset

- **Category**: Hardcoded Value
- **Severity**: Medium
- **Line Number(s)**: Confirmed identically repeated (with the same fallback) in at least 8 components: `components/Hero.tsx` L120, `components/Navbar.tsx` L169, `components/Footer.tsx` L31, `components/CtaBanner.tsx` L6, `components/Features.tsx` L421, `components/FeaturesGrid.tsx` L66, `components/PlatformShowcase.tsx` L75, `components/OrbitHero.tsx` L80, `components/ReviewCarousel.tsx` L27
- **Actual Code**:
  ```tsx
  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";
  // ...used to build the href for the site's primary "Login" / "Get Started" buttons
  ```
- **Description & Risk**: This is the same root problem as Finding #10 (a `localhost` fallback baked into `apps/web`), but far more consequential in reach: rather than one background data fetch, this fallback determines the destination of nearly every primary conversion action on the public marketing site — the navbar's login link, the hero CTA, the footer links, the pricing CTA banner, and more. If `NEXT_PUBLIC_DASHBOARD_URL` isn't set in a given deployment environment, every one of these buttons sends a real visitor to `http://localhost:3001`, which resolves to nothing (or to something else entirely) on their own machine — silently breaking the site's entire signup/login funnel with no error, no fallback UI, nothing to indicate misconfiguration.
- **Required Remediation**: Centralize this into one shared constant (the way `lib/api.ts` does for `API_BASE`) so there's a single place to fix, and fail the build (or show a visible warning banner) rather than silently defaulting to `localhost` when the env var is missing in a production build.

---

### Component: `apps/api/src/lib/webhooks.ts`

#### 37. Customer-configured outgoing webhook URLs are only validated as literal strings — domain names bypass all SSRF protection entirely

- **Category**: Bug (Server-Side Request Forgery)
- **Severity**: High
- **Line Number(s)**: L8-42 (`isSafeWebhookUrl`), L216-221 (the unrestricted `fetch` call that actually dispatches)
- **Actual Code**:
  ```ts
  export function isSafeWebhookUrl(urlStr: string): { safe: boolean; reason?: string } {
    const url = new URL(urlStr);
    ...
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '0.0.0.0' || ... ) { return { safe: false, ... }; }

    if (net.isIP(hostname)) {              // ← only runs this whole block if the URL's host is a LITERAL IP string
      if (hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('169.254.') || ...) {
        return { safe: false, reason: 'Private/Loopback/Link-local IP addresses are prohibited' };
      }
      if (hostname.startsWith('192.168.')) { return { safe: false, ... }; }
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) { return { safe: false, ... }; }
    }
    return { safe: true };   // ← any hostname that ISN'T a literal IP reaches here unconditionally
  }
  ```
  ```ts
  // fireWebhook() — the actual outbound request, a plain fetch with no DNS-resolution-time check:
  const res = await fetch(webhook.url, { method: 'POST', headers: { ... }, body, signal: AbortSignal.timeout(10_000) });
  ```
- **Description & Risk**: `net.isIP(hostname)` returns `0` (falsy) for anything that isn't a literal IPv4/IPv6 address string — which means every one of the private/loopback/link-local range checks is skipped entirely whenever the webhook URL uses a domain name instead of a bare IP. A customer registering a webhook (a fully self-service feature, used for `deployment_status_changed`, `payment_status_changed`, `order_paid`, and `ticket_updated` events) can trivially point it at a domain that resolves to an internal address — no DNS rebinding or domain registration even required, since public wildcard-DNS services exist specifically for this (e.g., `169-254-169-254.nip.io` resolves directly to the cloud metadata IP `169.254.169.254` for anyone, with zero setup). The actual dispatch is a bare `fetch()` with no IP-pinning or post-resolution validation, so the server will happily make that internal POST request. The response body isn't captured or returned to the customer (only `statusCode`/`success`/an error string are stored in `WebhookDelivery`), so this isn't a direct arbitrary-response-exfiltration primitive — but it does let any customer make the platform's own server issue blind authenticated-context POST requests to any internal address reachable from it (cloud metadata endpoints, other internal services, the node-agent, etc.), with the resulting status code/timing observable back through the delivery log.
- **Required Remediation**: Resolve the hostname to its actual IP address(es) at validation time (and ideally again immediately before connecting, or use an HTTP client that validates the connecting socket's address) and apply the private/loopback/link-local checks against the resolved IP, not the string in the URL — the same fix needed for any SSRF-prone URL-fetching feature, not just literal-IP inputs.
  - **Related, narrower gap**: `lib/discordWebhooks.ts`'s `sendTestDiscordWebhook` (called from `routes/discordWebhookConfig.ts`, which is `requireDev`-gated) accepts and `fetch()`s _any_ URL passed to it with no host restriction and no `isSafeWebhookUrl` check at all — not even the flawed one this finding describes. The blast radius is smaller since it requires a `dev`-level account, but there's no reason this feature should ever fetch a non-`discord.com` URL in the first place, so it's worth restricting to Discord's actual webhook domain regardless.

---

### Component: `apps/api/src/routes/projectAuth.ts`

#### 38. A 7-day end-user session token is delivered via URL query parameter on the OAuth callback redirect

- **Category**: Bug (Insecure token delivery)
- **Severity**: Medium
- **Line Number(s)**: `projectAuth.ts` L358-360 (the redirect), `lib/projectAuthService.ts` L20-22 (`signProjectAuthToken`, `expiresIn: '7d'`)
- **Actual Code**:
  ```ts
  const jwtToken = signProjectAuthToken({
    sub: authUser.id,
    projectId: req.params.id,
    email: authUser.email,
  });
  const finalUrl = new URL(stateEntry.redirectUrl);
  finalUrl.searchParams.set("token", jwtToken); // ← 7-day session token appended as a URL query param
  res.redirect(finalUrl.toString());
  ```
  ```ts
  // projectAuthService.ts
  export function signProjectAuthToken(
    payload: ProjectAuthTokenPayload,
  ): string {
    return jwt.sign(payload, env.projectAuthJwtSecret, { expiresIn: "7d" });
  }
  ```
- **Description & Risk**: This is the "Project Auth" feature — a Backend-as-a-Service-style OAuth proxy that lets a ShanuTechX _customer's own deployed application_ offload GitHub/Google/etc. login for _that customer's end users_. The `redirectUrl` itself is properly validated against an origin allowlist earlier in the flow (I checked `validateProjectRedirectUrl` and it's a correct, well-built origin-based allowlist — no issue there). The problem is what happens after: the newly-minted, 7-day-valid session token for the end user is appended as a plain `?token=...` query parameter on the final redirect to the customer's app, rather than delivered via a URL fragment (never sent to servers or included in `Referer` headers) or a short-lived one-time code the customer's backend exchanges server-side for the real token. A long-lived credential traveling in a URL is exposed to browser history, `Referer` leakage to any third-party script the destination page loads, and access/proxy logs on the customer's own infrastructure — the same risk class as Finding #27, but here it affects the end users of every ShanuTechX customer who adopts this OAuth feature for their own app, not just ShanuTechX's own webmail.
- **Required Remediation**: Switch to a URL fragment (`#token=...`) for SPA-style consumption, or better, redirect with a short-lived one-time exchange code and require the customer's backend to redeem it server-side for the actual 7-day session token — the same industry-standard pattern OAuth 2.0's authorization code flow uses for exactly this reason.
- **Status**: **FIXED** (Switched token delivery in `apps/api/src/routes/projectAuth.ts` to URL fragment `#token=` to prevent URL/log/Referer credential leakage).

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
- `lib/secretsVault.ts` implements AES-256-GCM correctly with a fresh random IV per encryption; `routes/secrets.ts` is `admin`/`dev`-gated end-to-end with metadata-only listing, a separate per-key reveal endpoint, transaction-wrapped bulk import, and audit logging on every mutating action.
- `lib/gitProviders/state.ts`'s OAuth `state` parameter is HMAC-signed, time-boxed (5 min), and provider-bound — explicitly fixing a prior bug where the old code used a predictable state value, which I verified is no longer the case.
- `routes/containers.ts` (admin-only node/container management) is fully `requireAdminOrDev`-gated with per-action audit logging.
- Actual malicious ZIP/TAR archives (relative-path traversal, absolute-path entries, symlink-follow-through) were built and tested against `zipDeployments.ts`'s extraction step — all three were correctly blocked by the underlying `unzip`/`tar` binaries in this environment, so no zip-slip/tar-slip vulnerability was confirmed there.
- `routes/admin.ts`'s customer-listing endpoint correctly scopes results to `assignedAdminId: req.user.id` for plain admins (only `dev` sees everyone) — the gap is specifically in the deeper `canAccessResource` check and the ban/unban actions, not this list view.
- `lib/apiKeys.ts` correctly uses SHA-256 hashing with a high-entropy 192-bit random key for API-key storage/lookup, and the auth middleware checks revocation and account-ban status on every request.
- `routes/knowledgebase.ts` and `routes/cms.ts` are consistently gated (reads public/authenticated, writes admin-only), and the public `/cms/contact` submission endpoint sits behind the app's global rate limiter.
- `routes/managedDatabases.ts`'s master-password rotation and `routes/pushTokens.ts`'s device-token registration both handle real-world edge cases correctly and transparently (the latter even carries an honest code comment flagging it as untested against a live device rather than overstating its own reliability).
- `routes/livekit.ts` and `routes/templates.ts` are consistently gated by `canAccessResource`/`requireAdminOrDev` respectively — no new access-control gaps found in either.
- `routes/nodes.ts` shows the clearest evidence of a genuinely mature prior hardening pass in the whole codebase: node registration uses a `SERIALIZABLE` transaction to close a documented TOCTOU race (BUG-L05), the node-agent stats endpoint correctly authenticates via a separate timing-safe cluster secret before the admin session middleware even runs (BUG-08), and provisioning logs are actively scrubbed for the cluster secret in four different encodings — raw, URL-encoded, base64, and base64url (BUG-10 / BUG-M01).
- `routes/settings.ts` is fully and consistently gated. After finding Finding #34, every other `/admin/*`-prefixed route across `admin.ts`, `analytics.ts`, and `email.ts` was specifically cross-checked for the same missing-guard pattern — all of them were confirmed properly protected (via router-level middleware or an explicit in-body role check), so #34 is an isolated gap, not a systemic one.
- `lib/r2Storage.ts` contains an unusually candid engineering comment that explicitly discloses and reasons about a real architectural limitation (a single shared R2 credential, not per-project-scoped) before I found it myself — explicitly noting it's acceptable only because the feature is currently dev-only, and flagging that it needs revisiting before any customer-facing self-service use. This kind of honest, forward-looking documentation is exactly what a maintainer should want, and it meant that limitation didn't need to be written up as a new "hidden" finding.
- A full sweep of every `dangerouslySetInnerHTML` call site across the entire frontend (`apps/dashboard` and `apps/web` combined, 16 occurrences) confirmed Finding #9 is the _only_ unsanitized one — every other instance either already passes through `sanitizeHtml()` (the webmail viewers) or renders fully static, developer-authored content with no user- or CMS-supplied data in the interpolation (structured JSON-LD SEO blocks, inline `<style>` blocks, a chunk-reload-retry script). No `postMessage` event listeners exist anywhere in the frontend, so that class of cross-origin messaging vulnerability doesn't apply here at all.
- `orders.ts`'s `recalculateTotal` (used by the checkout flow) computes order totals entirely from server-side `plan.price`/`service.price` lookups — the dashboard's cart/checkout pages carry no client-supplied price or amount that the backend trusts, so price tampering via the client wasn't reproducible.
- A targeted sweep for several other major web-vulnerability classes came back clean across `apps/api`: CORS/CSRF (`middleware/csrfProtection.ts`'s origin allowlist uses a correctly `^...$`-anchored regex for `*.shanutechx.com`, not a bypassable substring/unanchored check); mass assignment (no route spreads raw `req.body` into a Prisma `create`/`update`, and no Zod schema anywhere uses `.passthrough()` to defeat its own field-stripping); prototype pollution and unsafe deserialization (no deep-merge utilities or `eval`/`new Function` calls exist in the codebase); and JWT algorithm-confusion (all three `jwt.verify()` call sites explicitly restrict to `algorithms: ['HS256']`, and the primary Firebase login path correctly uses `verifyIdToken` rather than a manual decode). The OAuth `redirect_uri`/`redirectUrl` validation in `routes/projectAuth.ts` also holds up — it's a proper origin-based allowlist, not a path- or substring-based check that a `?redirectUrl=` bypass could defeat.

**One small note not written up as a full finding:** `routes/backup.ts`'s `/api/cron/backup` accepts its shared secret via either an `x-cron-secret` header or a `?secret=` query parameter (`verifySharedSecret(req.headers['x-cron-secret'] ?? req.query.secret, ...)`, itself correctly timing-safe). The query-param path is unnecessary given the header option already exists, and query strings are more likely to end up in access/proxy logs — worth dropping the query-param fallback.

---

## Action Plan & Priority Matrix

**P0 (Immediate Fix Required):**

1. #28 — Any authenticated customer can self-promote directly to `dev` (platform superuser) in one API call
2. #1 — Auth account-takeover via unverified email linking
3. #24 — Any admin has default access to every unassigned customer's resources (contradicts its own documented rule)
4. #33 — Live mailbox password disclosure ignores all admin-scoping, unlike the rest of the same file
5. #25 — First-boot setup endpoint allows unauthenticated dev-role takeover / pre-existing-account hijack
6. #7 — Hardcoded default DB/JWT secrets in self-hosted Supabase compose
7. #15 — Hardcoded personal credentials + bypassed dev-role safety invariant

**P1 (High Priority):** 8. #37 — Outgoing webhook URLs bypass SSRF protection via domain names (customer self-service, no rebinding needed) 9. #29 — Self-hosted mail server ships with a fixed, publicly-known API access token 10. #30 — "Additional database users" feature never provisions a real user on the database engine 11. #27 — Webmail SSO "single-use" ticket has no consumption tracking, replayable for a 7-day session 12. #26 — Any admin can promote any user (including a customer) to admin 13. #16 — Billing transaction atomicity broken (subscription writes escape `tx`) 14. #17 — Node-agent IP allowlist bypassable via spoofed `X-Forwarded-For` 15. #13 — Discord bot payment-approval authorization fallback 16. #23 — Unbounded archive extraction on shared control-plane server (DoS) 17. #21 — GitHub App installation ownership silently reassignable 18. #22 — Team invite resource-permission delegation not validated 19. #2 — Systemic silent exception swallowing in node status collectors 20. #5 — Port allocation collision risk in project provisioning 21. #3 — yum/CentOS support claimed but not implemented 22. #6 — Deprovisioning errors silently discarded 23. #4 — Docker image pull failure silently swallowed 24. #14 — Env var updates: unprotected race condition + full-replace API on both the SDK and the live production endpoint 25. #10 — Hardcoded localhost fallback + silent failure on public site

**P2 (Medium Priority):** 26. #19 — Orphaned Traefik route possible on partial domain-activation failure 27. #18 — Inconsistent audit-log coverage on filesystem/git-push operations 28. #34 — `/admin/mail/telemetry` missing its role guard, leaking platform-wide metrics 29. #31 — Verified-purchase review gating is category-wide with no duplicate-review limit 30. #35 — Failed archive backup to object storage is reported to the customer as a success 31. #36 — Marketing site's login/signup CTAs fall back to `localhost:3001` if an env var is unset 32. #9 — Unsanitized `dangerouslySetInnerHTML` in signature preview 33. #8 — Hardcoded real-looking fallback IP in webmail DNS UI 34. #11 — Dead example files left in production `src/` 35. #12 — Non-byte-faithful webhook raw-body fallback 36. #20 — Unused duplicate invoice-PDF generator (dead code + unused dependency) 37. #32 — Duplicate, shadowed `getDecryptedEnvVars` function in `deployments.ts` 38. #38 — Project-Auth end-user session token delivered via URL query parameter

---

_Report compiled from a multi-pass audit covering authentication, RBAC, payments/billing, webhooks, the remote filesystem/SSH terminal surface, custom domains/SSL, the node-provisioning agent, both bot services, mobile admin, the mail server integration, deployment lifecycle management, and all first-party shared packages._
