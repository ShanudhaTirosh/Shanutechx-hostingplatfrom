# CLAUDE.md — ShanuTechX Platform Overview & Developer Guide

ShanuTechX is an autonomous, enterprise-grade cloud-hosting platform and container orchestration engine built as a Node.js monorepo. This document details the platform architecture, capabilities, development workflows, and coding guardrails.

Operational quick-start commands: see [AGENTS.md](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md).
Defect audit report & vulnerability fixes: see [BUG_AUDIT.md](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md).

---

## 🚀 What the Project Contains & System Capabilities

ShanuTechX integrates full-lifecycle cloud hosting, container builds, managed infrastructure, and customer management:

### 1. Core Hosting & Container Provisioning
- **Git Push-to-Deploy & Zip Uploads:** Automated container building via Dockerfile or framework presets (Node.js, Python, Static Web) with automatic build log streaming via Server-Sent Events (SSE).
- **One-Click App Catalog:** Deploy 15+ pre-configured stacks (WordPress + MySQL, N8N, Grafana, Hermes AI Agent, PostgreSQL, MinIO, Redis, etc.) using Docker Compose templates from [`templates/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates).
- **Managed Databases:** Instant automated creation and connection string generation for PostgreSQL 16, MySQL 8, Redis 7, and MongoDB.
- **Interactive In-Browser SSH Terminal:** Real-time PTY terminal gateway ([`sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts)) over WebSockets with xterm.js support.
- **Webmail & Shared SMTP Hosting:** Automated postal org/mailbox creation with webmail studio integration ([`smtpProvisioner.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/smtpProvisioner.ts)).
- **LiveKit WebRTC Infrastructure:** Real-time audio/video room key generation and node registration ([`livekit.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/livekit.ts)).
- **Leaseweb VPS Management:** Bare-metal server integration, automated IP allocation, operating system reinstallations, and status tracking.

### 2. Multi-Channel Operations & Notification Gateways
- **Discord Bot Daemon:** Ticket management, `/server` monitoring, payment review queue notifications, and automated billing alerts ([`services/discord-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot)).
- **WhatsApp Baileys Bot:** Customer account status queries, order updates, and automated WhatsApp notifications ([`services/whatsapp-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot)).
- **Mobile Admin App:** Standalone Expo / React Native Android & iOS application ([`apps/mobile-admin`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin)) for payment proof approvals, metric charts, and customer management.

### 3. Security, Billing & Storage Infrastructure
- **Secrets Vault:** AES-256-GCM authenticated secret encryption ([`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)) with SHA-256 key derivation.
- **Cloudflare R2 Storage Backups:** Automatic database snapshot backups and file storage integration ([`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts)).
- **Automated Billing Sweeps & Dunning:** Daily automated checks ([`billing.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/billing.ts)) for past-due subscriptions, graceful grace periods, and container suspension.
- **Abuse & Fraud Detection:** Instant account suspension and deployment teardown pipeline ([`abuseDetector.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/abuseDetector.ts)).

---

## 📁 Repository & Monorepo Structure

```text
shanutechx/
├── apps/
│   ├── api/             # Core REST API (Express + Prisma + PostgreSQL + BullMQ)
│   ├── dashboard/       # Control Panel Studio (Next.js 14 App Router)
│   ├── web/             # Public Dark-Theme Marketing & Landing Site (Next.js 14 App Router)
│   └── mobile-admin/    # Standalone Mobile Admin App (Expo / React Native)
├── packages/
│   ├── db/              # Prisma 5.22 Schema & Database Migrations
│   ├── client/          # @shanutechx/client Developer TypeScript SDK
│   ├── catalog/         # One-Click App Catalog Templates Engine
│   ├── deployments/     # Shared deployment type definitions and build helpers
│   ├── node-agent/      # Node agent client interfaces
│   ├── auth/            # Auth middleware SDK helpers
│   ├── types/           # Shared TypeScript types
│   └── tracing/         # OpenTelemetry tracing wrappers
├── services/
│   ├── node-agent/      # Plain JS (.js) VPS container control agent & telemetry daemon
│   ├── discord-bot/     # Discord notification and ticket management bot
│   └── whatsapp-bot/    # WhatsApp Baileys automated customer messaging bot
├── templates/           # Catalog app Docker Compose templates (WordPress, Grafana, N8N, etc.)
├── infra/               # Traefik, Redis, PostgreSQL infrastructure configs
└── BUG_AUDIT.md         # Comprehensive vulnerability audit and defect tracking report
```

---

## 🛠️ Common Workspace Commands

### Development Servers
- **Express API Backend:** `npm run dev:api` (port 4000)
- **Next.js Dashboard:** `npm run dev:dashboard` (port 3001)
- **Storefront Web:** `npm run dev:web` (port 3000)
- **Node Agent Engine:** `npm run dev:node-agent`
- **WhatsApp Service:** `npm run dev:whatsapp`
- **Discord Service:** `npm run dev:discord`

### Database Commands (Prisma & PostgreSQL)
- **Generate Prisma Client:** `npm run db:generate`
- **Apply DB Migrations:** `npm run db:migrate`
- **Deploy Migrations (Production):** `npm run db:migrate:deploy`

### Build & Testing
- **Run Unit Tests (CI Suite):** `npm run test:unit`
- **Build Shared SDK Packages:** `npm run build:sdk`
- **Publish SDK Packages:** `npm run publish:sdk`
- **TypeScript Check (API):** `npx tsc --noEmit --project apps/api/tsconfig.json`
- **Expo Mobile Admin Typecheck:** `npx tsc --noEmit` (run inside `apps/mobile-admin`)

---

## 🔒 Key Design Principles & Guardrails

1. **Strict Type Safety & Real Data:** Avoid hardcoded dummy data arrays. Query PostgreSQL dynamically via `prisma.*` or API endpoints.
2. **Entity Deactivation:** Set `isActive: false` (deactivate) rather than hard-deleting entities with historical order references to preserve foreign key constraints.
3. **Secrets Vault Encryption:** Encrypt sensitive credentials with AES-256-GCM via `encryptSecret` / `decryptSecret` in [`apps/api/src/lib/secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts).
4. **WebSocket & Async Safety:** Event listeners in WebSocket gateways (e.g. [`sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts)) must safely handle socket disconnection and guard against null object dereferencing.
5. **Path Traversal Jailing:** Node Agent filesystem operations must sanitize inputs with `path.basename()` and validate resolve targets against `WORKSPACE_ROOT` using `resolveSafe()`.
6. **Clickable File Links:** Reference workspace files using standard markdown links with `file:///` URLs.
