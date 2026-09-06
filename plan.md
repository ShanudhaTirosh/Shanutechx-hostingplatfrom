# ShanuTechX Platform — Codebase Reality-Check & Full Implementation Plan

Prepared entirely from reading the actual source files in the uploaded repo (`Shanutechx-hostingplatfrom-main`) — route handlers, node-agent scripts, Prisma schema, infra configs. The `docs/` folder in the repo was deliberately **not** used as a source of truth anywhere in this plan; every claim below is backed by a specific file and, where useful, a line reference, so it can be checked against the code directly.

---

## 1. What's actually in the repo today (verified, not assumed)

This is **not** an empty shell. It's a real Turborepo monorepo with:

- **`apps/api`** — Express + TypeScript + Prisma control-plane API. 79 Prisma models. 50+ route files covering deployments, VPS, billing, invoices, domains, secrets, webmail, Supabase panel, catalog, teams, tickets, git connect, backups, etc.
- **`apps/dashboard`** — Next.js 14 customer + admin portal (protected routes for billing, VPS, databases, email, webmail, catalog, orders, admin/customers, admin/nodes, admin/vps, admin/webhooks, etc.)
- **`apps/web`** — Next.js 14 marketing/storefront site (pricing, catalog, vps, databases, bot-hosting, app-hosting, status, reviews).
- **`apps/mobile-admin`** — Expo/React Native admin app.
- **`services/node-agent`** — the actual VPS-side worker (Dockerode-based): `docker.js`, `build.js`, `repo.js`, `filesystem.js`, `stats.js`, `projects.js`, `managedDb.js`, `customDomain.js`, `nodeEngine.js`, `livekit.js`.
- **`services/discord-bot`, `services/whatsapp-bot`** — notification bots.
- **`infra/`** — Traefik control-plane compose, WildDuck mail config, Postal mail config, Supabase Kong config, LiveKit config, Prometheus/Grafana/Loki observability stack.
- **`packages/db`** — Prisma schema/migrations (9 recent migrations moved things off in-memory stores onto real tables: webmail, SMTP config, secrets vault, knowledgebase, git integrations, Supabase panel).
- **`templates/`** — app-catalog YAML templates (WordPress, n8n, Redis, MongoDB, Grafana, Uptime Kuma, LiveKit, Lavalink, Supabase-lite, Hermes agent).

**Verdict:** this was built by a prior AI/dev pass that got real infrastructure-shaped code in place, and several subsystems are considerably more finished than a first skim suggests. It's a _scaffold with specific, real gaps_ — not a finished product, and not an empty one either.

---

## 2. Verified capability audit — confirmed directly in the code

This replaces any impression given by the repo's own `docs/` folder. Everything below was checked against the actual route handlers, node-agent scripts, and lib files — not against what any report claims.

### Genuinely more complete than a first look suggests

