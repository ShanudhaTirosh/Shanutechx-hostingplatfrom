# ⚡ ShanuTechX Platform — Autonomous Enterprise Cloud Hosting Engine

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.35-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.x-green.svg)](https://nodejs.org/)
[![Prisma 5.22](https://img.shields.io/badge/Prisma-v5.22.0-blue.svg)](https://www.prisma.io/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-v3.9-blue.svg)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Powered by Traefik](https://img.shields.io/badge/Powered%20by-Traefik%203.x-24A1DE.svg?logo=traefik)](https://traefik.io/)
[![Database PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Cache Redis](https://img.shields.io/badge/Cache-Redis%207-DC382D.svg?logo=redis)](https://redis.io/)
[![Storage Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020.svg?logo=cloudflare)](https://www.cloudflare.com/developer-platform/r2/)
[![Mobile Expo](https://img.shields.io/badge/Mobile-Expo%20%2F%20React%20Native-000000.svg?logo=expo)](https://expo.dev/)
[![Bot Discord](https://img.shields.io/badge/Bot-Discord.js-5865F2.svg?logo=discord)](https://discord.js.org/)
[![Bot WhatsApp](https://img.shields.io/badge/Bot-Baileys%20WhatsApp-25D366.svg?logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)

> A modern, end-to-end cloud platform featuring **Automatic Container Provisioning**, **Automated Git Deploy on Push**, **Free Cloud Database Backups (Cloudflare R2)**, **OAuth SSO Enforcement**, **Node Port Exposure Engine**, **Unified Dev Studio & Databases Hub**, **Hostinger Mail-Inspired Webmail Studio**, **React Native / Expo Android & iOS Mobile Admin App**, **Unified Discord Webhooks**, and **WhatsApp Bot Integration**.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Platform Architecture & Technical Guide: see [`CLAUDE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/CLAUDE.md)  
Technology Stack & Reference Architecture Manual: see [`TECH_STACK_AND_ARCHITECTURE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/TECH_STACK_AND_ARCHITECTURE.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## ⚡ Core Platform Capabilities

### 1. 🤖 Fully Automated Provisioning Pipeline & Unified Dev Studio Hub
- **Unified Dev Studio & Databases Hub**: Centralized workspace ([`apps/dashboard/app/(protected)/dev/projects/page.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/(protected)/dev/projects/page.tsx)) for Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures with target VPS node selection and direct Launch Studio UI button (`http://<nodeIp>:<studioPort>`).
- **Global Compute Node Registration**: Automatic Cloudflare DNS A-record (`node-<label>.<rootDomain>`) creation upon host node registration without requiring manual usage tag setup.
- **Node Port Exposure Engine**: Instant mapping of container/node ports to auto-created Cloudflare DNS subdomains (`node-label-port-8080.shanutechx.com`).
- **Zero-Touch Fulfillment**: Manual payment review or auto-approval provisions purchased hosting/databases/LiveKit, encrypts & delivers credentials, and registers automatic Git deployment webhooks (`deployWebhookSecret`).

### 2. 🛡️ Scoped Developer REST API & Security
- **OAuth Single Sign-On (SSO) Standard**: Authentication exclusively via Google, GitHub, and Discord OAuth identities (`Authorization: Bearer <idToken>`). Direct password input forms disabled across client apps.
- **Strict Customer Isolation**: Customer API keys (`shx_...`) can **ONLY** access, modify, or delete resources owned by that specific customer (`resource.userId === req.user.id`). Unauthorized requests return secure `404 Not Found` responses.
- **Secrets Vault Encryption**: Credentials encrypted at rest with AES-256-GCM via [`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts).

### 3. 📱 Mobile Admin App ([`apps/mobile-admin`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/mobile-admin))
- Built with React Native and Expo for Android and iOS devices.
- Single-tap payment approval/rejection, real-time node metric charts, support ticket chat, and deployment controls.

### 4. 📢 Multi-Channel Bot Gateways
- All platform alerts (payments, orders, tickets, failovers) route to Discord Webhooks.
- Discord Bot ([`services/discord-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot)) handles `/ticket` creation and server monitoring.
- WhatsApp Bot ([`services/whatsapp-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot)) handles account status queries and customer notifications.

### 5. 🌐 SEO, Dynamic Sitemap, AI Bot Discovery & Security Standards
- **Dynamic Sitemap (`sitemap.xml`)**: Automated sitemap in [`apps/web/app/sitemap.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/sitemap.ts) indexing 20 public routes with priorities and update frequencies.
- **AI Crawler & Bot Governance (`robots.txt`)**: Granular policy safely enabling AI systems (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, etc.) to index public business offerings and documentation while disallowing private dashboards and APIs.
- **LLM Context Discovery**: Native [`llms.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/llms.txt) and [`llms-full.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/llms-full.txt) following the llmstxt.org standard.
- **Security & RFC Compliance**: RFC 9116 [`security.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/.well-known/security.txt) vulnerability disclosure policy, RFC 8461 [`mta-sts.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/.well-known/mta-sts.txt) SMTP TLS enforcement, and [`humans.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/humans.txt) team and architecture credits.
- **Rich Schema.org Data**: Connected Schema.org `@graph` for `Organization`, `WebSite`, and `SoftwareApplication` with product pricing offers.

---

## 📁 Repository Monorepo Structure

```text
shanutechx/
├── apps/
│   ├── api/             # Core REST API (Express + Prisma v5.22 + PostgreSQL)
│   ├── dashboard/       # Control Panel Dashboard Studio (Next.js 14)
│   ├── web/             # Dark-Theme Marketing & Documentation Site (Next.js 14)
│   ├── webmail/         # Enterprise Business Email Client (Next.js 14)
│   ├── status/          # Public Cloud Status & Uptime Telemetry Platform (Next.js 15, port 3003)
│   └── mobile-admin/    # Expo React Native Mobile Admin App for Android & iOS
├── packages/
│   ├── db/              # Prisma 5.22 Schema & Database Migrations Ledger
│   ├── client/          # @shanutechx/client Developer TypeScript SDK
│   ├── catalog/         # One-Click App Catalog Templates Manager
│   ├── deployments/     # Shared deployment type definitions and build helpers
│   ├── node-agent/      # Node agent client interfaces
│   ├── auth/            # Auth middleware SDK helpers
│   └── types/           # Core Shared TypeScript Type Definitions
├── services/
│   ├── node-agent/      # Node Agent VPS Container Control & Telemetry Daemon
│   ├── discord-bot/     # Discord Bot for Ticket Management & Alerts
│   └── whatsapp-bot/    # WhatsApp Baileys Automated Messaging Bot
├── templates/           # App Catalog Compose Templates (Grafana, N8N, WordPress, etc.)
├── docker-compose.prod.yml  # Production Compose Orchestrator with Traefik 3.x SSL
├── SETUP_AND_CONFIGURATION_GUIDE.md # Comprehensive Setup Manual
└── .env.example         # Complete Monorepo Environment Variables Template
```

---

## 🚀 Quick Start & 1-Command Deployment

### 1. Clone & Setup Environment
```bash
git clone https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom.git
cd Shanutechx-hostingplatfrom
cp .env.example .env
```

### 2. Local Development Stack
```bash
docker compose -f docker-compose.local.yml up -d
```

### 3. Production Infrastructure Stack (with Traefik SSL)
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 📄 License & Support

MIT © [ShanuTechX Cloud Engine](https://shanutechx.com) — Built for enterprise reliability and autonomous operations.
