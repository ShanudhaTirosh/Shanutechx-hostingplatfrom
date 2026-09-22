# AGENTS.md — ShanuTechX Operational & Architecture Quick-Start

ShanuTechX is an autonomous enterprise cloud-hosting platform and container orchestration engine built as an npm workspace monorepo. See [`CLAUDE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/CLAUDE.md) for complete technical capabilities and design guardrails; see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md) for defect tracking.

---

## 📦 Monorepo Workspaces & Subsystem Overview

- **`apps/`**
  - [`api/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api) — Express REST API (TypeScript) with Prisma 5.22 & PostgreSQL 16. Source of truth for platform business logic, auth, payments, billing, and orchestration. Entrypoints: [`src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts) (Express API) and [`src/worker.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/worker.ts) (BullMQ worker daemon).
  - [`dashboard/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard) — Next.js 14 App Router customer & admin control panel dashboard (`http://localhost:3001`).
  - [`web/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web) — Next.js 14 App Router public storefront and marketing portal (`http://localhost:3000`).
  - [`mobile-admin/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin) — Standalone Expo / React Native Android & iOS admin app (excluded from root npm workspaces via `!apps/mobile-admin`).
- **`services/`**
  - [`node-agent/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent) — Plain JavaScript (`.js`) Docker management & telemetry agent running per VPS host node. Core modules: [`filesystem.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/filesystem.js), [`nodeEngine.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/nodeEngine.js), [`index.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/index.js).
  - [`discord-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot) — Discord.js bot daemon for notification webhooks, support ticketing (`/ticket`), and payment review alerts.
  - [`whatsapp-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot) — Baileys WhatsApp messaging gateway for customer notifications & status queries.
- **`packages/`**
  - [`db`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/db) — Prisma 5.22 schema and PostgreSQL migrations ledger (`@shanutechx/db`).
  - [`client`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/client) — `@shanutechx/client` Developer REST API TypeScript SDK.
  - [`catalog`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/catalog) — One-click Docker Compose app template catalog manager (`@shanutechx/catalog`).
  - [`deployments`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/deployments) — Shared deployment types and build engine helpers (`@shanutechx/deployments`).
  - [`node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/node-agent) — `@shanutechx/node-agent` RPC client interfaces.
  - [`auth`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/auth) — Authentication middleware and token validation helpers (`@shanutechx/auth`).
  - [`types`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/types) — Core shared platform TypeScript type definitions (`@shanutechx/types`).
  - *Note: Self-hosted Supabase stack integrations use the official `@supabase/supabase-js` npm SDK.*

---

## 🛠️ Environment & Commands Quick-Start

- **Node Version:** Node 20 required (CI enforces `node-version: 20`).
- **Dev Servers:**
  - Express API Backend: `npm run dev:api` (port 4000)
  - Next.js Dashboard Studio: `npm run dev:dashboard` (port 3001)
  - Public Web Storefront: `npm run dev:web` (port 3000)
  - BullMQ Background Worker: `npm run dev:worker`
  - Node Agent Engine: `npm run dev:node-agent`
  - WhatsApp Bot Gateway: `npm run dev:whatsapp`
  - Discord Bot Service: `npm run dev:discord`
- **Database & Prisma:** `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`.
- **SDK Building & Publishing:** `npm run build:sdk`, `npm run publish:sdk`.
- **Tests & Typechecks:**
  - `npm run test:unit` → `tsx --test tests/unit/*.test.ts` (Node test runner + fast-check property tests — pure functions, **no DB required** — run by CI).
  - `npx tsc --noEmit --project apps/api/tsconfig.json` (API TypeScript check).
  - `npx tsc --noEmit` inside `apps/mobile-admin` (Expo Mobile app typecheck).

---

## ⚡ Key Platform Capabilities

1. **Google, GitHub & Discord OAuth SSO Standard:** Platform security enforces Single Sign-On (SSO) exclusively via Google, GitHub, and Discord OAuth. Direct email/password input forms are disabled across all client apps (`apps/dashboard`, `apps/mobile-admin`, `apps/web`), and backend APIs auto-provision and sync user accounts tied to OAuth identities on every login.
2. **Unified Dev Studio & Databases Hub:** Single workspace ([`apps/dashboard/app/(protected)/dev/projects/page.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/(protected)/dev/projects/page.tsx)) to manage Self-Hosted Supabase Stacks (using official `@supabase/supabase-js`), Managed Databases (PostgreSQL 16, MySQL 8, Redis 7, MongoDB), and Node Port Exposures. Features target VPS host node selection and direct Launch Studio UI (`http://<nodeIp>:<studioPort>`) opening in a new tab.
3. **Global Node Registration & Auto-DNS:** Registering a host node automatically defaults to global capabilities without mandatory usage configuration and automatically creates a Cloudflare DNS A-record (`node-<label>.<rootDomain>`) pointing to the node IP.
4. **Node Port Exposure Engine:** Expose any port on any registered compute node to a custom/auto platform subdomain (`http://node1-port-8080.shanutechx.com`) with Cloudflare DNS record tracking via `NodePortExposure`.
5. **Autonomous Provisioning:** Instant container creation, Git webhook registration (`deployWebhookSecret`), database provisioning (PostgreSQL, MySQL, Redis, MongoDB), LiveKit keys, and Webmail/SMTP credentials upon payment approval.
6. **Interactive SSH Terminal & Container Exec:** Real-time WebSockets SSH terminal gateway ([`sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts)) with xterm.js support and container exec stream gateway ([`containerExecGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/containerExecGateway.ts)).
7. **One-Click App Catalog:** Instant deployment of 15+ Docker Compose app templates (WordPress + MySQL, N8N, Grafana, Hermes AI Agent, PostgreSQL, MinIO, Redis, etc.) from [`templates/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates).
8. **Encrypted Vault:** Secrets encrypted at rest with AES-256-GCM ([`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)) with SHA-256 key derivation.
9. **Backups & Storage Infrastructure:** Cloudflare R2 backup integration ([`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts)), GitHub repository backups ([`githubBackup.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/githubBackup.ts)), and automated container snapshot pipelines ([`deploymentBackup.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/deploymentBackup.ts)).
10. **Automated Billing Sweeps & Dunning:** Daily automated checks ([`billing.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/billing.ts)) for subscription renewals, grace periods, and container suspensions via BullMQ.
11. **Automated Node Health & Failover Engine:** Real-time uptime monitoring ([`uptimeMonitor.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/uptimeMonitor.ts)) and failover engine ([`failoverEngine.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/failoverEngine.ts)) to route traffic away from degraded VPS nodes.
12. **Hostinger-Inspired Webmail & Shared SMTP Studio:** Postal organization/mailbox auto-provisioning with webmail studio integration ([`webmail.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/webmail.ts), [`smtpProvisioner.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/smtpProvisioner.ts)).

---

## 🔒 Operational Guardrails

- **OAuth Authentication:** All platform entrypoints use Firebase Google, GitHub & Discord OAuth tokens (`Authorization: Bearer <idToken>`). Direct password logins are disabled across client applications.
- **Dev Superuser Access:** The `dev` user role (`role: 'dev'`) possesses complete, unrestricted superuser access to every part of the platform, bypassing resource ownership limits while non-dev users (`customer`, `support`, `admin`) remain strictly restricted.
- **API Environment Startup:** [`apps/api/src/env.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/env.ts) **throws at startup** if required env vars are missing.
- **Deactivation over Deletion:** Set `isActive: false` on database entities with order history to prevent foreign key errors.
- **Path Traversal Protection:** Node Agent filesystem operations must sanitize inputs with `path.basename()` and validate resolve targets against `WORKSPACE_ROOT` using `resolveSafe()`.
- **Markdown Links:** Always reference workspace files using standard clickable links with `file:///` URLs.
