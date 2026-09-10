# ShanuTechX Hosting Platform — Enhanced Feature Spec (Vercel/Coolify/Railway alternative)

> **How this document was produced:** I extracted and read the actual source in
> `Shanutechx` (not just the README/docs) — specifically
> `apps/api/src/routes/*.ts`, `apps/api/src/lib/**`, `apps/api/src/middleware/rbac.ts`,
> and related files — to check what is genuinely implemented versus what only the
> docs claim. Every "Already built" item below is backed by a real file/line
> reference. Every "Gap" item is something I searched for and could **not** find
> in the code, or found implemented differently from the request. Nothing here is
> guessed from the README or CLAUDE.md files.

## 0. Ground rules for whoever implements this

- This is a **large, mostly-existing** monorepo (Express API in `apps/api`,
  a dashboard app, a self-hosted Supabase stack, a Postal/Wildduck mail stack,
  a node-agent service, Traefik reverse proxy). Do not re-architect from
  scratch — extend the existing routes/libs named below.
- Every new client-facing resource (deployment, database, mailbox, VPS,
  domain) must support a **`pending_configuration`** status that shows in the
  dashboard before it's usable, matching the pattern already used by
  `isPendingConfig` in `apps/api/src/routes/deployments.ts`.
- Every paid product must go through: **cart/order → payment proof →
  admin/dev approval (or auto-approval for free/zero-cost items) →
  `fulfillOrder()` auto-provision**. This pipeline already exists — reuse it,
  don't build a parallel one (see §7).
- Role `dev` (see `apps/api/src/middleware/rbac.ts`) is the platform-owner
  role: it already bypasses most restrictions. `admin` is staff who need
  `dev` sign-off for some actions (e.g. promoting someone to `dev`, per
  `apps/api/src/routes/admin.ts:80`). Keep this hierarchy — don't invent a
  new role system.

---

## 1. Git-based deployment (GitHub/GitLab, "like Vercel")

### Already built

- GitHub **App** installation flow (not raw OAuth/PAT) + GitLab OAuth app,
  both behind one provider-agnostic interface —
  `apps/api/src/lib/gitProviders/{github,gitlab,types,index}.ts`,
  `apps/api/src/routes/gitConnect.ts`.
- `GET /api/git/connect/:provider/start` → redirects to GitHub's "Install App
  & pick repos" screen or GitLab OAuth consent. The user chooses repo access
  **on GitHub's own UI**, exactly like Vercel's flow — this is not a TODO,
  it's implemented.
- `GET /api/git/repos?accountId=` — lists repos visible to an installed
  GitHub App / authorized GitLab account, for a repo-picker UI.
- **Paste-a-repo-URL** deploys are also already supported: `deployments.ts`
  accepts a bare `repoUrl` for public repos, and separately resolves a
  short-lived scoped token via `gitAccountId` when the repo needs
  authenticated access (`apps/api/src/routes/deployments.ts:108-133`).
- Gitea and Bitbucket adapters exist as stubs in `lib/gitProviders/` —
  confirm which are actually wired into `index.ts`'s provider registry
  before advertising them to users.

### Gaps / needs work

