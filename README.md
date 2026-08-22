# 🚀 ShanuTechX — Self-Hosted Cloud Platform & Infrastructure Studio

> A production-grade, multi-tenant cloud platform for deploying web applications, Python services, Discord bots, managed databases, custom domains, and VPS infrastructure — featuring automatic node failover, free cloud backups, team RBAC, and developer REST API automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-brightgreen)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-blue)](https://www.prisma.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-required-blue)](https://www.docker.com)

---

## 📋 Table of Contents

- [What is ShanuTechX?](#-what-is-shanutechx)
- [New Production Features](#-new-production-features)
- [Monorepo Architecture](#-monorepo-architecture)
- [Developer REST API & Automation](#-developer-rest-api--automation)
- [Automatic Node Failover](#-automatic-node-failover)
- [Free Cloud Backup & Restore](#-free-cloud-backup--restore)
- [Client Team Invitations & RBAC](#-client-team-invitations--rbac)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [License](#-license)

---

## 🌐 What is ShanuTechX?

ShanuTechX is a complete, self-hosted cloud platform built for agencies, hosting providers, developers, and infrastructure teams. It features:

- **Control Panel Studio (`apps/dashboard`)**: Next.js 14 dashboard for managing deployments, databases, VPS nodes, secrets, webmail, and team workspaces.
- **Marketing & Documentation Hub (`apps/web`)**: WrapXLK dark-theme marketing site with interactive dot globe visuals, live status studio (`/status`), V2Ray proxy store showcase (`/v2ray`), and documentation hub (`/docs`).
- **REST API Core (`apps/api`)**: Express + Prisma 5.22 + PostgreSQL engine with Firebase ID token and developer API Key (`shx_...`) authentication.
- **Node Agent (`services/node-agent`)**: Distributed agent container running on each VPS node to manage Docker builds, UFW firewalls, file operations, and container telemetry.

---

## ✨ New Production Features

### 🛡️ Automatic Node Failover & Container Migration
- Automatically detects node health check failures or inactivity.
- Re-routes all assigned container deployments to active candidate nodes in the cluster (`failoverDeadNode`).
- Triggers container rebuilds cleanly without manual intervention.

### 💾 Free Cloud Database Backups & 1-Click Restore
- **Cloudflare R2 Free Tier Integration (10 GB Free Storage)**: Daily even/odd gzipped PostgreSQL dumps uploaded at $0.00 cost.
- **Multi-Cloud Free Webhook Sync**: Syncs JSON data dumps to free Google Sheets / Apps Script endpoints, Supabase Free REST endpoints, or Firebase Firestore.
- **1-Click Database Restore**: Streams gzipped archives back into PostgreSQL `psql` for instant disaster recovery.

### 👥 Client Team Workspace & Granular RBAC
- Invite team members via email tokens (`POST /api/teams/:id/invites`).
- Assign primary roles: `Admin`, `Developer`, `Billing`, or `Viewer`.
- Configure fine-grained per-resource permission matrices (`manage`, `view`, `none`) for specific deployments, databases, or VPS instances.

### 🔑 Developer REST API Key Automation
- Authenticate via `x-api-key: shx_...` or `Authorization: Bearer shx_...`.
- Programmatically trigger deployments (`POST /api/deployments`), provision managed databases (`POST /api/managed-databases`), create custom domains (`POST /api/domains`), and monitor telemetry (`GET /api/status`).

### 📧 Hostinger Mail-Inspired Webmail Studio
- Built-in webmail interface (`/webmail`) featuring 3-pane Column and 2-pane Row layout switching.
- Folder navigation with unread badge counters, storage quota meters, AI thread summarization, and rich email composer.

---

## 🏗️ Monorepo Architecture

```
shanutechx/
├── README.md                    # Root project documentation
│
├── apps/
│   ├── api/                     # Express REST API (TypeScript + Prisma 5.22)
│   │   └── src/
│   │       ├── routes/          # API endpoints (deployments, databases, teams, apiKeys, status)
│   │       ├── lib/             # Core libraries (backup.ts, nodeSelector.ts, cloudflareDns.ts)
│   │       └── middleware/      # Auth & RBAC middleware (requireAuth with API Key support)
│   │
│   ├── dashboard/               # Next.js 14 Control Panel Studio
│   │   ├── app/
│   │   │   ├── (protected)/     # Authenticated studio routes (deployments, admin, webmail, team)
│   │   │   └── team/accept/     # Team invitation acceptance page
│   │   └── lib/api.ts           # Type-safe API Client SDK
│   │
│   └── web/                     # Next.js 14 Marketing Site & Documentation
│       └── app/
│           ├── docs/            # Client Documentation & API Automation Hub
│           ├── status/          # Public Health & Uptime Status Page
│           ├── v2ray/           # V2Ray & Netch Proxy Showcase
│           ├── about/ & contact/# Company & Support pages
│           └── terms/ & privacy/# Legal policy pages
│
├── packages/
│   └── db/                      # Prisma schema & migrations (Prisma v5.22.0)
│
└── services/
    └── node-agent/              # Docker container manager running on each VPS node
```

---

## 🔑 Developer REST API & Automation

All API endpoints accept developer API keys created from the dashboard:

```bash
# Example: Deploy a new application using cURL
curl -X POST https://api.shanutechx.com/api/deployments \
  -H "x-api-key: shx_live_a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/myorg/myapp",
    "runtime": "nodejs",
    "subdomain": "myapp"
  }'
```

```python
# Example: Provision a Managed PostgreSQL Database in Python
import requests

url = "https://api.shanutechx.com/api/managed-databases"
headers = {
    "x-api-key": "shx_live_a1b2c3d4e5f6...",
    "Content-Type": "application/json"
}
payload = {
    "type": "postgresql",
    "nodeId": "node_cm12345"
}

response = requests.post(url, json=payload, headers=headers)
print("Database Provisioned:", response.json())
```

---

## 🚀 Getting Started

### 1. Clone Monorepo & Install Dependencies

```bash
git clone https://github.com/shanutechx/shanutechx.git
cd shanutechx
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

```bash
# apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shanutechx"
JWT_SECRET="your-jwt-secret"
ENCRYPTION_KEY="32-byte-hex-key-for-aes256"
NODE_AGENT_SECRET="shared-secret-with-node-agents"
ROOT_DOMAIN="shanutechx.com"
R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your-r2-key"
R2_SECRET_ACCESS_KEY="your-r2-secret"
R2_BUCKET_NAME="shanutechx-backups"
```

### 3. Generate Prisma Client & Run Services

```bash
# Generate Prisma Client (v5.22.0)
npm run db:generate

# Start API Backend (Port 4000)
npm run dev --workspace=apps/api

# Start Control Panel Dashboard (Port 3001)
npm run dev --workspace=apps/dashboard

# Start Marketing & Docs Site (Port 3000)
npm run dev --workspace=apps/web
```

---

## 📋 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/deployments` | POST | Create a new application deployment |
| `GET /api/deployments` | GET | List user deployments |
| `POST /api/managed-databases` | POST | Provision PostgreSQL, MySQL, Redis, or MongoDB container |
| `POST /api/managed-databases/:id/action` | POST | Power controls (`start`, `stop`, `restart`) |
| `GET /api/teams` | GET | List client team workspaces |
| `POST /api/teams/:id/invites` | POST | Invite new member with role & resource permissions |
| `GET /api/status` | GET | Public uptime telemetry & service health |
| `POST /api/api-keys` | POST | Generate a new developer API key (`shx_...`) |

---

## 📄 License

MIT © [ShanuTechX Cloud](https://shanutechx.com) — See [LICENSE](LICENSE) for details.
