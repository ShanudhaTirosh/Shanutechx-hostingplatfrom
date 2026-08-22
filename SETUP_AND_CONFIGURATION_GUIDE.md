# 📘 ShanuTechX Platform — Comprehensive Setup & Configuration Guide

> A complete, step-by-step production setup and operations manual for configuring Environment Variables, PostgreSQL Database & Prisma 5.22, Free Cloud Database Backups, Automatic Node Failover, Cloudflare API DNS, Traefik Let's Encrypt SSL, Hostinger Mail SMTP, Supabase Studio, and 1-Command Docker Compose Deployments.

---

## 📋 Table of Contents

- [1. System Architecture & Prerequisites](#1-system-architecture--prerequisites)
- [2. Step-by-Step Environment Variables Setup (.env.example)](#2-step-by-step-environment-variables-setup-envexample)
- [3. 1-Command Production & Local Docker Compose Deployment](#3-1-command-production--local-docker-compose-deployment)
- [4. PostgreSQL Database Setup & Prisma 5.22 Migrations](#4-postgresql-database-setup--prisma-522-migrations)
- [5. Free Cloud Database Backup & 1-Click Restore Setup](#5-free-cloud-database-backup--1-click-restore-setup)
- [6. Automatic Node Failover & Cluster Migration](#6-automatic-node-failover--cluster-migration)
- [7. Cloudflare API DNS & Traefik Let's Encrypt SSL Setup](#7-cloudflare-api-dns--traefik-lets-encrypt-ssl-setup)
- [8. Self-Hosted Supabase Studio Configuration](#8-self-hosted-supabase-studio-configuration)
- [9. Hostinger Mail & Multi-Provider SMTP Setup](#9-hostinger-mail--multi-provider-smtp-setup)
- [10. Developer REST API Key Scoping & Automation](#10-developer-rest-api-key-scoping--automation)

---

## 1. System Architecture & Prerequisites

### Monorepo Apps & Services
- **Control Panel Dashboard (`apps/dashboard`)**: Next.js 14 frontend running on port `3001` (`https://dashboard.shanutechx.com`).
- **Marketing & Documentation Site (`apps/web`)**: Next.js 14 static/dynamic site running on port `3000` (`https://shanutechx.com`).
- **Core REST API (`apps/api`)**: Express + Prisma v5.22 + PostgreSQL backend running on port `4000` (`https://api.shanutechx.com`).
- **Supabase Studio (`supabase/studio`)**: Database Studio running on port `3003` (`http://localhost:3003`).
- **Node Agent (`services/node-agent`)**: Container builder & manager running on port `5000` on each node VPS.

---

## 2. Step-by-Step Environment Variables Setup (.env.example)

Copy `.env.example` at the monorepo root to `.env`:

```bash
cp .env.example .env
```

Configure key production values in `.env`:
- `ROOT_DOMAIN`: `shanutechx.com`
- `DATABASE_URL`: `"postgresql://shanutechx:SecurePass@postgres:5432/shanutechx?schema=public"`
- `JWT_SECRET` and `ENCRYPTION_KEY`: 32-byte / 64-byte random secrets.
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: Cloudflare R2 10 GB Free Storage parameters.
- `FREE_BACKUP_WEBHOOK_URL`: Free Google Apps Script / Supabase sync URL.
- `CLOUDFLARE_API_TOKEN`: Cloudflare Zone DNS API token.

---

## 3. 1-Command Production & Local Docker Compose Deployment

### 3.1 Local Development Stack (`docker-compose.local.yml`)
Brings up PostgreSQL, Redis, MinIO S3, API, Dashboard, Web marketing site, and Node Agent:

```bash
docker compose -f docker-compose.local.yml up -d
```

### 3.2 Production Infrastructure Stack (`docker-compose.prod.yml`)
Brings up Traefik 3.x with automatic Let's Encrypt TLS certificates, PostgreSQL 16, Redis 7, MinIO/R2 Storage, Supabase Studio, Core API, Dashboard Studio, Marketing Web app, and Node Agent:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 4. PostgreSQL Database Setup & Prisma 5.22 Migrations

```bash
# Generate Prisma Client (v5.22.0):
npm run db:generate

# Deploy Schema Migrations:
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# Seed Initial Products & Catalog Templates:
npm run seed --workspace=packages/db
```

---

## 5. Free Cloud Database Backup & 1-Click Restore Setup

### 5.1 Cloudflare R2 10 GB Free Storage Setup
1. Log into Cloudflare Dashboard -> R2 Object Storage -> Create bucket `shanutechx-backups`.
2. Generate R2 API Token with Object Read & Write permissions.
3. Configure `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in `.env`.

### 5.2 1-Click Database Restore Execution
```typescript
import { restoreBackup } from './lib/backup';

// Restores gzipped PostgreSQL backup archive directly into psql
const result = await restoreBackup('backups/db-even.sql.gz');
console.log('Database restored in:', result.durationMs, 'ms');
```

---

## 6. Automatic Node Failover & Cluster Migration

When a VPS node crashes or goes offline:
1. `uptimeMonitor` detects node heartbeat timeout (`lastSeenAt` > 3 minutes).
2. The platform marks `node.isActive = false`.
3. `failoverDeadNode(failedNodeId)` queries candidate healthy nodes in the cluster via `selectNodeForDeployment()`.
4. Re-assigns container deployments to the new healthy node and triggers automatic container rebuilds cleanly.

---

## 7. Cloudflare API DNS & Traefik Let's Encrypt SSL Setup

### 7.1 Automated Cloudflare CNAME API Setup
1. Create a Cloudflare API Token at `https://dash.cloudflare.com/profile/api-tokens` with permission: `Zone - DNS - Edit`.
2. Provide `apiToken` and `zoneId` when adding custom domains to execute `createCnameViaCloudflare()`.
3. Creates non-proxied CNAME records pointing to `ingress.shanutechx.com`.

### 7.2 Traefik Dynamic Reverse Proxy & Let's Encrypt SSL
- Traefik 3.x listens on ports `80` and `443`.
- `verifyCnameTarget()` verifies DNS propagation.
- Automatically issues and renews **Let's Encrypt SSL certificates** for subdomains (`*.shanutechx.com`) and custom domains cleanly via HTTP-01 challenges.

---

## 8. Self-Hosted Supabase Studio Configuration

- **Studio Interface**: Accessible at `http://localhost:3003` when running `docker-compose.prod.yml`.
- **Database Connection**: Direct connection to PostgreSQL database container (`postgres:5432`).
- **Features**: Visual table editor, SQL query editor, schema migrations viewer, and Auth user inspector.

---

## 9. Hostinger Mail & Multi-Provider SMTP Setup

1. In Dashboard -> Email Studio, click **"+ Provision Mailbox"**.
2. Credentials will be generated (`smtp.shanutechx.com`, Port 587 TLS).
3. Add DNS TXT records for SPF and DKIM:
   - **SPF**: `v=spf1 include:smtp.shanutechx.com ~all`
   - **DKIM**: Add selector TXT key provided in mailbox details.
4. Launch built-in **Webmail Studio** (`/webmail`) to manage mailboxes with Column (3-pane) and Row (2-pane) layout options.

---

## 10. Developer REST API Key Scoping & Automation

- Generate API Keys in Dashboard -> Settings -> API Keys (`shx_<48 hex chars>`).
- Authenticate via `x-api-key: shx_live_a1b2c3d4...` or `Authorization: Bearer shx_live_a1b2c3d4...`.
- Customer API Keys can **ONLY** manage resources owned by that customer (`userId === req.user.id`). Unauthorized access returns a secure `404 Not Found`.

---

## 📄 Support & Licensing

MIT © [ShanuTechX Cloud Engine](https://shanutechx.com)
