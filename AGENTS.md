# AGENTS.md — ShanuTechX Operational & Architecture Quick-Start

ShanuTechX is an autonomous enterprise cloud-hosting platform and container orchestration engine built as an npm workspace monorepo. See [CLAUDE.md](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/CLAUDE.md) for complete technical capabilities and design guardrails; see [BUG_AUDIT.md](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md) for defect tracking.

---

## 📦 Monorepo Workspaces & Subsystem Overview

- **`apps/`**
  - [`api/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api) — Express REST API (TypeScript) with Prisma 5.22 & PostgreSQL 16. Source of truth for platform business logic, auth, payments, billing, and orchestration. Entrypoints: [`src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts) (Express) and [`src/worker.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/worker.ts) (BullMQ worker).
  - [`dashboard/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard) — Next.js 14 App Router customer & admin control panel dashboard.
  - [`web/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web) — Next.js 14 App Router public storefront and marketing portal.
  - [`mobile-admin/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin) — Standalone Expo / React Native Android & iOS admin app (excluded from root npm workspaces via `!apps/mobile-admin`).
- **`services/`**
  - [`node-agent/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent) — Plain JavaScript (`.js`) Docker management & telemetry agent running per VPS host node. Core modules: [`filesystem.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/filesystem.js), [`nodeEngine.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/nodeEngine.js).
  - [`discord-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot) — Discord.js bot daemon for notification webhooks, support ticketing, and payment review alerts.
  - [`whatsapp-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot) — Baileys WhatsApp messaging gateway for customer notifications.
- **`packages/`**
  - `db`, `client`, `catalog`, `deployments`, `node-agent`, `auth`, `types`, `tracing` — shared packages & derived Supabase SDKs.

---

## 🛠️ Environment & Commands Quick-Start

- **Node Version:** Node 20 required (CI enforces `node-version: 20`).
- **Dev Servers:** `npm run dev:api` (port 4000), `npm run dev:dashboard` (3001), `npm run dev:web` (3000), `npm run dev:whatsapp`, `npm run dev:discord`, `npm run dev:node-agent`.
- **Database & Prisma:** `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`.
- **Tests & Typechecks:**
  - `npm run test:unit` → `tsx --test tests/unit/*.test.ts` (Node test runner — pure functions, **no DB required** — run by CI).
  - `npx tsc --noEmit --project apps/api/tsconfig.json` (API TypeScript check).
  - `npx tsc --noEmit` inside `apps/mobile-admin` (Expo Mobile app typecheck).

---

## ⚡ Key Platform Capabilities

1. **Unified Dev Studio & Databases Hub:** Single workspace ([`apps/dashboard/app/(protected)/dev/projects/page.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/(protected)/dev/projects/page.tsx)) to manage Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures. Features target VPS host node selection and direct Launch Studio UI (`http://<nodeIp>:<studioPort>`) opening in a new tab.
2. **Global Node Registration & Auto-DNS:** Registering a host node automatically defaults to global capabilities without mandatory usage configuration and automatically creates a Cloudflare DNS A-record (`node-<label>.<rootDomain>`) pointing to the node IP.
3. **Node Port Exposure Engine:** Expose any port on any registered compute node to a custom/auto platform subdomain with Cloudflare DNS record tracking.
4. **Autonomous Provisioning:** Instant container creation, Git webhook registration (`deployWebhookSecret`), database provisioning (PostgreSQL, MySQL, Redis, MongoDB), LiveKit keys, and Webmail/SMTP credentials upon payment approval.
5. **Interactive SSH Terminal:** Real-time WebSockets SSH terminal gateway ([`sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts)) with xterm.js support.
6. **App Catalog:** One-click deployment of 15+ Docker Compose app templates from [`templates/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates).
7. **Encrypted Vault:** Secrets encrypted with AES-256-GCM ([`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)).
8. **Backups & Storage:** Cloudflare R2 backup integration ([`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts)).
9. **Billing & Dunning:** Daily automated checks ([`billing.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/billing.ts)) for subscription renewals and container suspensions.

---

## 🔒 Operational Guardrails

- **API Environment:** [`apps/api/src/env.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/env.ts) **throws at startup** if required env vars are missing.
- **Deactivation over Deletion:** Set `isActive: false` on database entities with order history to prevent foreign key errors.
- **Markdown Links:** Always reference workspace files using standard clickable links with `file:///` URLs.