- No connector for **generic self-hosted Git URLs without OAuth** (i.e. "just
  paste any git URL, we `git clone` it directly" for repos on providers we
  don't have an App for) — only GitHub App / GitLab OAuth / public repoUrl
  are handled. Decide if that's in scope.
- Confirm the repo-picker/search UI actually exists in `apps/dashboard` (the
  API supports it; verify the frontend calls it) — I only reviewed the API
  layer in depth given the size of this codebase.

---

## 2. Archive / ZIP upload deployment

### Already built

- `apps/api/src/routes/zipDeployments.ts` handles uploading and extracting an
  archive as a deployment source — this is not something to build from
  scratch, it exists.

### Gaps / needs work

- Verify it supports formats beyond `.zip` (`.tar`, `.tar.gz`) — the request
  says "or any archive"; the route name suggests zip-only today.

---

## 3. Docker-based deployment / App Catalog

### Already built

- `apps/api/src/routes/dockerDeployments.ts`: deploy an arbitrary Docker
  image (`POST /api/deployments/docker-image`) or a `docker-compose.yaml`
  (`POST /api/deployments/docker-compose`), with `exposureMode`
  (`ssl_with_proxy` / `ssl_direct` / `no_ssl`), CPU/memory limits, and node
  selection.
- A real **App Catalog** with YAML templates already exists:
  `templates/{wordpress,n8n,grafana,redis,mongodb,uptime-kuma,livekit,
lavalink,hermes-agent,supabase-lite}.yaml`, parsed by
  `apps/api/src/lib/catalog/{catalog-manager,template-parser,env-validator}.ts`
  and served via `apps/api/src/routes/catalog.ts`. Deploying a catalog app
  that needs a database automatically provisions the managed database
  alongside it (`catalog.ts:651-682` — e.g. WordPress → MySQL, n8n →
  Postgres).
- This already covers the "Web Hosting / App Catalog / Bot Hosting are
  products, and GitHub repo deployment is a product" structure the request
  describes — these are separate route groups, not one monolith.

### Gaps / needs work

- Bot hosting language selection (Python vs Node.js) as an explicit
  first-class field: I did not find a dedicated `botHosting` route/schema
  with a `language: 'python' | 'nodejs'` selector — it looks like bot hosting
  today rides on the generic deployment/catalog routes. If a distinct
  guided flow ("pick Python or Node, then configure entrypoint/env") is
  required, it needs a thin wrapper UI + schema on top of the existing
  deployment engine, not a new backend.

---

## 4. Custom domains, subdomains, SSL, port binding

### Already built

- Traefik-based reverse proxy with automatic SSL —
  `apps/api/src/lib/traefik/{config,index,types}.ts`,
  `apps/api/src/routes/traefikStatus.ts`.
- CNAME-based custom domain attachment —
  `apps/api/src/lib/domain/{manager,cname}.ts`,
  `apps/api/src/routes/domains.ts`. A deployment must already have a
  platform subdomain before a custom domain can be attached
  (`NO_SUBDOMAIN` error path, `domains.ts:166-170`) — matches the
  requested "connect custom domain via CNAME to your platform subdomain"
  model.
- Free platform subdomain assigned per deployment on creation, with
  reserved-word and format validation — `apps/api/src/lib/subdomain.ts`.

### Gaps / needs work (real deviations from the request, confirmed in code)

1. **Subdomain format mismatch.** Current CNAME target format is
   `{deployment-subdomain}.{ROOT_DOMAIN}` (e.g. `myapp.shanutechx.com`),
   generated by `generateCnameTarget()` in
   `apps/api/src/lib/domain/cname.ts:9-24`. The request wants a dedicated
   deployment sub-zone: `{clientsubdomain}.app.shanutechx.com`. **This is a
   real change**, not already done: update `generateCnameTarget` /
   `ROOT_DOMAIN` handling (or introduce a `DEPLOYMENTS_ROOT_DOMAIN=app.
shanutechx.com` env var) so it doesn't collide with the apex domain used
   for the dashboard/API/marketing site. Update Traefik router rules,
   wildcard SSL cert scope, and DNS wildcard record accordingly.
2. **No max-domains-per-server enforcement found.** I searched
   `domains.ts` and only found a domain _count returned in a response_
   (`domains.ts:533-538`), not a cap being enforced at creation time. The
   request specifies: **max 2–3 platform-issued subdomains per deployed
   server, unlimited customer-owned custom domains**. This limit needs to
   be added (likely as a plan/product field checked in the domain-creation
   handler), it does not exist today.
3. Confirm wildcard cert coverage explicitly includes the new
   `*.app.<root>` zone once #1 is done (`jobs/ssl-renewal.ts` handles
   renewal — check it covers the new zone).

