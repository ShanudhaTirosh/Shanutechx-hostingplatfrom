# CLAUDE.md — ShanuTechX Platform Documentation

> Single source of truth for ShanuTechX system capabilities, architecture, and operational guidelines.

---

## 1. Project Overview

| Field | Value |
|---|---|
| **Project name** | ShanuTechX |
| **Owner** | Shanu |
| **Type** | Autonomous Enterprise Cloud Hosting Engine & Container Orchestrator |
| **Monorepo root** | [`c:\Users\tiros\OneDrive\Desktop\shanutechx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx) |
| **Status** | Production Ready — 100% Critical & High Audit Resolutions Verified |
| **Defect Audit Report** | [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md) |
| **Quick-Start Operational Guide** | [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md) |

---

## 2. Platform Architecture & Subsystems

- **Apps (`apps/`)**:
  - [`api/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api) (Port 4000) — Core Express REST API, Prisma 5.22, PostgreSQL 16, BullMQ worker.
  - [`dashboard/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard) (Port 3001) — Customer & Admin Control Panel Studio (Next.js 14).
  - [`web/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web) (Port 3000) — Public Storefront, SEO & AI Discovery Portal (Next.js 14).
  - [`webmail/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/webmail) (Port 3002) — Enterprise Business Email Client (Next.js 14).
  - [`mobile-admin/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin) — Standalone Expo / React Native Android & iOS App.
- **Services (`services/`)**:
  - [`node-agent/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent) (Port 5000) — Node compute container builder & telemetry daemon.
  - [`discord-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot) — Discord webhook, ticketing, and review alerts.
  - [`whatsapp-bot/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot) — Baileys automated customer notification gateway.
- **Packages (`packages/`)**:
  - `db`, `client`, `catalog`, `deployments`, `node-agent`, `auth`, `types`.

---

## 3. Technology Stack

### Backend & Infrastructure
- **Runtime & Language:** Node.js 22, TypeScript & ES6+ JavaScript
- **Database & ORM:** PostgreSQL 16 with Prisma 5.22
- **Caching & Queue:** Redis 7 & BullMQ background workers
- **Authentication:** Firebase OAuth SSO (Google, GitHub, Discord)
- **Secrets Encryption:** AES-256-GCM via [`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)
- **Object Storage & Backups:** Cloudflare R2 / MinIO S3 integration via [`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts)
- **Reverse Proxy & SSL:** Traefik 3.x with automatic Let's Encrypt TLS certificates

---

## 4. Key Platform Features

1. **OAuth Single Sign-On (SSO) Standard:** Direct password forms disabled across client UI apps.
2. **Unified Dev Studio & Databases Hub:** Single workspace for Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures.
3. **Global Node Registration & Auto-DNS:** Automatic Cloudflare DNS A-record (`node-<label>.<rootDomain>`) creation upon host node registration.
4. **Node Port Exposure Engine:** Exposes container/node ports to auto-created platform subdomains.
5. **Interactive SSH Terminal:** Real-time WebSockets PTY gateway ([`sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts)) with xterm.js support.
6. **Encrypted Vault:** Secrets encrypted with AES-256-GCM.
7. **Cloudflare R2 Backups:** Automated gzipped database snapshots to R2 bucket.
8. **SEO, AI Bot Discovery & Security Standards:** Dynamic sitemap (20 canonical routes), dual-policy robots crawler governance, LLM ingestion standards (`llms.txt`, `llms-full.txt`), RFC 9116 `security.txt`, RFC 8461 `mta-sts.txt`, and Schema.org rich snippet graph.

---

## 5. Coding & Security Guardrails

- **OAuth Tokens:** All API calls authenticate via `Authorization: Bearer <idToken>`.
- **Dev Superuser Role:** `role: 'dev'` possesses complete, unrestricted superuser permissions.
- **Soft Deactivation:** Use `isActive: false` instead of hard deleting records with order history.
- **Clickable File Links:** Markdown documentation must use standard clickable links with `file:///` URLs.
