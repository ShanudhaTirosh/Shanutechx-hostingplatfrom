# ⚡ ShanuTechX Platform — Autonomous Enterprise Cloud Hosting Engine

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.35-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.x-green.svg)](https://nodejs.org/)
[![Prisma 5.22](https://img.shields.io/badge/Prisma-v5.22.0-blue.svg)](https://www.prisma.io/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-v3.9-blue.svg)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made with Supabase](https://supabase.com/badge-made-with-supabase-dark.svg)](https://supabase.com)
[![Powered by Traefik](https://img.shields.io/badge/Powered%20by-Traefik%203.x-24A1DE.svg?logo=traefik)](https://traefik.io/)
[![Database PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Cache Redis](https://img.shields.io/badge/Cache-Redis%207-DC382D.svg?logo=redis)](https://redis.io/)
[![Storage Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020.svg?logo=cloudflare)](https://www.cloudflare.com/developer-platform/r2/)
[![Mobile Expo](https://img.shields.io/badge/Mobile-Expo%20%2F%20React%20Native-000000.svg?logo=expo)](https://expo.dev/)
[![Bot Discord](https://img.shields.io/badge/Bot-Discord.js-5865F2.svg?logo=discord)](https://discord.js.org/)
[![Bot WhatsApp](https://img.shields.io/badge/Bot-Baileys%20WhatsApp-25D366.svg?logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)
[![Monitoring Grafana](https://img.shields.io/badge/Monitoring-Grafana-F46800.svg?logo=grafana)](https://grafana.com/)
[![Status Uptime Kuma](https://img.shields.io/badge/Status-Uptime%20Kuma-5CD662.svg)](https://github.com/louislam/uptime-kuma)

> A modern, end-to-end cloud platform featuring **Automatic Container Provisioning**, **Automated Git Deploy on Push**, **Free Cloud Database Backups (Cloudflare R2 + Google Sheets/Supabase)**, **1-Click Failover**, **Scoped Developer REST API**, **Hostinger Mail-Inspired Webmail Studio**, **React Native / Expo Android & iOS Mobile Admin App**, **Unified Discord Webhooks**, and **WhatsApp Bot Integration**.

---

## 🏛️ Reference Architecture & Subsystem Integrations

This platform leverages world-class open-source engines and reference architectures:

- **BaaS & Studio**: Based on **Supabase Master** (`references/supabase-master`) for self-hosted PostgreSQL, Auth, and Database Studio.
- **Monitoring & Status Page**: Based on **Uptime Kuma** (`references/uptime-kuma-master`) and **Grafana** (`references/grafana-main`) for synthetic health checks and metric dashboards.
- **Secret Vault**: Based on **Infisical** (`references/infisical-main`) for AES-256-GCM encrypted secret key vault storage.
- **Build Engine**: Based on **Railpack / BuildKit** (`references/railpack-main`) for zero-downtime container builds.
- **VPS Infrastructure**: Based on **Leaseweb API & VPS Monitor** (`references/vps-monitor-main`) for automated VPS provisioning and hardware telemetry.

---

## ⚡ Core Platform Capabilities

### 1. 🤖 Fully Automated Provisioning Pipeline
- **Zero-Touch Fulfillment**: The ONLY manual step on the entire platform is **Manual Payment Verification** (upload proof/SMS review).
- Once payment is approved, the system automatically:
  - Provisions the purchased product (web/node/python hosting, VPS, SMTP account, managed database, LiveKit, catalog app).
  - Encrypts and delivers credentials via transactional email and WhatsApp (`/internal/send-notification`).
  - Registers automatic Git deployment webhooks (`deployWebhookSecret`) for instant push-to-deploy.

### 2. 🛡️ Scoped Developer REST API & Security
- **Strict Customer Isolation**: Customer API keys (`shx_...`) can **ONLY** access, modify, or delete resources owned by that specific customer (`resource.userId === req.user.id`).
- Unauthorized requests return secure `404 Not Found` responses to prevent resource enumeration.

### 3. 📱 Mobile Admin App (`apps/mobile-admin`)
- Built with React Native and Expo for Android and iOS devices.
- Single-tap payment approval/rejection, real-time node metric charts, support ticket chat, and deployment controls.

### 4. 📢 Unified Discord & WhatsApp Messaging
- All platform alerts (payments, orders, tickets, failovers) are routed to a **single unified Discord Webhook** URL (`DISCORD_WEBHOOK_URL`).
- Discord Bot (`services/discord-bot`) handles `/ticket` creation, `/server` monitoring, and direct invoice delivery.
- WhatsApp Bot (`services/whatsapp-bot`) handles SMS/WhatsApp payment notifications and customer commands (`!status`, `!invoice`).

---

## 📁 Repository Monorepo Structure

```text
shanutechx/
├── apps/
│   ├── api/             # Core REST API (Express + Prisma v5.22 + PostgreSQL)
│   ├── dashboard/       # Control Panel Dashboard Studio (Next.js 14)
│   ├── web/             # WrapXLK Dark Theme Marketing & Documentation Site (Next.js 14)
│   └── mobile-admin/    # Expo React Native Mobile Admin App for Android & iOS
├── packages/
│   ├── db/              # Prisma 5.22 Schema & Database Migrations
│   ├── client/          # @shanutechx/client Developer TypeScript SDK
│   ├── catalog/         # One-Click App Catalog Templates Manager
│   └── types/           # Core Shared TypeScript Type Definitions
├── services/
│   ├── node-agent/      # Node Agent VPS Container Builder & Manager
│   ├── discord-bot/     # Discord Bot for Ticket Management & Alerts
│   └── whatsapp-bot/    # WhatsApp Baileys Automated Messaging Bot
├── templates/           # Yaml App Catalog Templates (Hermes AI Agent, Grafana, N8N, WordPress, etc.)
├── docker-compose.prod.yml  # Production Compose Orchestrator with Traefik 3.x SSL
├── SETUP_AND_CONFIGURATION_GUIDE.md # Step-by-Step Operations Manual
└── .env.example         # Complete Root Environment Variables Template
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