---

## 5. Managed Databases (Postgres, MySQL, Redis, MongoDB)

### Already built

- Full CRUD + connection-URI generation for all four engines —
  `apps/api/src/routes/managedDatabases.ts`. Correct default ports,
  usernames, and DSN formats per engine (`managedDatabases.ts:140-174`),
  e.g. `postgresql://postgres:***@host:5432/postgres`,
  `mongodb://root:***@host:27017/admin?authSource=admin`.
- Catalog templates auto-provision the right database type when a catalog
  app needs one (see §3).

### Gaps / needs work

- **No IP allow-list field or enforcement found** in `managedDatabases.ts`.
  The request explicitly asks for this ("ip allow list an etc") — needs a
  new field (e.g. `allowedCidrs: string[]`) plus firewall/Traefik-level (or
  Docker network / iptables) enforcement on the node running the DB
  container. This is a genuine gap, not just missing UI.
- Confirm password rotation/"change credentials" endpoints exist for
  managed DBs the way they do for the VPS product (`vps.ts` has
  `changeVpsPasswordSsh`); I didn't find an equivalent for managed
  databases in this pass — verify before assuming it's missing.
- Pricing/plan-tier limits for managed databases (storage/connection caps)
  should reuse whatever plan-limit pattern SMTP already uses (see §6),
  rather than a new one.

---

## 6. Business SMTP / Mailbox hosting

### Already built — this is the most complete section

- `apps/api/src/routes/smtp.ts` (557 lines) + `apps/api/src/lib/
smtpProvisioner.ts` already implement almost everything requested:
  - Custom domain **required** for customer mailboxes — staff/internal
    accounts default to the platform root domain, customers are forced to
    `customDomain`/`clientdomain.com` placeholders until they set one
    (`smtp.ts:317`, `smtp.ts:515`) — matches "customer must use their own
    domain, can't use ours" exactly.
  - Aliases with a per-tier `maxAliases` cap, auto-generated defaults or
    custom aliases (`generateDefaultAliases`, `smtp.ts:329-339`).
  - Storage quota in MB derived from plan tier (`storageQuotaMb`,
    `smtp.ts:340`), with internal/staff accounts getting an effectively
    unlimited quota (`999999`) — this is the "dev/staff = unlimited" pattern
    applied consistently.
  - Domain-change endpoint that re-derives all alias addresses
    (`smtp.ts:469-499`).
- Reused role gating (`isStaff = role === 'admin' || role === 'dev'`,
  `smtp.ts:393`, `smtpProvisioner.ts:54`) — consistent with the rest of the
  platform.

### Gaps / needs work

