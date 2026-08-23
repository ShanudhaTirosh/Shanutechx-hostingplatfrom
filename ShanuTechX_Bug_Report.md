# ShanuTechX Hosting Platform — Independent Bug & Security Report

**Scope:** `Shanutechx-hostingplatfrom-main.zip` (monorepo — `apps/api`, `apps/dashboard`,
`apps/web`, `apps/mobile-admin`, `services/node-agent`, `packages/*`, infra/docker configs).

**Note on prior audits:** This repo already ships `docs/ShanuTechX_Code_Audit_Report.md` and
`docs/CHANGELOG_fixes_applied.md`, documenting an earlier audit pass and the fixes applied for
it. This report does **not** re-litigate that list — it independently re-checked a sample of the
claimed fixes (they generally hold up: `secretsVault.ts`, `apiKeys.ts`, `smsSignature.ts`, the
settings-PIN rewrite, and the CORS/CSRF setup in `index.ts` all look correctly implemented) and
focuses on **new findings**, including one that appears to *undo* a previously-fixed issue through
a different code path.

---

## 🔴 Critical

### 1. `GET /api/nodes/install.sh` leaks the platform's master node-agent secret, unauthenticated
**File:** `apps/api/src/routes/nodes.ts` (lines ~21, ~41–147)

This route is intentionally public (it's meant to be piped straight into `bash` on a fresh VPS),
but the returned script embeds the **live** `CLUSTER_SECRET` (`env.nodeAgentSecret`) as a literal
default shell argument:

```ts
const CLUSTER_SECRET = env.nodeAgentSecret;
...
SECRET="\${2:-${CLUSTER_SECRET}}"
```

Anyone, with no login and no API key, can run:
```
curl https://api.<domain>/api/nodes/install.sh
```
and read the real secret straight out of the script body.

That secret is not cosmetic — it's the exact `x-agent-secret` header value used to authorize
**every** privileged request the control plane sends to a node agent (deploy, container exec,
stop/start, filesystem writes — see `lib/nodeAgentClient.ts` and `routes/cockpit.ts`), and it is
also the credential `POST /api/nodes/register` accepts to register a brand-new "trusted" compute
node (`clusterSecretMatches()` in the same file). With the leaked secret an attacker can:
- Register a rogue node (`findFirst({ OR: [{ip},{label}]})` in `/nodes/register` will even let
  them **overwrite an existing node's record** by matching its `ip` or `label`), which the
  platform will then trust to receive deployment/exec traffic, or
- Directly forge `x-agent-secret` requests to any real node agent's IP, since node agents only
  check that one header.

This is functionally the same vulnerability class as the previously-fixed **C5** finding
(hardcoded `CLUSTER_SECRET` fallback) — it was patched in `clusterSecretMatches()`, but the *real*
current secret is now handed out through this separate, unauthenticated route instead.

**Fix:** never interpolate the real secret into a publicly-fetchable script. Have `install.sh`
prompt for the secret as a required, non-defaulted argument, or better, have node onboarding use
a short-lived, single-use bootstrap token (minted only from an authenticated admin/dev session)
instead of the long-lived cluster secret at all.

---

## 🟠 High

### 2. Stored XSS risk in the webmail HTML viewer (no sanitization)
**File:** `apps/dashboard/components/webmail/WebmailMessageViewer.tsx` line 74

```tsx
<div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
```

`message.htmlBody` (the `WebmailMessage.htmlBody` column) is rendered with zero sanitization —
no DOMPurify, no allow-list. Today the only write path into this field is `POST
/webmail/send` (`apps/api/src/routes/webmail.ts`), so the *current* impact is limited to a user
XSS-ing their own "Sent" copy. However:
- The model is explicitly designed with `folder: 'inbox' | 'sent' | 'drafts' | 'trash'`, and the
  whole feature (SMTP provisioning, domains, aliases) is clearly building toward real inbound
  mail. The moment an inbound-mail webhook/parser is wired up to write to this table (a natural
  next step, and the schema is already shaped for it), this becomes a **classic stored XSS from
  any external sender** — anyone who can send an email to a provisioned address gets script
  execution in the dashboard origin of whoever opens it (customer or, worse, support staff
  triaging shared inboxes), with access to that session's auth token.
- Sanitize `htmlBody` (e.g., DOMPurify with a strict allow-list) **before** storage or at
  render time, now, rather than after inbound mail ships.

### 3. Unescaped user-controlled data interpolated into transactional HTML emails
**File:** `apps/api/src/lib/emailTemplates.ts` (`renderOrderPaidEmail`, `renderPaymentReviewEmail`,
`renderTicketReplyEmail`, and others)

Values such as `customerName`, `senderName`, `ticketSubject`, and `reason` are spliced directly
into HTML template strings with plain `${...}` interpolation — no HTML-escaping:

```ts
<h1>Thank you for your order, ${customerName}!</h1>
...
<h1>New reply from ${senderName}</h1>
```

`customerName`/`displayName` traces back to `middleware/auth.ts`'s
`displayName: decoded.name ?? null`, which is the Firebase ID token's `name` claim — fully
attacker-controlled by anyone signing up (set your display name to `<img src=x
onerror=...>` or similar). This is HTML injection into every transactional email the platform
sends about that user (order confirmations, payment review emails, ticket replies), and the
`webmail.ts` send path builds the `From` header as a raw template string
(`` `"${senderName}" <${senderEmail}>` ``) which is also worth checking for CRLF/header-injection
if `senderName` isn't validated for embedded newlines.

**Fix:** HTML-escape every interpolated value in these templates (a small `escapeHtml()` helper
is enough), and validate/strip control characters from any value used to build a raw `From`/`To`
header string.

### 4. Path-traversal guard uses an unanchored prefix check
**File:** `services/node-agent/src/filesystem.js`, `resolveSafe()` (lines 19–26)

```js
function resolveSafe(deploymentId, relPath = '') {
  const base = path.resolve(WORKSPACE_ROOT, deploymentId);
  const target = path.resolve(base, relPath.replace(/^\/+/, ''));
  if (!target.startsWith(base)) {
    throw Object.assign(new Error('Path escape detected'), { statusCode: 400 });
  }
  return target;
}
```

`target.startsWith(base)` is the classic unanchored-prefix bug: it does not require a path
separator after `base`, so a deployment whose workspace directory is a string-prefix of a sibling
deployment's directory (e.g. `.../workspaces/abc` vs `.../workspaces/abcdef`) would pass this
check for `relPath = '../abcdef/some/file'`. Exploitability depends on how deployment IDs are
generated (looked fine — they appear to be random cuids, which makes an accidental or crafted
collision unlikely but not conceptually impossible if IDs are ever shortened/user-influenced).
This is a textbook flaw and cheap to close:

```js
if (target !== base && !target.startsWith(base + path.sep)) { throw ...; }
```

### 5. Archive extraction has no entry-path validation (zip-slip risk)
**File:** `services/node-agent/src/filesystem.js`, `extractArchive()` (lines 76–89)

`unzip`/`tar` are invoked directly on user-uploaded archives with no inspection of the entries'
internal paths before extraction. A crafted archive containing entries like `../../etc/whatever`
could, depending on the exact `tar`/`unzip` version and flags, write outside the intended
`targetDir` (the "zip-slip" class of bug). Consider listing entries first and rejecting any with
`..` segments or absolute paths before extracting, or extracting into a fresh temp dir and
`resolveSafe()`-validating every produced path before moving it into the workspace.

### 6. `docker-compose.prod.yml` still ships silently-falling-back weak passwords
**File:** `docker-compose.prod.yml` (Postgres, MinIO)

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-CHANGE_ME_secure_postgres_pass}
MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-CHANGE_ME_minio_root_pass}
```

An earlier fix pass converted `templates/*.yaml` (the customer-deployable app catalog) from silent
`${VAR:-default}` fallbacks to the fail-loud `${VAR:?must be set}` Compose syntax specifically to
stop deployments from silently launching with a known, public default password. The **production**
top-level compose file (Postgres — the platform's own primary database — and MinIO, its object
storage) was not updated to match, so an operator who forgets to set `POSTGRES_PASSWORD`/
`MINIO_ROOT_PASSWORD` in production gets a fully working stack with a known, previously-published
default password on their most sensitive database, rather than a refusal to start.

### 7. Rogue-node registration can silently hijack an existing node record
**File:** `apps/api/src/routes/nodes.ts`, `POST /nodes/register` (lines 163–212)

```ts
const existing = await prisma.node.findFirst({ where: { OR: [{ ip }, { label }] } });
```

Given a valid cluster secret (see Finding 1), an attacker can register a "node" whose `ip` or
`label` matches an existing real node, and the handler will **update the existing row in place**
— overwriting its recorded IP/specs/role tags. Combined with Finding 1, this means the leaked
secret doesn't just let an attacker add a new rogue node; it lets them redirect the control
plane's idea of where an *existing* trusted node lives.

### 8. `POST /api/webhooks/pr-deploy` has no signature verification
**File:** `apps/api/src/routes/prWebhooks.ts`

Unlike every other inbound webhook in this codebase (SMS: HMAC + `timingSafeEqual`; internal bot:
HMAC + `timingSafeEqual`), this route trusts `x-github-event`/`x-gitlab-event` and the JSON body
with no signature check at all:

```ts
const eventType = req.headers['x-github-event'] || req.headers['x-gitlab-event'];
const payload = req.body || {};
```

Currently low-impact (the handler only logs and returns canned JSON — it doesn't yet trigger a
real deploy), but as soon as it's wired to actually trigger/tear down preview deployments, this
becomes an unauthenticated way to spin up or destroy resources by forging a webhook POST. Add
GitHub's `X-Hub-Signature-256` / GitLab's `X-Gitlab-Token` verification now, before that wiring
lands — it's easy to forget once the endpoint "already works."

### 9. Silent fallback to the host's own SSH agent on key-decrypt failure
**File:** `apps/api/src/lib/sshTerminalGateway.ts` (lines 111–128)

```ts
} else {
  try {
    const privateKey = decryptSecret(sshKeyRef, env.secretsEncryptionKey);
    connectOpts.username = 'root';
    connectOpts.privateKey = privateKey;
  } catch {
    // May be a plain ref string for nodes added manually — fall back
    connectOpts.username = 'root';
    connectOpts.agent = process.env.SSH_AUTH_SOCK;
  }
}
```

If decrypting the stored node SSH key throws for *any* reason (corrupted ref, wrong encryption
key after a rotation, etc.), the code doesn't fail the connection — it silently retries using the
**API server host's own** `SSH_AUTH_SOCK`. This is surprising behavior for a security-sensitive
path: a decrypt failure should be a hard error surfaced to the user, not an implicit downgrade to
whatever identity happens to be loaded into the host's SSH agent (if any).

---

## 🟡 Medium

### 10. `owner == null` ambiguity gives a fail-open result in RBAC helpers
**File:** `apps/api/src/middleware/rbac.ts` — `canAccessResource`, `canSeeTicket`,
`canReviewPayment`

```ts
const owner = await prisma.user?.findUnique({ where: { id: resourceOwnerId }, select: { assignedAdminId: true } });
return owner?.assignedAdminId === req.user.id || owner?.assignedAdminId == null;
```

`owner?.assignedAdminId == null` is `true` in two different situations: (a) the customer is
legitimately unassigned (`assignedAdminId` is `null` — the intended "visible to any admin" case),
and (b) the Prisma lookup itself returned nothing (`owner` is `undefined` because
`resourceOwnerId` didn't resolve to a real user at all). Case (b) should fail closed (deny access
— something is wrong, e.g. a stale/garbage ID), but as written it grants access. Practically
low-exploitability since `resourceOwnerId` is normally read straight from a resource's own
`userId` foreign key (so the referenced user should always exist), but it's a fail-open bug in a
security-critical helper and worth tightening: `owner ? owner.assignedAdminId == null : false`.

### 11. `DELETE /nodes/:nodeId/containers/:containerId` doesn't actually delete
**File:** `apps/api/src/routes/containers.ts` (lines 96–113)

The doc comment says *"Removes/destroys a container from node"*, but the handler calls
`containerAction(node, containerId, 'stop')` — the exact same call the dedicated `stop` action
uses. This isn't a security issue, but it's a functional bug: an admin/dev clicking "delete" on
this page gets a stopped-but-still-present container, not a removed one, which will silently
resurface on the containers list and could confuse cleanup/capacity accounting.

### 12. `EmailTemplateEditor.tsx` live preview also skips sanitization
**File:** `apps/dashboard/components/supabase/EmailTemplateEditor.tsx` (lines 124–131)

Same `dangerouslySetInnerHTML` pattern as Finding 2, rendering the admin's own in-progress
Supabase-auth-email-template HTML. Low risk (self-authored content, admin-only surface) but worth
fixing for consistency/defense-in-depth while addressing Finding 2.

### 13. `cockpit.ts` SSH-ticket response exposes the raw `sshKeyRef`
**File:** `apps/api/src/routes/cockpit.ts` (line 382)

```ts
res.json({ ticket, expiresInMs: 30_000, ip: fullNode.ip, sshKeyRef: fullNode.sshKeyRef });
```

`sshKeyRef` (the vault reference string for the node's SSH private key) is sent to the browser.
It's presumably useless without `SECRETS_ENCRYPTION_KEY` (which never leaves the server), so this
isn't directly exploitable, but there's no reason for the frontend to receive this value at all —
it's unused internal plumbing being echoed back. Drop it from the response.

---

## 🟢 Low / Cleanup

- **`loadOwnedOrder()` in `payments.ts`** only special-cases `role === 'admin'`, not `dev`, unlike
  the rest of the codebase where dev is treated as a superset of admin. Not a security hole (it's
  the *more* restrictive direction — dev gets a 404 where they should have access) but inconsistent
  with the documented role model and could confuse a dev debugging a payment issue.
- Confirmed clean: no committed `.env` files, no hardcoded live-looking secrets (`sk_live_`,
  `AKIA`, PEM blocks, `ghp_`/`glpat-` tokens, Slack tokens) anywhere in the tree outside
  `.env.example` templates.
- `jwt.verify(token, env.projectAuthJwtSecret)` in `lib/projectAuthService.ts` doesn't pin
  `algorithms: ['HS256']` explicitly. Not exploitable here (no asymmetric key is ever used for
  this secret, so there's no RS256/HS256 confusion vector), but pinning it is a one-line
  defense-in-depth improvement and a good habit everywhere `jwt.verify` is called.

---

## What looked solid

For context, since a lot of ground was covered: `apps/api/src/index.ts`'s CORS allowlist + CSRF
Origin check, `lib/secretsVault.ts` (AES-256-GCM with proper IV/authTag), `lib/apiKeys.ts`
(SHA-256 over high-entropy random tokens — correct choice for a value that only needs equality
checking), `lib/smsSignature.ts` and `routes/internalBot.ts` (HMAC + `crypto.timingSafeEqual`,
done correctly), the Phase-15 scoped-admin RBAC model in `middleware/rbac.ts` (aside from Finding
10), and `routes/cockpit.ts`'s `resolveNodeAccess()` (correctly denies customers any access to
shared cluster nodes, only allowing owner/admin/dev access to their own VPS provisions) were all
implemented carefully.

---

## Addendum — deeper pass (round 2)

A second, deeper pass focused on `services/node-agent` (the code that actually runs on compute
nodes), the "Projects" / Supabase-lite database feature, the template catalog, and team invites.
This surfaced one of the most severe findings in the whole audit (14).

### 🔴 Critical

#### 14. All "Project" SQL runs as the Postgres **superuser**, and is reached via shell string-building (`exec`, not `execFile`) — command injection + full tenant-isolation break
**File:** `services/node-agent/src/projects.js`

This module backs the platform's in-house "Supabase-lite" feature (`routes/projects.ts`, gated
`requireDev` — see note on exploitability below). Every function in it uses
`child_process.exec` (which runs through a shell) with **string-concatenated, unescaped**
interpolation of `dbName`, `dbUsername`, `password`, and `sql`:

```js
async function pgExec(sql) {
  const escaped = sql.replace(/'/g, "\\'");   // does NOT correctly escape a single quote
  await execAsync(`docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_SUPERUSER} -c '${escaped}'`);
}
```

Two independent, compounding problems:

1. **The single-quote escaping is broken.** In POSIX shell, `\'` inside a single-quoted string
   does not escape the quote — it terminates the quoted string. Any `dbUsername`/`dbName`/`sql`
   value containing a `'` breaks out of the intended shell-quoting entirely, giving arbitrary
   **OS command injection** on the node (this process has Docker-socket access and is generally
   run with the privileges needed for `useradd`/`ufw`/`systemctl` elsewhere in the agent — i.e.
   root). The same unescaped-interpolation pattern repeats in `provisionProject` (the
   `docker run ... -e PGRST_DB_URI="${pgrstConnStr}" ...` command), `deprovisionProject`, and
   `listTables`.
2. **Independent of (1): every project's SQL runs as the shared Postgres instance's superuser**
   (`POSTGRES_SUPERUSER`, i.e. `postgres`), not as that project's own scoped `dbUsername` role.
   `routes/projects.ts`'s `/sql` endpoint is an intentional "run arbitrary SQL against your
   project" feature — but because `execSql` always connects as the superuser, "your project"
   isn't actually a boundary: a Postgres superuser can read `pg_shadow`/`pg_authid` (every
   project's role credentials on that node), alter or drop *any* database in the shared instance,
   and — critically — use `COPY (...) TO PROGRAM 'shell command'` to execute arbitrary OS
   commands inside the shared Postgres container, independent of the shell-escaping bug above.
   **This means the intended, in-product "run SQL against my project" feature is itself a full
   sandbox escape**, with no injection/escaping bug required at all.

**Exploitability note:** `routes/projects.ts` is locked to `requireDev` (per its own comments,
this feature is internal infrastructure for the platform team, not customer- or admin-facing),
and the values that reach `dbName`/`dbUsername` from that router are pre-sanitized to
`[a-z0-9_]` server-side before being forwarded — so problem (1) is not reachable through the
current, only caller. Problem (2), however, requires no injection at all: it's inherent to how
`execSql` connects, and is live the moment a `dev` account uses the documented `/projects/:id/sql`
feature as intended. Given how much infrastructure this platform exposes to a compromised `dev`
account already, this mainly matters as **defense-in-depth / blast-radius**: a `dev` session
hijack (XSS, leaked token, phished credential) escalates from "one dev's access" to "root on the
node + every tenant's database on it," and any future code path that forwards less-sanitized
input into these functions (a very easy mistake given the current API surface) becomes instant
RCE.

**Fix:** rewrite `projects.js` to use `execFile`/parameterized `pg` client calls instead of shell
string-building (the same pattern already used correctly in `services/node-agent/src/filesystem.js`
and `cockpit.js`), and connect to each project's database using that project's own scoped
`dbUsername`/role — never the Postgres superuser — for anything reachable from `execSql`/`listTables`.

### 🟠 High

#### 15. `GET /api/catalog/:slug` builds a filesystem path from an unvalidated route param — likely path traversal
**File:** `apps/api/src/routes/catalog.ts`, lines 172–182

```ts
catalogRouter.get('/catalog/:slug', (req, res) => {
  const filename = `${req.params.slug}.yaml`;
  const filePath = path.join(TEMPLATES_DIR, filename);
  ...
  const content = fs.readFileSync(resolved, 'utf8');
```

`req.params.slug` is used to build a filesystem path with no allow-list validation (contrast with
`lib/subdomain.ts`'s `slugify()`, or the `REGEX_SERVICE_NAME`/`REGEX_USERNAME` pattern used
throughout `node-agent/src/cockpit.js`). `path.join` does **not** stop `..` segments from
escaping `TEMPLATES_DIR`. Express (4.19, path-to-regexp defaults) matches a single `:slug`
segment as anything without a literal `/` byte in the raw URL, but **does** `decodeURIComponent`
the captured value afterward — so a request like:

```
GET /api/catalog/..%2F..%2F..%2F..%2Fetc%2Fpasswd
```

produces `req.params.slug === '../../../../etc/passwd'` after Express's own decoding, which
`path.join` will happily resolve outside `TEMPLATES_DIR`. This route only requires `requireAuth`
(any logged-in customer, not admin), and impact is bounded to files whose full resolved path ends
in `.yaml` or `.yml` — but several such files exist in this repo tree (compose files, CI
workflows) and, depending on what's actually present in the deployed API container image, this
could leak infrastructure/config files outside the intended template directory. Add a strict
`^[a-z0-9-]+$` check on `req.params.slug` before building the path, matching the pattern already
used elsewhere in this codebase.

#### 16. Team-invite acceptance never checks the accepting user's email against the invite
**File:** `apps/api/src/routes/teams.ts`, `POST /teams/invites/accept/:token` (lines 221–259)

```ts
const invite = await prisma.teamInvite.findUnique({ where: { token: req.params.token } });
if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) { ... }
...
prisma.teamMember.create({ data: { teamId: invite.teamId, userId, role: invite.role } })
```

An invite is created for a specific `email` (`POST /teams/:id/invites`), but accepting it never
verifies that `req.user!.email` matches `invite.email` — it just adds *whichever authenticated
user* presents a valid, unexpired token as a full team member at the invited role (which can be
`'admin'`). The invite token is high-entropy (`crypto.randomBytes(24)`, so not brute-forceable),
but the invite link containing it is returned directly in the `POST /teams/:id/invites` API
response and is designed to be shared over email/Slack/etc. — any of the usual token-leak vectors
(shared clipboard, browser history, an over-broad Slack channel, a referrer leak on an outbound
link from the acceptance page) lets a *different* authenticated user than the intended invitee
claim the seat, with no email check to catch the mismatch. Add
`invite.email.toLowerCase() === req.user!.email.toLowerCase()` as a precondition before creating
the membership.

### 🟡 Medium

#### 17. `resourcePermissions` on team invites is accepted by the API but never persisted
**File:** `apps/api/src/routes/teams.ts` (`POST /teams/:id/invites`) vs. `packages/db/prisma/schema.prisma` `TeamInvite` model

The invite-creation endpoint's Zod schema accepts a `resourcePermissions` array (per-resource
`manage`/`view`/`none` grants), but `prisma.teamInvite.create()`'s `data` object never includes
it, and the `TeamInvite` model has no matching column. Not a security hole (nothing is granted
that shouldn't be — if anything, the finer-grained permission the caller *intended* to scope
never takes effect, and the invitee has no explicit sub-scoping instead), but it's a real
functional gap: any admin using this field to limit an invited teammate to specific
resources is getting a full-team-role invite instead, silently.

#### 18. Cross-tenant reach depends entirely on the shared Postgres container's network scope
**File:** `services/node-agent/src/projects.js`, `POSTGRES_CONTAINER = 'shanutechx-postgres'`

Worth flagging alongside Finding 14: every project on the same node shares one Postgres
container/instance (`shanutechx-postgres`), by design ("A shared postgres container... started by
the node-stack compose file"). This is a reasonable resourcing choice, but it means the intended
isolation boundary between projects/tenants on the same node is **entirely** the
correctness of `projects.js`'s connection-scoping — there's no OS-level or container-level
separation backing it up. Given Finding 14, that boundary currently doesn't hold. If/when this
feature is hardened, consider whether per-project Postgres instances (or at minimum
row/schema-level isolation enforced by Postgres roles rather than superuser access) is worth the
added resource cost, given what's guarded behind it.

### What looked solid (round 2)

`services/node-agent/src/filesystem.js`'s and `cockpit.js`'s command execution (`execFile` with
argument arrays throughout, plus regex allow-lists on usernames/service names) is a good contrast
to Finding 14 — it's clear the codebase generally knows the correct pattern, `projects.js` just
didn't follow it. `services/node-agent/src/docker.js`'s Traefik-label construction for custom
subdomains is safe because the API layer (`lib/subdomain.ts`) strictly slugifies any
customer-supplied subdomain before it ever reaches the node agent. `POST /agent/compose/up`
(node-agent) sanitizes `projectName` and uses `execFile` correctly; the compose YAML content
itself is only ever admin/dev-authored template content read server-side, never raw customer
input. `routes/managedDatabases.ts`, `routes/invoices.ts`, and `routes/orders.ts` all scope
correctly to the calling user (or Phase-15 assigned-admin rules).

---

## Suggested priority order

1. **Finding 1** (secret leak via `install.sh`) — fix before anything else; rotate
   `NODE_AGENT_SECRET` immediately once fixed, since the current value must be treated as already
   compromised.
2. **Finding 14** (`projects.js` shell injection + Postgres-superuser SQL execution) — the
   highest-severity finding in the whole report in terms of raw capability (RCE + full
   cross-tenant DB compromise); currently gated behind `requireDev`, which limits *who* can
   trigger it but not *how bad* it is if they do. Fix before this feature (or anything like it)
   is ever extended to admin/customer access.
3. **Finding 6** (prod compose default passwords) — quick fix, high blast radius if missed.
4. **Findings 2 & 3** (unsanitized HTML in webmail viewer + email templates) — fix before any
   inbound-mail feature ships.
5. **Finding 15** (catalog template path traversal) and **Finding 16** (team-invite email
   mismatch) — both cheap, targeted fixes with real exploitability today.
6. **Findings 4, 5, 7, 8, 9** — real but lower urgency; good candidates for the next hardening
   pass.
7. **Findings 10–13, 17, 18** — cleanup / architectural notes, no urgent action needed.