- **Git integration (`apps/api/src/routes/gitConnect.ts`, 258 lines) is real, not just plumbing.** It implements a full GitHub App installation callback (stores `installationId`, mints short-lived installation JWTs, never stores a user PAT) and a full GitLab OAuth2 code-exchange flow with encrypted access/refresh tokens (`packages`/`lib/secretsVault`). Both are wired behind one shared `GitProviderAdapter` interface.
- **The web IDE / filesystem API (`apps/api/src/routes/filesystem.ts`) already has list, read, write, mkdir, delete, rename, upload-binary, extract, and a `git-commit-push` endpoint** that writes to the node workspace, resolves the user's connected GitHub/GitLab account, and pushes the change via the real GitHub Contents API / GitLab Repository Files API — falling back to a platform "shadow backup" repo if no account is connected (`lib/shadowBackup.ts`).
- **Container builds actually use Railpack**, not just a reference to it: `services/node-agent/src/build.js` shells out to the real `railpack build` CLI against a BuildKit host, auto-detecting Node/Python. This is functioning build tooling, not a stub.
- **A working "exposure mode" concept already exists** in `services/node-agent/src/docker.js`: every container is created with `exposureMode` of `ssl_with_proxy` (Traefik + Let's Encrypt, default), `ssl_direct` (TLS but no Cloudflare proxy), or `no_ssl` (raw host port mapping, TCP+UDP) — this is exactly the "with SSL / without SSL but valid cert / raw port no SSL" behavior you described, and it's already implemented at the node-agent level.
- **Order fulfillment is genuinely automated for most products.** `apps/api/src/lib/orderFulfillment.ts` runs on payment approval and auto-provisions: an SMTP/WildDuck mailbox, a LiveKit project, a managed database, and a hosting instance — with no manual step. It explicitly documents that VPS is the one category it does **not** auto-provision (see below).
- **The mail-stack question is already answered in the code, just not cleaned up.** `apps/api/src/lib/postal.ts` is marked `@deprecated` and its function body literally throws: _"Postal has been replaced by WildDuck Mail Server. Use wildduckClient instead."_ WildDuck is the real, active mailbox engine — `email.ts` creates real WildDuck users/addresses on provisioning, `webmail.ts` sends via `wildduckClient.submitMessage` (or raw SMTP as a fallback for non-WildDuck accounts) and reads real messages via `wildduckClient.listMessages`. The leftover `infra/postal/postal.yml` config and `.env.example` Postal variables are dead weight to remove, not a live second stack to choose between.
- **The dashboard webmail UI is a real, large surface, not a placeholder.** `apps/dashboard/app/(protected)/email/page.tsx` is 1,193 lines. The backend (`webmail.ts`, 973 lines) implements messages, threads, folders, labels, filters, signatures, templates, auto-reply, blocked senders, calendar sync/ICS parsing, delegations, and AI summarize/reply-suggestion/draft/threat-check/translate endpoints. Alias management is also real: `smtp.ts` has working `POST`/`DELETE` routes for `/smtp-accounts/:id/aliases`.
- **Catalog deploys really run `docker-compose up` on the target node**, with automatic strong-secret generation for any required key the customer didn't supply, and an abuse-content scan before deployment (`catalog.ts` → `/agent/compose/up`).

### Real, confirmed gaps

- **Templates: `templates/` contains exactly 10 YAML files** (grafana, hermes-agent, lavalink, livekit, mongodb, n8n, redis, supabase-lite, uptime-kuma, wordpress). A usable catalog needs meaningfully more than this.
- **General-purpose container deployment is an explicit stub.** `apps/api/src/routes/dockerDeployments.ts` has two routes — `POST /deployments/docker-image` and `POST /deployments/docker-compose` — that both immediately return `501 Not Implemented` with a message telling the user to connect a Git repo instead. Deploying an arbitrary Docker image or an arbitrary compose file (the actual "container manager" behavior you asked for) does not exist yet; only pre-authored `templates/*.yaml` catalog deploys work.
- **Uploaded ZIP sources are extracted to local disk, not object storage, and the flow has a real architectural gap.** `apps/api/src/routes/zipDeployments.ts` extracts the uploaded ZIP into `AGENT_WORKSPACES_DIR` on whichever host runs the API process, then calls the node-agent's `build-and-run` endpoint — but that endpoint only accepts a `repoUrl` and clones/pulls it (`services/node-agent/src/repo.js`); it has no mechanism to receive the already-extracted files over the network from a different host. This works today only if the API and the target node happen to share a filesystem — it will break for a genuinely distributed multi-node setup and needs to route uploaded ZIPs through real object storage (R2/S3) that any node can pull from.
- **There is no working Leaseweb integration anywhere in the code** — `LEASEWEB_API_KEY` exists as an unused env var, `leasewebProductCode` is an optional label field on a VPS plan, and `leasewebVpsId` appears once as a `null` placeholder in the backup driver. No file in `apps/api/src` makes an HTTP call to any Leaseweb endpoint. VPS order fulfillment is explicitly manual today: `orderFulfillment.ts` sends a Discord alert for VPS line items instead of provisioning anything. **This confirms your direction is correct** — there's nothing real to migrate away from; the real work is building automated SSH-based provisioning on top of the node-registration tooling that already exists (`nodeEngine.ts` already has an "Interactive SSH ticket (for non-Leaseweb nodes using stored SSH key)" code path).
- **The single SMTP "external provider" config found (`smtp.ts` → `/smtp/global-config`) is a single, admin/dev-only, platform-wide outbound relay setting** — not a per-customer, per-domain "bring your own SMTP provider (Hostinger/Namecheap/SES)" choice. That customer-facing feature doesn't exist yet.
- **No CI evidence of an actual app deployment exists in the bundle** — `ci-logs-1/` contains logs for exactly one workflow, "Build & Publish @shanutechx SDK," which checks out code, sets up Node, installs dependencies, and publishes a package. There's no log of `apps/api`, `apps/dashboard`, or `apps/web` being built/deployed anywhere in this bundle.

None of this means "start over." It means: **the strong parts (git integration, the IDE, WildDuck-based email, catalog compose-deploys, exposure modes) can be trusted and built on directly, and effort should concentrate on the specific confirmed gaps above** — not on re-verifying things that already work. That's the plan below.

---

## 3. How your request maps onto the existing architecture

| What you asked for                               | Existing building block                                                                                                                                                             | Status (verified)                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web/Node/Python hosting                          | `deployments.ts`, `zipDeployments.ts`, node-agent `docker.js`/`build.js`/`repo.js`                                                                                                  | Git-sourced deploys work end-to-end (clone → Railpack build → run with exposure mode); ZIP-sourced deploys work only when API and node share a filesystem — needs an object-storage hop to be real for multi-node (see Phase 1)                                                                                                                                    |
| Discord/WhatsApp bot hosting                     | `discordbot_python`/`discordbot_node` deploy types, `services/discord-bot`, `services/whatsapp-bot`, `frameworkPreset` handling in `docker.js`                                      | Deploy types and bot-aware exposure-mode logic exist; needs per-customer resource caps enforced (not just recorded) and crash-loop handling                                                                                                                                                                                                                        |
| Git-based deploy (Railway/Vercel-style)          | `gitConnect.ts` (real GitHub App + GitLab OAuth), `prWebhooks.ts`, `deployWebhooks.ts`, node-agent `repo.js`/`build.js` (real Railpack builds)                                      | Core loop is real; missing pieces are preview/PR-based deployments and build-log streaming to the dashboard in real time                                                                                                                                                                                                                                           |
| Repo file storage / web IDE                      | `filesystem.ts` (list/read/write/mkdir/delete/rename/upload/extract/git-commit-push, all implemented) + `shadowBackup.ts`                                                           | The IDE and git-push loop are real and working; the gap is that file storage lives on node-local disk, not S3/R2, so there's no durable copy independent of that one VPS                                                                                                                                                                                           |
| Env var / secrets management                     | `secrets.ts` + AES-256-GCM vault migration                                                                                                                                          | Backend is solid; needs a proper per-project envs UI (Vercel-style) with redeploy-on-change                                                                                                                                                                                                                                                                        |
| App catalog (buy & host templates)               | `catalog.ts` (`/catalog/deploy` really runs `docker-compose up` via the node agent, with auto-generated secrets and abuse scanning), `templates/*.yaml`, `orders.ts`, `products.ts` | Deploy mechanism is real and solid; the actual catalog only has 10 templates today, and general (non-template) image/compose deploys are hard-coded `501 Not Implemented` in `dockerDeployments.ts`                                                                                                                                                                |
| VPS reselling (root access handover)             | `vps.ts` (805 lines), `vps-plans.ts`, `nodeEngine.ts` (SSH ticket system already exists)                                                                                            | No working Leaseweb integration exists anywhere in the code (confirmed — see Section 2); VPS fulfillment is currently a manual Discord alert. The SSH-based tooling used for "add VPS as a node" is the right foundation to build automated client-VPS handover on                                                                                                 |
| Business email selling                           | `email.ts`, `smtp.ts`, `webmail.ts` (973 lines), `webmailAuth.ts`, dashboard `email/page.tsx` (1,193 lines), WildDuck client                                                        | Far more complete than expected: real WildDuck mailbox provisioning on payment, real send/receive, real alias management, a large real webmail UI. Postal is dead/deprecated code that needs removing, not a stack decision to make. Remaining gaps: per-customer external-SMTP-provider choice, and confirming DKIM/SPF/DMARC/rDNS correctness per sending domain |
| Self-hosted Supabase per project                 | `supabase.ts`, `managedDatabases.ts`, `docker/supabase`, `infra/supabase`                                                                                                           | Provisioning + Studio-in-new-tab pattern exists; needs multi-node placement + scaling story confirmed                                                                                                                                                                                                                                                              |
| Cloudflare reverse proxy / DNS automation        | `apps/api/src/lib/cloudflare`, `apps/api/src/lib/traefik`, `apps/api/src/lib/domain`, node-agent `docker.js` exposure modes                                                         | The three exposure modes (`ssl_with_proxy`, `ssl_direct`, `no_ssl`) already exist at the node-agent level; DNS record creation on node registration is real. Needs generalizing so any customer deployment (not just node registration) can pick its exposure mode and get the matching DNS record automatically                                                   |
| Container manager (create from YAML, logs, etc.) | node-agent `docker.js`/`stats.js`, `catalog.ts` compose-deploy                                                                                                                      | Deploying a _known template_ works; deploying an _arbitrary_ image or compose file does not (explicit `501` stub) — this is the clearest concrete gap for a general Portainer/Coolify-style manager                                                                                                                                                                |
| Billing/invoicing/subscriptions                  | `billing.ts`, `invoices.ts`, `payments.ts`, `orderFulfillment.ts`, BullMQ cron jobs                                                                                                 | Real and reasonably complete — smallest gap area; fulfillment on payment approval is already automated for every product except VPS                                                                                                                                                                                                                                |
| Admin app / monitoring                           | `apps/dashboard/app/(protected)/admin/*`, `apps/mobile-admin`, Grafana/Loki/Prometheus stack in `infra/control-plane/observability`                                                 | Present; needs the metrics from node-agent's `stats.js` actually flowing into the Grafana dashboards                                                                                                                                                                                                                                                               |
| Public status page                               | `apps/web/app/status`, `status.ts`, `traefikStatus.ts`                                                                                                                              | Present; needs a real uptime-check source wired in (nothing found in the code that currently integrates Uptime Kuma or an equivalent)                                                                                                                                                                                                                              |
| Backups to R2                                    | `backup.ts`, `lib/backup.ts`, `BackupRun` model                                                                                                                                     | Real, DB-focused; needs to extend to customer volumes/workspaces, not just the platform DB — and, per the ZIP-storage gap above, to become the actual home for uploaded/edited project files                                                                                                                                                                       |
| Firebase/Firestore free-tier usage               | `firebase/database.rules.json`, `config/firebase`                                                                                                                                   | Config present; usage pattern (what actually lives there) needs to be defined and capped to stay free-tier                                                                                                                                                                                                                                                         |

---

## 4. Phased implementation plan

This is ordered so each phase produces something you could actually charge money for, rather than a big-bang rewrite.

### Phase 0 — Stabilize & clean up dead weight (1–2 weeks)

- Run the full test suite (`tests/unit`, `tests/integration`, `tests/e2e`) and the existing route `.test.ts` files; fix everything red before adding features.
- Rotate every secret in `.env.example` categories (JWT, node agent secret, encryption keys, Cloudflare token) — do not reuse anything from prior audit passes.
- Remove Postal entirely: delete `infra/postal/postal.yml`, the Postal `.env.example` variables, and the deprecated `apps/api/src/lib/postal.ts` shim. WildDuck is already the sole real mail engine in the code — there's no decision left to make here, only cleanup.
- Remove the unused `LEASEWEB_API_KEY` env var and `leasewebProductCode`/`leasewebVpsId` placeholder fields once Phase 4's SSH-based provisioning replaces them, so nothing in the schema implies an integration that never existed.

### Phase 1 — Core app hosting (Vercel/Railway-style deploy): close the real gaps

- The git-sourced deploy loop (GitHub App/GitLab OAuth connect → `build-and-run` → Railpack build → run with an exposure mode) already works end-to-end — verify it under load rather than rebuilding it.
- Fix the ZIP-upload path: route uploaded archives through R2/S3 instead of extracting to local disk on the API host, and give the node-agent's `build-and-run` a way to pull that archive from object storage before building — this is the one part of the current flow that will actually break on a real multi-node setup.
- Stream build + runtime logs to the dashboard (SSE or WebSocket) — `deployments-log-streaming.test.ts` already exists, so there's a target contract to satisfy; check whether the current implementation actually delivers to it or only to server-side logs.
- The web IDE (list/read/write/mkdir/delete/rename/upload/extract/commit-push) is functionally complete — the only real follow-up is making its backing storage durable (same R2/S3 fix as the ZIP path) instead of living only on the node's local disk.
- Per-project environment variables UI (create/edit/redeploy-on-change), backed by the existing secrets vault.

### Phase 2 — Bot hosting (Discord/WhatsApp, Node/Python)

- Treat bots as a hosting _type_, not a special case: same build/deploy pipeline as Phase 1, just without an exposed HTTP port by default (opt-in port exposure for webhook-based bots).
- Per-customer resource limits (CPU/RAM/disk quota) enforced at container creation, not just displayed.
- Crash-loop detection + auto-restart policy + customer-visible restart count/logs.

### Phase 3 — App catalog / marketplace

- Expand `templates/` beyond the current 10 — standardize the YAML schema (service definitions, required env vars, exposed ports, post-deploy instructions) so adding a template is a content task, not a code task.
- The actual deploy mechanism (`catalog.ts` → `/agent/compose/up`, with auto-generated secrets for anything the customer didn't supply, plus an abuse-content scan) is real and works — don't rebuild it.
- Close the gap between checkout and deploy: `orderFulfillment.ts` auto-creates a `pending` deployment slot for an `app_catalog` purchase (node selected, subdomain reserved, exposure mode set), but that's a placeholder record — confirm whether it actually calls through to the same `/catalog/deploy` compose-up logic with the customer's checkout-time env vars, or whether that hand-off still needs to be built. Either way, this is the one connection to verify/finish, not a new subsystem.
- Versioning: let a catalog app be upgraded later without losing customer data volumes.

### Phase 4 — VPS reselling

- There is nothing working to "migrate away from" — confirmed in Section 2, Leaseweb was never actually integrated (only an unused API key and a couple of label fields exist). Build automated provisioning directly on the SSH-based tooling the code already uses for "add VPS as a node" (`nodeEngine.ts`'s SSH ticket system), against **any** bare VPS you or a supplier hands you (Hetzner, OVH, Contabo, whoever) — provider-agnostic by construction, since it was never tied to one API to begin with.
- Make the two VPS product modes explicit in the data model and UI:
  1. **Managed VPS** — used internally to host client apps/bots (client never gets root).
  2. **Client-owned VPS** — client is handed root/SSH credentials directly, with your system only tracking provisioning + billing, not runtime.
- For (2): provisioning flow becomes — you (or a stock pool) supply a fresh VPS's IP + root credentials → the platform connects over SSH and runs the same install/bootstrap script already used for "add VPS as a node" (harden SSH, create the client's user/root password, install monitoring agent, apply firewall rules) → credentials are rotated to a fresh generated password at handover time → delivered via the automated email/invoice flow → dashboard shows a "here's your VPS" card with IP, root user, and a rotate-password action (which re-runs the same SSH-based reset, no provider API involved) — no manual steps.
- "Add VPS as a node" flow (enter SSH details → run install script → node joins the pool) already has groundwork in `nodeEngine.ts`/`nodeSelector.ts` — finish the script, add health-check-before-accepting-traffic, and auto-create the Cloudflare DNS record for the node as documented.

### Phase 5 — Business email (smaller gap than it looked — mostly polish + one real feature to add)

- Contrary to first impressions, this is already largely real: `orderFulfillment.ts` auto-provisions a WildDuck mailbox on payment, `webmail.ts`/`email.ts` handle real send (WildDuck submit, or raw SMTP fallback), real read (WildDuck message listing), and real alias create/delete. The 1,193-line dashboard email UI already covers folders, labels, filters, signatures, auto-reply, calendar sync, and delegations. Verify this end-to-end under a real domain rather than assuming it needs rebuilding.
- Finish removing Postal (Phase 0) so there's no dead-code confusion for future developers about which stack is live.
- Admin view: confirm the existing mailbox listing lets staff reset passwords, view (not silently read) quota/usage, and suspend on non-payment — this may already exist in `email.ts`/`smtp.ts` and just needs surfacing in the admin UI if it doesn't.
- The one real missing feature: per-customer, per-domain "external SMTP provider" choice (Hostinger, Namecheap, SES, etc.) as an alternative to WildDuck for outbound. Today `smtp.ts`'s `/smtp/global-config` is a single admin-only platform-wide relay setting — extend the existing `SmtpAccount`-style model so an individual customer domain can point outbound at their own provider's host/port/user/pass/API key instead.
- Keep DKIM/SPF/DMARC and reverse DNS correct per sending domain on your dedicated SMTP VPS — this matters for both platform-generated mail (invoices, credentials, alerts) and customer business mail, and nothing in the code currently verifies it automatically.

### Phase 6 — Self-hosted Supabase per project

- Confirm the current provisioning flow (`supabase.ts`, `docker/supabase`) actually creates an isolated stack per customer project (own Postgres, own Studio, own keys) — not a shared instance with row-level separation only.
- "Studio opens in new tab" pattern is a good UX call — keep it, but put Studio behind the same Cloudflare-proxied domain/subdomain pattern as everything else. The "with SSL," "without SSL but valid cert," and "raw port, no TLS" exposure modes you described are not a new concept to build — they already exist as `ssl_with_proxy`/`ssl_direct`/`no_ssl` in the node-agent (confirmed in Section 2); this phase just needs to make sure Supabase Studio deployments actually set the right one (see Phase 8 for generalizing this everywhere).
- Plan the multi-node story explicitly now: which VPS node a new Supabase project lands on (`nodeSelector.ts` already has hooks for this), and how storage (S3-compatible) is shared or per-node.

### Phase 7 — Generalized container manager

- Implement the two routes that are currently hard `501` stubs: `POST /deployments/docker-image` (deploy an arbitrary registry image) and `POST /deployments/docker-compose` (deploy an arbitrary compose file) in `dockerDeployments.ts`, using the same node-agent primitives (`docker.js`, `/agent/compose/up`) that catalog template deploys already use successfully.
- Add the management surface on top: start/stop/restart, live logs, exec-into-container terminal, resource graphs — using `stats.js` for the metrics side, which already exists.
- Once this exists, every product line (web hosting, bots, catalog apps, Supabase stacks) is "a container managed by this layer" — the template-deploy path in `catalog.ts` and the git-deploy path in `deployments.ts` can eventually both sit on top of the same general manager instead of each having their own logic.

### Phase 8 — Universal exposure & DNS automation

- The exposure-mode concept itself already exists (`ssl_with_proxy` / `ssl_direct` / `no_ssl` in `docker.js`) — this phase is about making it consistent and customer-facing everywhere, not inventing it.
- Audit every place a deployment gets created (git deploy, ZIP deploy, catalog deploy, Supabase provisioning, bot hosting) and confirm each one sets an explicit exposure mode rather than relying on a default — today only some paths (e.g. bot/lavalink hosting in `orderFulfillment.ts`) explicitly choose `no_ssl`.
- Automate the DNS side to match: Cloudflare API creates the record for `ssl_with_proxy` with the proxy flag on; for `ssl_direct`/`no_ssl`, skip the orange-cloud flag and point straight at the node's IP. Confirm this already happens for node registration (it does, per `apps/api/src/lib/cloudflare`) and extend the same call to fire for every customer deployment and client-owned VPS.

### Phase 9 — Billing, invoicing, subscriptions (smallest gap — polish, don't rebuild)

- Confirm the existing BullMQ billing sweep actually suspends/reactivates services on non-payment/renewal, not just creates invoice records.
- Automated emails (invoice issued, payment received, service suspended, VPS credentials delivered, mailbox created) — route all of these through one transactional-email path (Phase 5's SMTP layer), plus your existing Discord webhook notifications for internal ops alerts.

### Phase 10 — Admin, monitoring, and public status

- Wire node-agent `stats.js` output into the already-referenced Prometheus/Grafana/Loki stack so the admin dashboard shows real infrastructure health, not just DB-backed request/usage counts.
- Public status page: replace any static content with real uptime-check results (Uptime Kuma is already referenced in the README — actually deploy and integrate it, or build an equivalent lightweight checker if you want one less moving part).
- Admin app parity: whatever an admin can see in `apps/dashboard/app/(protected)/admin`, make sure the same critical actions (suspend a service, view VPS credentials, resolve a ticket) are reachable from `apps/mobile-admin`.

### Phase 11 — UI/UX modernization + SEO (do this last, per surface, not all at once)

- `apps/web` (marketing/storefront): every product (hosting, bots, VPS, databases, email, catalog apps) needs its own SEO-optimized landing page with real pricing, structured data (`Product`/`Offer` schema.org), and fast Core Web Vitals — Next.js 14 app router already supports this, it just needs to be used consistently across the existing page list.
- `apps/dashboard`: redesign pass focused on the areas you called out as weakest — webmail, container manager, VPS handover — once their backends are real, not before (don't polish a UI in front of fake data twice).
- Keep marketing (`apps/web`) and product (`apps/dashboard`) visually consistent via one shared design-token set (colors, type scale, spacing) rather than two divergent Tailwind configs.

---

## 5. Suggested sequencing if you can only do a few things next

If resources are limited, do these in order — each one either unblocks revenue or removes a security/trust risk:

1. **Phase 0** (stabilize, remove dead Postal/Leaseweb code) — prevents new work from being built on top of confusing leftovers.
2. **Phase 1's real gap** (object-storage-backed file/ZIP storage) — the git-deploy loop itself already works; this is the one piece that will actually break under real multi-node use.
3. **Phase 4** (VPS handover automation via SSH) — currently the most manual process in the whole platform (a Discord alert), so automating it removes the most ops burden per sale.
4. **Phase 7** (real container-image/compose deploy) — closes the most visible functionality gap (`501 Not Implemented`) with the least new architecture, since it reuses node-agent primitives that already work for catalog deploys.
5. Everything else (email polish, catalog expansion, exposure-mode consistency, admin/monitoring wiring) can follow without blocking revenue — none of it is currently broken, it's incomplete or unpolished.

---

## 6. Open decisions I need from you before implementation starts

- **VPS product model:** confirm you want _both_ "client gets full root" and "we manage it for the client" as separate purchasable products, not one flow with a toggle admins forget to set.
- **VPS supplier model:** since there's no real provider API integration today, confirm how you'll actually source bare VPS stock to hand to clients (a fixed set of suppliers you buy from manually and feed into the SSH-provisioning flow, or something else) — the platform can automate everything _after_ it has an IP and root password, but getting that IP is a business decision, not a code one.
- **Template catalog sourcing:** do you want to hand-curate more `templates/*.yaml` files yourself, or should the plan include tooling to convert existing public docker-compose stacks into your template format faster?
- **Backup destination roadmap:** confirmed Cloudflare R2 for now — should Phase 9+ backup-to-dedicated-nodes be scoped as its own later project, or built into this same roadmap?

---

_This document reflects a direct reading of the uploaded codebase's source files only — route handlers, node-agent scripts, and infra configs. The repo's own `docs/` folder was intentionally not used as a source for any claim above; every file/line reference can be checked directly against the code._