- Confirm the **DNS records-to-configure display** (MX/SPF/DKIM/DMARC for
  the customer's custom domain) is actually rendered in
  `apps/dashboard`'s SMTP section — the API/provisioner side looks solid,
  but I did not verify the frontend surfaces the exact records needed.
- "Routing rules" (forward-to, catch-all, etc.) — I did not find explicit
  routing-rule fields in `smtp.ts`; only aliases and quotas were confirmed.
  If mail routing rules beyond simple aliases are required, that's new
  work on top of the Postal/Wildduck stack (`infra/postal`,
  `infra/wildduck`) — check those services directly before building
  anything, since routing may already live there instead of in `smtp.ts`.
- Per-admin scoped access to specific mailboxes ("give some access for each
  admin for only each mailbox") — `webmailAuth.ts:112` has an
  `allowedAdminIds` array on mail accounts, which already supports this.
  Verify the dashboard UI to grant/revoke that per-admin access exists.

---

## 7. Payments, approval, and auto-provisioning

### Already built — the full pipeline exists, do not rebuild it

- Cart/order flow: `apps/api/src/routes/orders.ts` — zero-cost orders go
  straight to `auto_approved`; paid orders go to `awaiting_payment`
  (`orders.ts:210-253`).
- Payment proof review: `apps/api/src/routes/payments.ts` — admin/dev
  approves or rejects (`validStatuses` includes `manual_review`,
  `manually_approved`, `auto_approved`, `rejected`; `payments.ts:96`).
- **On approval, `fulfillOrder(orderId)` runs automatically**
  (`payments.ts:210-213`, implementation in
  `apps/api/src/lib/orderFulfillment.ts`) and provisions each purchased
  item, then emails/notifies the customer that "your products have been
  provisioned" (`payments.ts:218-221`).
- `orderFulfillment.ts` returns `manualVpsItems` separately from
  `fulfilledItems` — meaning VPS products already have a manual-fulfillment
  fallback path distinct from fully automated products. Preserve that
  distinction when adding new product types (web hosting / app catalog /
  bot hosting / databases / SMTP should all go through the **automatic**
  path, not the manual-VPS path).

### Gaps / needs work

- When adding new sellable product types (per §3/§5/§6), each needs a
  branch inside `orderFulfillment.ts`'s dispatch logic so approval →
  auto-provision actually covers them, and a corresponding "awaiting
  configuration" / "pending" state shown pre-payment-approval in the
  dashboard (reuse the `isPendingConfig` pattern from §0).

---

## 8. Self-hosted Supabase project management

### Already built

- `apps/api/src/routes/supabase.ts` (683 lines) talks to a self-hosted
  Supabase stack (Kong gateway, Studio, Auth admin API) — health checks,
  studio URL/port assignment, admin user management via
  `/auth/v1/admin/users` (`supabase.ts:32-71, 142-164, 413-458`).
- Infra for running self-hosted Supabase is under `infra/supabase` and
  `docker/supabase`, and there's even a lightweight catalog template
  (`templates/supabase-lite.yaml`) for customers who just want a small
  Supabase-like project rather than the full stack.

### Gaps / needs work

- Verify whether **customer self-service "create my own Supabase project"**
  (i.e. spinning up an isolated Supabase stack per customer, with its own
  Studio) exists, or whether today's `supabase.ts` manages a single shared
  Supabase instance for the whole platform's internal use. The route names
  read more like "manage the platform's own Supabase" than "multi-tenant
  Supabase-as-a-product" — this needs direct confirmation with whoever owns
  this module before assuming per-customer Supabase projects are supported
  end-to-end.

---

## 9. Client-owned VPS product (full Ubuntu/Debian VPS)

### Already built — and note this is different from "system nodes" (§10)

- `apps/api/src/routes/vps.ts` (900 lines) + `apps/api/src/lib/
vpsSshClient.ts` already implement, per customer-owned VPS:
  SSH exec, reboot, root password change, SFTP list/upload/download/
  delete, archive extraction, rename/mkdir/touch, and **firewall rules**
  (`getVpsFirewallRulesSsh`, `toggleVpsFirewallSsh`,
  `addVpsFirewallRuleSsh`, `deleteVpsFirewallRuleSsh`) — all callable from
  the dashboard.
- Manual admin/dev provisioning by entering IP/credentials
  (`vps.ts:109-139`), with a pre-delivery SSH/SFTP connectivity diagnostic
  before handing a VPS to a customer.
- This is the **customer-facing** VPS product referenced by the request's
  "full Ubuntu/Debian VPS-like interface" line — confirmed built, not a
  gap.

### Gaps / needs work

- OS package upgrade (`apt upgrade`) as a one-click UI action wasn't found
  as a distinct endpoint — today it looks like arbitrary commands go
  through the generic `execVpsSsh`. If a dedicated "Upgrade packages"
  button with progress/output streaming is required (vs. "type `apt
upgrade -y` into the terminal yourself"), that's new UI + a thin wrapper
  endpoint, not new SSH plumbing.

---

## 10. System infrastructure nodes (platform-internal, admin/dev only)

### Clarification of the original request

The original prompt's line about "manage the VPS nodes that run the
platform itself, which clients don't own" is a **separate concept** from
§9's customer VPS product. Based on the code, this maps to:
`apps/api/src/routes/nodes.ts` and `apps/api/src/routes/nodeEngine.ts`,
plus `services/node-agent` / `packages/node-agent` (an agent that runs on
each compute node and is called via `apps/api/src/lib/nodeAgentClient.ts`,
seen in use in `dockerDeployments.ts`).

### Gaps / needs work

- I have not verified the depth of `nodes.ts`/`nodeEngine.ts` (package
  upgrades, firewall, node health) to the same level as `vps.ts` — before
  building anything here, read those two files directly; do not assume
  they mirror the customer VPS feature set just because the naming is
  similar.

---

## 11. Dev-role "unlimited, no approval needed"

### Already built

- `apps/api/src/middleware/rbac.ts` gives `role === 'dev'` broad bypasses
  throughout (lines 98, 130, 222, 232, 249, 257, 279, 304, 317) — it
  already behaves as the intended "platform owner, no limits" role.
- SMTP quotas already special-case staff/dev to effectively unlimited
  storage (§6).

### Gaps / needs work

- Confirm resource-creation limits added for new product types (databases,
  domains-per-server cap from §4, etc.) explicitly check `role === 'dev'`
  to bypass, following the existing pattern — don't let a new limit
  silently apply to the dev role too.

---

## 12. Summary checklist for implementation

| Area                                                      | Status                                                |
| --------------------------------------------------------- | ----------------------------------------------------- |
| GitHub App connect + repo picker                          | ✅ Built                                              |
| Paste public repo URL to deploy                           | ✅ Built                                              |
| ZIP/archive upload deploy                                 | ✅ Built (confirm non-.zip formats)                   |
| Docker image / compose deploy                             | ✅ Built                                              |
| App Catalog w/ auto DB provisioning                       | ✅ Built                                              |
| Bot hosting language picker (Python/Node)                 | ⚠️ Needs a dedicated guided flow                      |
| Custom domain via CNAME                                   | ✅ Built                                              |
| Auto SSL via Traefik                                      | ✅ Built                                              |
| Subdomain format `client.app.root.com`                    | ❌ Gap — currently `client.root.com`                  |
| Max 2–3 platform subdomains/server, unlimited custom      | ❌ Gap — no cap enforced today                        |
| Managed Postgres/MySQL/Redis/Mongo + URIs                 | ✅ Built                                              |
| DB IP allow-list                                          | ❌ Gap — not found                                    |
| Business SMTP: domains, aliases, quotas, per-admin access | ✅ Built                                              |
| SMTP routing rules beyond aliases                         | ⚠️ Verify against Postal/Wildduck                     |
| SMTP DNS-records UI                                       | ⚠️ Verify in dashboard                                |
| Order → payment approval → auto-provision                 | ✅ Built (`fulfillOrder`)                             |
| New product types wired into fulfillment dispatch         | ⚠️ Needs extending per product                        |
| Self-hosted Supabase (platform-level)                     | ✅ Built                                              |
| Per-customer isolated Supabase projects                   | ⚠️ Needs confirmation                                 |
| Customer-owned VPS: SSH/SFTP/firewall UI                  | ✅ Built                                              |
| One-click OS package upgrade                              | ⚠️ Verify / likely needs wrapper                      |
| System/infra node management (admin-only)                 | ⚠️ Unverified — read `nodes.ts`/`nodeEngine.ts` first |
| Dev role = unlimited, no approval                         | ✅ Built as a pattern — extend to new limits          |

**Legend:** ✅ confirmed implemented and reviewed · ⚠️ partially confirmed,
needs direct verification before scoping work · ❌ confirmed gap, real work
required.
