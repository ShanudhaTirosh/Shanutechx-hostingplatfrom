# 📁 ShanuTechX — Project Structure & Monorepo Map

> Complete directory map and workspace organization guide for the ShanuTechX monorepo.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Tracking Ledger: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## Root Directory Structure

```text
shanutechx/
├── README.md                    # Main project overview & badge catalog
├── AGENTS.md                    # Operational quick-start & monorepo workspace summary
├── CLAUDE.md                    # AI context, system capabilities & design guardrails
├── BUG_AUDIT.md                 # Complete vulnerability audit & defect tracking report
├── SETUP_AND_CONFIGURATION_GUIDE.md # Comprehensive setup manual & master port directory
├── LICENSE                      # MIT License
├── package.json                 # Root monorepo npm workspace definition
├── docker-compose.local.yml     # Local development Docker Compose stack
├── docker-compose.prod.yml      # Production infrastructure Compose stack with Traefik 3.x
├── apps/                        # Platform frontend & API applications
├── services/                    # Autonomous daemons & microservices
├── packages/                    # Shared TypeScript SDKs & core modules (7 packages)
├── templates/                   # Docker Compose application catalog templates
├── infra/                       # Control-plane & node infrastructure configurations
├── tests/                       # Unit test runner suite & Playwright E2E scaffolding
└── docs/                        # Central documentation hub
```

---

## 📦 Subsystems & Workspace Breakdown

### 1. [`apps/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps) — Platform Applications

- **[`apps/api/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api)** — Core Express REST API backend (TypeScript) with Prisma 5.22 & PostgreSQL 16. Entrypoints: `src/index.ts` (Express server) and `src/worker.ts` (BullMQ repeatable queue worker).
- **[`apps/dashboard/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard)** — Next.js 14 App Router customer & admin control panel dashboard studio. Protected with `noindex` robots directive.
- **[`apps/web/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web)** — Next.js 14 App Router dark-theme public marketing storefront, documentation portal, and AI discovery hub.
- **[`apps/webmail/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/webmail)** — Next.js 14 App Router enterprise business email client with IMAP/SMTP synchronization, dark mode, and mailbox management. Protected with `noindex` robots directive.
- **[`apps/mobile-admin/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin)** — Standalone Expo / React Native Android & iOS admin mobile app.

---

### 2. [`services/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services) — Infrastructure Services & Daemons

- **[`services/node-agent/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent)** — Plain JS (`.js`) container control daemon & telemetry agent per VPS host node (`src/nodeEngine.js`, `src/filesystem.js`).
- **[`services/discord-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot)** — Discord.js bot daemon for webhook routing, ticketing, and payment review alerts.
- **[`services/whatsapp-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot)** — Baileys WhatsApp messaging gateway for customer notifications.

---

### 3. [`packages/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages) — Shared Platform SDKs & Packages (7 Packages)

- **[`db`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/db)** — Prisma 5.22 schema, database migrations ledger, and seeders.
- **[`client`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/client)** — `@shanutechx/client` Developer REST API TypeScript SDK.
- **[`catalog`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/catalog)** — One-click Docker Compose app template catalog manager.
- **[`deployments`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/deployments)** — Shared deployment type definitions and build engine helpers.
- **[`node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/node-agent)** — `@shanutechx/node-agent` RPC client interfaces.
- **[`auth`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/auth)** — Authentication middleware and token validation helpers.
- **[`types`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/types)** — Core shared platform TypeScript type definitions.
- **Supabase Integration**: Developers and applications consume the official `@supabase/supabase-js` npm package pointing to the self-hosted Supabase cluster (`https://supabase.<domain>`).

---

### 4. [`infra/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/infra) & [`templates/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates)

- **`infra/control-plane/`**: Compose configs for Traefik 3.x, PostgreSQL 16, Redis 7, MinIO, WildDuck Mail Server, Supabase.
- **`templates/`**: Docker Compose YAML app templates (WordPress + MariaDB, Grafana, N8N, Hermes AI Agent, Redis, MinIO, PostgreSQL, etc.).

---

### 5. 🌐 SEO, AI Discovery & RFC Standards Directory

- **`apps/web/app/sitemap.ts`**: Dynamic `sitemap.xml` mapping 20 public platform canonical URLs with priority and change frequencies.
- **`apps/web/app/robots.ts`**: Granular crawler directives safely permitting AI web crawlers on business pages while shielding internal panels.
- **`apps/web/public/llms.txt`**: Standard summary feed for LLM agents and AI search indexing.
- **`apps/web/public/llms-full.txt`**: Full technical, architectural, and API specification document for machine ingestion.
- **`apps/web/public/humans.txt`**: Standard team credits, open source acknowledgments, and architecture stack breakdown.
- **`apps/web/public/.well-known/security.txt`**: RFC 9116 vulnerability disclosure policy with safe harbor rules.
- **`apps/web/public/.well-known/mta-sts.txt`**: RFC 8461 SMTP MTA-STS policy for secure email transport encryption.
