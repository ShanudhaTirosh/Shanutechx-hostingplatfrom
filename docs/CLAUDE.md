# CLAUDE.md — SHANUTECHX Platform

> Single source of truth for any new Claude session picking up this project.
> Keep this updated as the project evolves.

---

## 1. Project Overview

| Field | Value |
|---|---|
| **Project name** | SHANUTECHX |
| **Owner** | Shanu |
| **Type** | Web/Node.js/Python/Discord-bot hosting platform for Sri Lankan customers |
| **Business model** | Resells hosting (shared + VPS), SMTP, LiveKit video, Discord-bot hosting. Payment via local methods (EzCash, ComBank, Sampath) — proof-of-payment screenshots (Gemini OCR) or SMS auto-matching |
| **Monorepo root** | `/home/claude/shanutechx/` |
| **Status** | Phases 0-10 complete. ~650 real source files (858 incl. minor node_modules noise). Not yet deployed to a real VPS — verified at code/logic/build level throughout |

---

## 2. Brand & Design

| Item | Value |
|---|---|
| **Brand name** | SHANUTECHX |
| **Design language** | Glassmorphism — `glass` utility class, `bg-brand-gradient` for CTAs |
| **Marketing site** | `shanutechx.com` |
| **Dashboard subdomain** | `app.shanutechx.com` |
| **API subdomain** | `api.shanutechx.com` |
| **LiveKit subdomain** | `livekit.shanutechx.com` |
| **Postal mail server** | `postal.shanutechx.com` |
| **Root domain env var** | `ROOT_DOMAIN=shanutechx.com` |

---

## 3. Full Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript |
| Framework | Express.js |
| ORM / DB | Prisma + PostgreSQL 16 |
| Auth | Firebase Auth (Google + email/password) |
| Realtime DB | Firebase Realtime Database (live chat only) |
| Queue | BullMQ + Redis 7 (payment verification, off the request thread) |
| Email | Postal (self-hosted) via HTTP Message API |
| Payment OCR | Google Gemini API |
| WhatsApp | Baileys (unofficial) — email is always the guaranteed fallback |
| Discord | Discord.js |
| DNS/CDN | Cloudflare API |
| Reverse proxy | Traefik v3 |
| Build tool | **Railpack** (Nixpacks successor — Nixpacks is in maintenance mode) |
| Container runtime | Dockerode |
| Logging | **pino + pino-http** (Phase 8) — zero raw `console.*` calls anywhere in `apps/api/src` or any service |
| Security headers | helmet |
| Rate limiting | express-rate-limit |
| Idempotency | ioredis (separate client from BullMQ's) |

### Frontend
| Layer | Technology |
|---|---|
| Marketing site | Next.js 14.2.35 (standalone), CMS-editable |
| Dashboard | Next.js 14.2.35 (standalone), 26 routes |
| Styling | Tailwind CSS, custom glassmorphism tokens |
| Auth client | Firebase SDK v10 |

### Services & Infra
| Item | Path |
|---|---|
| WhatsApp bot | `services/whatsapp-bot/` |
| Discord bot | `services/discord-bot/` |
| Node agent | `services/node-agent/` |
| SMS forwarder (Android/Kotlin) | `android/sms-forwarder/` — inbound only |
| Control-plane compose | `infra/control-plane/docker-compose.yml` (12 services) |
| Node-only compose | `infra/node-stack/docker-compose.yml` |
| CI | `.github/workflows/ci.yml` |
| Manual deploy | `.github/workflows/deploy.yml` |
| Billing cron | `.github/workflows/billing-cron.yml` (02:00 UTC daily) |
| DB backup | `.github/workflows/backup.yml` (03:00 UTC daily, 4-slot rotation to R2) |

---

## 4. What Was Completed (All Phases)

### Phase 0-6 — Core platform, dashboard, SMTP/LiveKit/VPS
Full commerce flow, deployment engine (Railpack + Dockerode + Traefik +
Cloudflare), recurring billing, SMTP/LiveKit/VPS reselling, secrets vault
(AES-256-GCM), all dashboard pages.

### Phase 7 — Security & Data Safety
- Granular roles: `customer` / `support` / `admin`
- Fixed bug: support replies mis-classified as customer messages
- Fixed bug: support agents had no sidebar nav into `/admin/*`
- Staff management (`/admin/staff`), audit log viewer (`/admin/audit-log`)
- Helmet security headers (verified live)
- Idempotency keys on checkout + payment upload (tested against real Redis)
- Automated DB backups: 4-slot rotation to Cloudflare R2
- Next.js `14.2.5 → 14.2.35` (resolves high-severity DoS CVEs)
- Explicit `container_name: shanutechx-postgres` (backup script dependency)

### Phase 8 — Observability (this session)
- **pino + pino-http** across the entire API, worker, and all three
  Node.js services (whatsapp-bot, discord-bot, node-agent) — zero raw
  `console.*` calls remain anywhere
- Deep health endpoint: `/api/health` (liveness) + `/api/health/deep`
  (readiness — verifies Postgres + Redis reachability, returns 503 if not)
- Health endpoints added to whatsapp-bot (`/internal/health`), discord-bot
  (`/internal/health`), node-agent (`/agent/health`)
- Docker `healthcheck:` directives added to api, worker, whatsapp-bot,
  discord-bot, node-agent in `docker-compose.yml`
- `LOG_LEVEL` env var (default `info`)

### Phase 9 — Testing (this session)
- Permanent unit test suite in `tests/unit/` (Node's built-in test runner,
  no separate framework needed) — `billingRules.test.ts` (9 assertions),
  `utils.test.ts` (13 assertions covering pagination + secrets vault) = 24
  total, verified passing against real modules
- `npm run test:unit` script; wired into `ci.yml` as a new job
- Playwright E2E scaffolding in `tests/e2e/` for signup→checkout→deploy —
  written but **not yet runnable in CI** (needs Firebase Auth emulator +
  seeded test DB, documented in `tests/e2e/README.md`)

### Phase 10 — SEO & Accessibility basics (this session)
- Full Next.js metadata API wiring (`apps/web/lib/metadata.ts`): title
  template, OpenGraph, Twitter cards, keywords, canonical URL
- `sitemap.ts`, `robots.ts` — Next.js file-based conventions, verified as
  real generated routes (`/sitemap.xml`, `/robots.txt`) in the build output
- `opengraph-image.tsx` — dynamically generated OG image via
  `next/og`'s `ImageResponse`, using real brand colors/gradient
- `public/.well-known/security.txt` (RFC 9116), `public/llms.txt`
- Per-page metadata on `/terms` and `/privacy` (noindex — not marketing
  content)

### Phase 15 — Scoped Admin / Dev-only Projects (this session)

Implements the "B2-DEV: separate personal admin-dev platform" line item
from §5's original roadmap, per the owner's clarification of how the three
roles should actually behave:

- **Projects (the in-house Supabase clone — auth, storage, DB, functions,
  realtime) are dev-only**, full stop. `apps/api/src/routes/projects.ts`
  previously allowed `admin`/`support` (via `requireStaff`) to create and
  view all projects; now the whole router is gated `requireDev` at the top,
  and `admin`/`support`/`customer` all get a 403. The customer-facing
  `/projects` dashboard page and the `/admin/projects` page both still
  exist in the frontend but now redirect anyone who isn't `dev` (added to
  `(protected)/layout.tsx`'s role-gating effect) — the backend already
  enforced this, the frontend redirect just avoids a broken page.
- **SMTP credential creation is dev-only.** `routes/smtp.ts`:
  `POST /smtp-accounts` changed from `requireAdmin` (which passed dev OR
  admin) to `requireDev`. Admin can still view/reveal accounts already
  assigned to their customers — see next point — just can't mint new ones.
- **Admin visibility is now scoped to assigned customers, not global.**
  Previously `admin` got the same unconditional bypass as `dev` in
  `verifyResourceOwnership()` and every `isStaff ? {} : { userId: ... }`
  list-query pattern across the API — documented as intentional in
  `middleware/RBAC_README.md` and covered by `rbac.test.ts`'s 25 tests, so
  this is a deliberate reversal of that earlier design, not a bug fix.
  Added:
  - `User.assignedAdminId` — **not yet in the real schema**, see
    `packages/db/prisma/phase15_migration/README.md` (schema.prisma wasn't
    in the zip this was worked from; that file has the exact Prisma model
    diff + migration command to run).
  - `verifyResourceOwnershipAsync()` and `ownedResourceWhere()` in
    `middleware/rbac.ts` — the scoped replacements for
    `verifyResourceOwnership()`. The old sync function still exists for
    compat but now only bypasses for `dev`; a plain `admin` hitting it
    falls through to strict self-ownership (safe/deny-by-default direction
    for anything not yet migrated).
  - `GET /admin/customers` filters by `assignedAdminId` for admin role.
  - `PATCH /admin/customers/:userId/assign` (dev-only) — how dev delegates
    a customer to an admin.
  - `GET /smtp-accounts` migrated to `ownedResourceWhere()`;
    `GET /smtp-accounts/:id/reveal-password` migrated to
    `verifyResourceOwnershipAsync()`.
  - **Not yet migrated** (still using the old unscoped pattern — flagged in
    the phase15_migration README rather than guessed at blind):
    `deployments.ts`, `billing.ts`, `invoices.ts`, `domains.ts`,
    `tickets.ts` (ticket visibility scoping wasn't specified — left staff-
    wide pending a decision), `managedDatabases.ts`, `orders.ts`,
    `payments.ts`.
- **Sidebar** (`apps/dashboard/components/Sidebar.tsx`): removed the
  `/projects` link from `CUSTOMER_GROUP` (customers never had backend
  access anyway — this closes the dead-link/dashboard mismatch) and the
  `/admin/projects` link from `ADMIN_GROUP`; added it to `INFRA_GROUP`
  (dev-only) as "Projects (Auth/DB/Storage)". Note: dev already saw
  `ADMIN_GROUP` + `STAFF_GROUP` + `CUSTOMER_GROUP` stacked in one sidebar
  before this session — the "single dev dashboard, not a separate admin
  dashboard" requirement was already built; this session didn't need to
  change that part.
- **Catalog pruning**: moved (not deleted — reversible) 12 personal-cloud-
  storage templates out of `templates/` into `templates_removed_phase15/`:
  `nextcloud.yaml` + 3 DB variants, `owncloud.yaml`, `seafile.yaml`,
  `syncthing.yaml`, `pingvinshare.yaml` + clamav variant, `cloudreve.yaml`,
  `chibisafe.yaml`, `pydio-cells.yml`. Kept infra/dev-storage tools
  (`minio*.yaml`, `garage.yaml`, `filebrowser.yaml`, `sftpgo.yaml`,
  `duplicati.yaml`, `seaweedfs.yaml`, `rustfs.yaml`) and the full
  `devtools`/`automation` category (n8n etc.) — those are the sellable
  core per the owner's direction. Mail hosting needed no catalog changes;
  it was already a first-class product (`smtp_hosting` category, Postal-
  backed), not a template.

### Phase 15 continued — full rollout (this session, part 2)

The real `packages/db/prisma/schema.prisma` arrived (was missing from the
first upload) and the owner explicitly deferred the tickets/billing/
payments scoping question ("do what good for this"). Resolved as follows,
and applied:

- **`User.assignedAdminId` merged into the real schema** (not a bolt-on doc
  anymore) with a proper timestamped migration:
  `packages/db/prisma/migrations/20260810120000_phase15_scoped_admin/`.
  Run `npm run db:generate && npm run db:migrate deploy` to apply.
- **Tickets**: kept staff-wide for `support` (that's its whole job), but
  `admin` now sees tickets from customers assigned to them **plus any
  customer still unassigned** — an unanswered ticket from an unassigned
  customer is a support gap, not a privacy concern, so it stays visible to
  every admin until dev assigns that customer. `dev` unrestricted. New
  helpers: `ticketVisibilityWhere()`, `canSeeTicket()` in `rbac.ts`.
- **Billing/orders/invoices**: fully assignment-scoped, no exception —
  `billing.ts` (`GET /subscriptions`), `orders.ts` (`GET /orders`),
  `invoices.ts` (`loadOwnedOrderWithItems`) all now use
  `ownedResourceWhere()` / `canAccessResource()`. Money access follows the
  strict rule, not the "unassigned stays visible" ticket exception.
- **Payments**: the manual-review queue (`GET /payments/review-queue`) got
  the same "assigned OR unassigned" treatment as tickets — a pending
  payment shouldn't sit invisible to every admin just because dev hasn't
  assigned that customer yet. New helpers: `paymentReviewVisibilityWhere()`,
  `canReviewPayment()`. `POST /payments/:id/review` uses the latter.
- **Everything else flagged last round, done**: `domains.ts` (4 call sites,
  file has CRLF line endings — handled), `managedDatabases.ts` (list +
  reveal-password scoped; **creation** now also checks the target
  customer is assigned to the requesting admin before provisioning, was
  previously unscoped for any admin), `deployments.ts` (list + the
  `loadOwnedDeployment` helper used by logs/start/stop/restart/delete).
- **Bugs found and fixed along the way, not originally flagged**: several
  list-query routes used the pre-Phase-15 `role === 'admin' ? {} : {
  userId }` pattern, which has a latent bug — `dev` isn't `'admin'`, so
  dev fell into the customer-only branch and only ever saw their own rows.
  Fixed in `livekit.ts` (`GET /livekit/projects`), `vps.ts`
  (`GET /vps-provisions` and the reveal-password route), `deployments.ts`
  (`GET /deployments`) — all now use `ownedResourceWhere()`/
  `canAccessResource()`, which handle dev correctly. Also fixed the same
  shape of bug in `leaseweb.ts` (`resolveLeasewebVpsId` had unconditional
  admin access to any customer's VPS via the Leaseweb API — scoped to
  assigned customers now; raw node-level access within that same function
  is dev-only, since a node has no customer owner) and
  `deployWebhooks.ts` (webhook secret create/delete, same pattern).
- **rbac.test.ts NOT updated** — still asserts the old "admin bypasses
  ownership" behavior for the routes covered in this round, same caveat as
  before. Needs a pass to assert the new scoped behavior; didn't want to
  guess at your exact expected test structure/fixtures blind.
- **No tsc/build verification** — no network access in this environment to
  `npm install` the real dependency tree, so every edit was reviewed by
  hand plus brace/paren-balance checks rather than a real typecheck. Run
  `tsc --noEmit` yourself before deploying.

### Still open (genuinely needs you, not guessable)

- Run the Phase 15 migration + regenerate the Prisma client — nothing in
  this round runs until that happens.
- Update `rbac.test.ts` to match the new scoped-admin behavior.
- No frontend UI yet for the dev-only assignment action
  (`PATCH /admin/customers/:userId/assign`) — the API endpoint exists,
  `admin/customers/page.tsx` doesn't yet have a control to call it.
- A real `tsc --noEmit` / test run against this — couldn't be done in this
  environment.

### Phases 11-14 (this session)

- **Multi-currency**: `Currency` enum (LKR/USD) on `Service` and `Order`.
  `Order.totalLkr` snapshots the LKR-equivalent at checkout time (never
  recomputed later, so a rate change never retroactively alters a past
  order) — this is what payment matching (Gemini OCR, SMS) actually
  compares against, since local banks/mobile-money only operate in LKR
  regardless of what currency the order was priced in. A cart is
  restricted to one currency at a time (mixing LKR/USD items is rejected
  with a clear error, not silently summed).
- **App templates** (`DeploymentTemplate` model, `/api/templates`) —
  admin-seeded, pre-fill repoUrl/branch/internalPort/envVars so a
  non-technical customer doesn't need to bring their own repo.
- **Preview deployments** — `POST /api/deployments/:id/preview`, tagged
  `isPreview`/`parentDeploymentId`, same build pipeline as a normal
  deployment. Excluded from uptime monitoring by default.
- **Public developer API** — `ApiKey` model, SHA-256 hashed (not
  AES-GCM — validated on every request, never needs to be decrypted back),
  `shx_`-prefixed for recognizability. `requireAuthOrApiKey` middleware
  accepts either a Firebase token or an API key; a key always resolves to
  role `customer` regardless of the underlying user's real role, so it can
  never be a path to staff/admin access.
- **Webhooks** — `Webhook`/`WebhookDelivery` models, HMAC-SHA256 signed
  payloads (`X-Shanutechx-Signature`). **Fixed a real bug during
  development**: the webhook secret is encrypted at rest, but the first
  draft of `fireWebhook()` used the encrypted blob directly as the HMAC
  key instead of decrypting it first — caught before it shipped.
- **Status page + uptime monitoring** — `UptimeCheck`/`StatusIncident`
  models, `/status` is a genuinely public page (plain `fetch`, not the
  authenticated `apiFetch` helper — confirmed `apiFetch` throws without a
  signed-in user, which would have broken this for logged-out visitors).
- **Admin analytics** — aggregates existing Order/Subscription/Node data
  (revenue by month, active subscriptions, node utilization) — no new
  data collection, just queries nobody had written yet.
- **Managed databases** — standalone Postgres/MySQL/Redis containers via
  the same node-agent pattern as deployments, on the node's internal
  Docker network only (no published port, no Traefik route).
- **Leaseweb VPS management** (replaces an earlier Hetzner-based
  auto-provisioning draft, removed entirely per owner decision) —
  `lib/leasewebClient.ts` wraps only *management* endpoints (power,
  console, credentials, snapshots, monitoring, data traffic, product
  pricing lookup). **There is no order-placement call anywhere** — an
  admin/dev buys a VPS manually through Leaseweb's own portal, then
  imports it via `POST /api/leaseweb/vps/:id/import` and assigns it either
  to a customer's paid order (`VpsProvision.leasewebVpsId`) or as a
  hosting `Node` (`Node.leasewebVpsId`). Every API call is logged to
  `LeasewebApiLog` with credentials redacted before writing (verified with
  a standalone test: the password field is never persisted in plaintext,
  the original response object is never mutated). Pricing reference
  endpoint suggests a customer-facing price (Leaseweb's own price,
  converted to LKR, +500 LKR margin) without changing anything
  automatically.
- **Cloudflare auto-DNS for custom domains** — `lib/cloudflareDns.ts`,
  optional: if a customer supplies a scoped Cloudflare API token for their
  own zone, the CNAME is created automatically instead of the manual
  "add this record yourself" flow. Token/zone ID are never persisted
  (used once per request, then discarded) — a real limitation this
  creates is documented: removing an auto-created record later needs the
  token supplied again, or manual cleanup at Cloudflare.
- **Node auto-provisioning was explicitly NOT built** — the owner
  clarified mid-session that admin/dev buys VPS manually and assigns via
  the API, no automated ordering/polling pipeline at all. An earlier
  Hetzner-based `autoProvisionNode()` draft was written, then fully
  removed once this was clarified, rather than left as dead code.

---

## 5. What Is Incomplete / Still Pending

### Explicitly out of scope (owner decisions)
- **Outbound SMS** — removed per owner request. Inbound-only. Email covers
  all customer notifications (`notifyCustomer()` always emails).
- **Two-factor auth (TOTP)** for admin accounts — Firebase Spark-plan
  pricing was never conclusively verified; not implemented.

### Verification gaps (code correct, not run on real hardware)
- **Android Gradle build** — no Android SDK in this environment.
- **Railpack install in node-agent Dockerfile** — hits `mise.run` and
  `railwayapp/railpack`, both blocked here. Test `docker build` on a real
  host before relying on it.
- **`prisma generate`** — blocked in this sandbox; works on a real VPS.

### Explicitly deferred this session
- **E2E tests are written but not wired into CI** — need a Firebase Auth
  emulator and a seeded test database first (see `tests/e2e/README.md`)
- **Error tracking (Sentry)** — not added this round
- **Mobile responsiveness / WCAG accessibility audit** — not done this round
  (Phase 10 covered SEO; a dedicated a11y pass is still open)
- **Light theme** — not built

### From the original roadmap, still pending
- Multi-currency (LKR/USD) — done, see "Phase 11-14" section below
- Phase 12 (app templates, preview deployments, public API+keys, webhooks) — done
- Phase 13 (status page, uptime monitoring, admin analytics) — done
- Phase 14 (managed databases, Leaseweb VPS management, Cloudflare auto-DNS) — done; node auto-provisioning explicitly dropped per owner decision (see below)
- Phase 15-20 (B2-DEV): separate personal admin-dev platform — not started

### npm vulnerabilities remaining
22 moderate + 2 high, all transitive through `firebase-admin → undici`.
Needs a `firebase-admin` 12→14 major bump, which needs a real Firebase
project to regression-test auth against before forcing.

---

## 6. Next Steps (Priority Order)

1. **Stand up a Firebase Auth emulator + seed a test DB**, then wire the
   Playwright E2E test into CI (`tests/e2e/`)
2. **Test the Android SMS forwarder** on a real device with Android Studio
3. **Test `docker build services/node-agent`** on a host with real internet
   access (Railpack/mise install step)
4. **Deploy Phase 0 to a real VPS** and run the full stack for the first time
5. **Verify Firebase TOTP MFA availability** on the Spark plan; implement
   for admin/support if free
6. **Add Sentry (or similar) error tracking** to complete Phase 8
7. **Accessibility audit** (ARIA, keyboard nav, contrast) to complete Phase 10
8. **`firebase-admin` 12→14 major bump** — clears remaining npm advisories,
   needs real-project regression testing first
9. Phases 11-14 in order, per the original roadmap

---

## 7. Key Decisions & Architecture Choices

| Decision | Choice | Reason |
|---|---|---|
| Build tool | **Railpack**, not Nixpacks | Nixpacks in maintenance mode; Railway recommends Railpack |
| Railpack mechanism | Needs a **BuildKit sidecar** | Railpack builds through BuildKit, doesn't bundle its own |
| Roles | `customer` / `support` / `admin` / `dev` | Support needs tickets+chat, not node credentials or billing. `dev` (Phase 15) is the platform owner — full access, including infra and Projects; `admin` is now scoped to customers explicitly assigned to them by dev, not global |
| RTDB chat node | `/staff` (not `/admins`) | Support agents need chat access too |
| Payment Gemini calls | **BullMQ worker**, off-thread | Protects Gemini's free-tier rate limit |
| BullMQ connection | **Plain options**, not an ioredis instance | Avoids a version-clash type error with BullMQ's bundled ioredis |
| Idempotency cache | **Separate ioredis instance** | No conflict risk; independent from BullMQ's connection |
| Notifications | **Email always** + WhatsApp/Discord if linked | Otherwise unlinked customers get zero notifications |
| Outbound SMS | **Removed** (owner decision) | Email covers it; removes real complexity |
| VPS reselling | **Handoff model**, no custom panel | Admin provisions upstream, `VpsProvision` tracks credentials |
| LiveKit key registration | **Config file rewrite + restart** | Self-hosted LiveKit reads keys from YAML at startup only |
| Custom domain verification | **CNAME lookup** | Tested against real live DNS (`www.github.com`) |
| Docker build context | **Repo root** | Needed for npm workspaces to resolve `@shanutechx/db` |
| NEXT_PUBLIC_* vars | **Docker build args**, not runtime env | Baked into the client bundle at `docker compose build` time |
| Postgres container name | **Explicit** `shanutechx-postgres` | Backup script needs a name stable across invocation directories |
| Backup rotation | **`sort -r \| tail -n +5`** on filenames | `rclone lsf --order-by` is for transfer commands, unreliable for listing |
| Structured logging | **pino + pino-http** | JSON in prod, pretty in dev; health checks excluded from logs |
| Health check tiers | **Liveness** + **Readiness** | Docker uses liveness; deploy pipelines use readiness |
| Test runner | **Node's built-in `node:test`** | No extra framework dependency for unit tests |
| E2E framework | **Playwright** | Scaffolded, not yet wired into CI (needs emulator + seed data) |

---

## 8. Files, Repos & Paths

### Monorepo structure (key paths only)
```
/home/claude/shanutechx/
├── apps/
│   ├── api/src/
│   │   ├── index.ts                  pino-http wired, deep health route
│   │   ├── worker.ts                 BullMQ worker, pino logging
│   │   ├── lib/logger.ts             pino instance (Phase 8)
│   │   ├── lib/billingRules.ts       Pure date math — tested in tests/unit/
│   │   ├── lib/pagination.ts         parsePagination() — tested in tests/unit/
│   │   ├── lib/secretsVault.ts       AES-256-GCM — tested in tests/unit/
│   │   ├── middleware/auth.ts        requireAuth/requireAdmin/requireStaff
│   │   ├── middleware/idempotent.ts  Redis-backed request dedup
│   │   └── routes/health.ts          /api/health + /api/health/deep
│   ├── web/
│   │   ├── app/layout.tsx            Full metadata wired (Phase 10)
│   │   ├── app/sitemap.ts            /sitemap.xml
│   │   ├── app/robots.ts             /robots.txt
│   │   ├── app/opengraph-image.tsx   Dynamic OG image
│   │   ├── lib/metadata.ts           Shared site metadata (Phase 10)
│   │   └── public/.well-known/security.txt, public/llms.txt
│   └── dashboard/                    26 routes — full customer + staff/admin UI
├── packages/db/prisma/schema.prisma  Single source of truth for all models
├── services/
│   ├── whatsapp-bot/src/             pino logging, /internal/health (Phase 8)
│   ├── discord-bot/src/              pino logging, /internal/health (Phase 8)
│   └── node-agent/src/               pino logging, /agent/health (Phase 8), Railpack build
├── infra/
│   ├── control-plane/docker-compose.yml  Healthchecks on api/worker/bots/node-agent (Phase 8)
│   └── node-stack/docker-compose.yml
├── android/sms-forwarder/            Kotlin, inbound SMS only
├── firebase/database.rules.json      /staff, /chats, /chatIndex rules
├── tests/
│   ├── unit/billingRules.test.ts     9 assertions (Phase 9)
│   ├── unit/utils.test.ts            13 assertions — pagination + vault (Phase 9)
│   └── e2e/                          Playwright scaffold, not yet in CI (Phase 9)
└── .github/workflows/
    ├── ci.yml                        Now includes a unit-tests job (Phase 9)
    ├── deploy.yml
    ├── billing-cron.yml
    └── backup.yml
```

### Key env vars (never commit actual values)

**`apps/api/.env`** — DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL, WHATSAPP_INTERNAL_SECRET,
DISCORD_INTERNAL_SECRET, DISCORD_BOT_URL, CLOUDFLARE_API_TOKEN,
CLOUDFLARE_ZONE_ID, ROOT_DOMAIN, NODE_AGENT_SECRET, GEMINI_API_KEY,
SMS_WEBHOOK_SECRET, SECRETS_ENCRYPTION_KEY, POSTAL_API_URL, POSTAL_API_KEY,
POSTAL_FROM_ADDRESS, REDIS_URL, BILLING_CRON_SECRET, **LOG_LEVEL** (new, Phase 8)

**`infra/control-plane/.env`** — POSTGRES_PASSWORD, ACME_EMAIL, ROOT_DOMAIN,
NODE_AGENT_SECRET, NEXT_PUBLIC_FIREBASE_*, NEXT_PUBLIC_API_BASE_URL,
BILLING_CRON_SECRET

**GitHub Actions secrets** — VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_REPO_PATH,
API_BASE_URL, BILLING_CRON_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET

### External services
Firebase project `shanutechx`, Cloudflare zone `shanutechx.com`, Postal at
`postal.shanutechx.com` (self-hosted, not in this repo's compose), Cloudflare
R2 bucket (name via `R2_BUCKET` secret).

---

## 9. Known Bugs Fixed This Session (and prior)

1. Support agent replies mis-classified as customer messages (Phase 7)
2. Support agents had no sidebar navigation into `/admin/*` (Phase 7)
3. Chat RTDB node renamed `/admins` → `/staff` (Phase 7)
4. Dockerfile `*/` comment bug — glob path inside a block comment closed it
   early (Phase 7)
5. BullMQ + ioredis version clash (Phase 7)
6. Docker Postgres container name instability across invocation dirs (Phase 7)
7. `rclone lsf --order-by` unreliability — switched to filename sort (Phase 7)
8. **Session/container reset mid-build** — lost all files except two
   in-progress ones; recovered by restoring from the last verified
   `shanutechx-phase7.zip` output rather than reconstructing from memory,
   then reapplied Phase 8-10 work against the real restored codebase
9. Next.js OG image API confusion — first attempt used a route handler
   (`route.tsx` with named `GET` export and route-only fields), which
   doesn't support `alt`/`size`/`contentType`. Fixed by using the correct
   `opengraph-image.tsx` file convention (default export component)

---

## 10. Testing Inventory

### Permanent suite (`tests/unit/`, run via `npm run test:unit`)
| File | Covers | Assertions |
|---|---|---|
| `billingRules.test.ts` | Renewal date math, grace-period sweep | 9 |
| `utils.test.ts` | Pagination edge cases, secrets vault (tamper/wrong-key) | 15 |

**24 total — all passing**, verified against real modules with Redis running.

### E2E (`tests/e2e/`, Playwright — not yet in CI)
`signup-checkout-deploy.spec.ts` — full happy path. See `tests/e2e/README.md`
for prerequisites before this can run.

### Ad-hoc verification performed but not checked into the permanent suite
Payment matcher, SMS parser, HMAC signature, Gemini JSON parsing, invoice
PDF, LiveKit JWT, custom domain DNS (against real live DNS), notification
fan-out, helmet headers (live HTTP), node-agent file writers (LiveKit YAML,
Traefik routes) — all verified during earlier phases; worth migrating into
`tests/unit/` or `tests/integration/` as a future cleanup task.

---

## 11. What NOT To Do (Lessons From This Build)

- **Don't hardcode container name assumptions** — give critical containers explicit `container_name` in compose
- **Don't use `rclone lsf --order-by`** for rotation — it's a transfer flag, not a listing flag
- **Don't put glob paths (`*/`) inside `/* */` block comments** — the `*/` substring closes the comment early
- **Don't hand BullMQ an externally-constructed ioredis instance** — pass plain connection options
- **Don't assume `NEXT_PUBLIC_*` vars are readable at runtime** — they're baked in at `docker compose build` time
- **Don't trust `tsc --noEmit` alone** — confirm the real build actually produces `dist/index.js` AND `dist/worker.js`
- **Don't add role guards only at the frontend** — the backend middleware is what actually enforces access
- **Don't use `route.tsx` with `alt`/`size`/`contentType` exports for OG images** — that's the `opengraph-image.tsx` convention; a route handler only supports `GET`/`POST`/etc. exports
- **If a session/container resets mid-build, check `/mnt/user-data/outputs/` for the last packaged zip before reconstructing anything from memory** — it's the actual verified state, not a guess
