# 📘 ShanuTechX Platform — Comprehensive Setup & Configuration Guide

> A complete, step-by-step production setup and operations manual for configuring Environment Variables, PostgreSQL Database & Prisma 5.22, Free Cloud Database Backups (Cloudflare R2), Automatic Node Failover, Cloudflare API DNS, Traefik Let's Encrypt SSL, Hostinger Mail SMTP, Supabase Studio, Master Service Port Directory, and 1-Command Docker Compose Deployments.

Operational quick-start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect tracking report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 📋 Master Service Port Directory

| Service Name | Port | Description / URL | Routing Mode |
| :--- | :--- | :--- | :--- |
| **Marketing & Docs ([`apps/web`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web))** | `3000` | `https://shanutechx.com` | Proxied TLS (`letsencrypt`) |
| **Control Panel ([`apps/dashboard`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard))** | `3001` | `https://dashboard.shanutechx.com` | Proxied TLS (`letsencrypt`) |
| **Self-Hosted Supabase Studio** | `3003` | `http://localhost:3003` | Admin Internal |
| **Core REST API ([`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api))** | `4000` | `https://api.shanutechx.com` | Proxied TLS (`letsencrypt`) |
| **Node Agent ([`services/node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent))** | `5000` | `http://<node_ip>:5000/agent/health` | Node Host Internal |
| **PostgreSQL 16 Database** | `5432` | `localhost:5432` | TCP Host Binding |
| **Redis 7 Cache** | `6379` | `localhost:6379` | TCP Host Binding |
| **MinIO S3 API Storage** | `9000` | `http://minio:9000` | S3 API |
| **MinIO S3 Web Console** | `9001` | `http://localhost:9001` | Web UI |
| **Traefik Reverse Proxy HTTP** | `80` | Redirects to port 443 | Entrypoint `web` |
| **Traefik Reverse Proxy HTTPS** | `443` | TLS 1.3 Let's Encrypt | Entrypoint `websecure` |
| **Traefik Web Dashboard** | `8080` | `http://localhost:8080` | Admin Internal |
| **WhatsApp Bot Service** | `4100` | Internal API ([`services/whatsapp-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot)) | Internal |
| **Discord Bot Service** | `4200` | Internal API ([`services/discord-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot)) | Internal |

---

## 📋 Table of Contents

- [1. System Architecture & Prerequisites](#1-system-architecture--prerequisites)
- [2. Step-by-Step Environment Variables Setup (.env.example)](#2-step-by-step-environment-variables-setup-envexample)
- [3. 1-Command Production & Local Docker Compose Deployment](#3-1-command-production--local-docker-compose-deployment)
- [4. Dynamic Traefik Label Auto-Generation](#4-dynamic-traefik-label-auto-generation)
- [5. PostgreSQL Database Setup & Prisma 5.22 Migrations](#5-postgresql-database-setup--prisma-522-migrations)
- [6. Free Cloud Database Backup & 1-Click Restore Setup](#6-free-cloud-database-backup--1-click-restore-setup)
- [7. Automatic Node Failover & Cluster Migration](#7-automatic-node-failover--cluster-migration)
- [8. Cloudflare API DNS & Traefik Let's Encrypt SSL Setup](#8-cloudflare-api-dns--traefik-lets-encrypt-ssl-setup)
- [9. Self-Hosted Supabase Studio Configuration](#9-self-hosted-supabase-studio-configuration)
- [10. Hostinger Mail & Multi-Provider SMTP Setup](#10-hostinger-mail--multi-provider-smtp-setup)
- [11. Developer REST API Key Scoping & OAuth SSO](#11-developer-rest-api-key-scoping--oauth-sso)

---

## 1. System Architecture & Prerequisites

### Monorepo Apps & Services
- **Control Panel Dashboard ([`apps/dashboard`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard))**: Next.js 14 frontend running on port `3001` (`https://dashboard.shanutechx.com`).
- **Marketing & Documentation Site ([`apps/web`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web))**: Next.js 14 marketing site running on port `3000` (`https://shanutechx.com`).
- **Core REST API ([`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api))**: Express + Prisma v5.22 + PostgreSQL backend running on port `4000` (`https://api.shanutechx.com`).
- **Node Agent ([`services/node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent))**: Container builder & manager running on port `5000` on each VPS node.

---

## 2. Step-by-Step Environment Variables Setup (.env.example)

Copy `.env.example` at the monorepo root to `.env`:

```bash
cp .env.example .env
```

Configure key production values in `.env`:
- `ROOT_DOMAIN`: `shanutechx.com`
- `DATABASE_URL`: `"postgresql://shanutechx:SecurePass@postgres:5432/shanutechx?schema=public"`
- `JWT_SECRET` and `SECRETS_ENCRYPTION_KEY`: 32-byte / 64-byte random hex secrets.
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: Cloudflare R2 parameters.
- `CLOUDFLARE_API_TOKEN`: Cloudflare Zone DNS API token.

---

## 3. 1-Command Production & Local Docker Compose Deployment

### 3.1 Local Development Stack ([`docker-compose.local.yml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docker-compose.local.yml))
Brings up PostgreSQL, Redis, MinIO S3, API, Dashboard, Web marketing site, and Node Agent:

```bash
docker compose -f docker-compose.local.yml up -d
```

### 3.2 Production Infrastructure Stack ([`docker-compose.prod.yml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docker-compose.prod.yml))
Brings up Traefik 3.x with automatic Let's Encrypt TLS certificates, PostgreSQL 16, Redis 7, MinIO/R2 Storage, Core API, Dashboard Studio, Marketing Web app, and Node Agent:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 4. Dynamic Traefik Label Auto-Generation

The Node Agent ([`services/node-agent/src/nodeEngine.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/nodeEngine.js)) automatically attaches Traefik dynamic router labels when containerizing deployments or catalog apps:

```javascript
labels['traefik.enable'] = 'true';
labels['traefik.docker.network'] = 'shanutechx-prod';
labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${subdomain}.${rootDomain}\`)`;
labels[`traefik.http.services.${routerName}.loadbalancer.server.port`] = String(internalPort);
labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure';
labels[`traefik.http.routers.${routerName}.tls.certresolver`] = 'le';
```

---

## 5. PostgreSQL Database Setup & Prisma 5.22 Migrations

```bash
# Generate Prisma Client (v5.22.0):
npm run db:generate

# Deploy Schema Migrations:
npm run db:migrate:deploy

# Seed Initial Products & Catalog Templates:
npm run seed --workspace=packages/db
```

---

## 6. Free Cloud Database Backup & 1-Click Restore Setup

### 6.1 Cloudflare R2 Storage Setup
1. Log into Cloudflare Dashboard -> R2 Object Storage -> Create bucket `shanutechx-backups`.
2. Generate R2 API Token with Object Read & Write permissions.
3. Configure `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in `.env`.

### 6.2 1-Click Database Restore Execution
```typescript
import { restoreBackup } from './lib/r2Storage';

// Restores gzipped PostgreSQL backup archive directly into psql
const result = await restoreBackup('backups/db-even.sql.gz');
console.log('Database restored successfully');
```

---

## 7. Automatic Node Failover & Cluster Migration

When a VPS node crashes or goes offline:
1. Uptime monitor detects node heartbeat timeout (`lastSeenAt` > 3 minutes).
2. The platform marks `node.isActive = false`.
3. Candidate healthy nodes in the cluster are selected via `selectNodeForDeployment()`.
4. Container deployments are re-assigned to the healthy node and rebuilt automatically.

---

## 8. Cloudflare API DNS & Traefik Let's Encrypt SSL Setup

### 8.1 Automated Cloudflare CNAME API Setup
1. Create a Cloudflare API Token at `https://dash.cloudflare.com/profile/api-tokens` with permission: `Zone - DNS - Edit`.
2. Provide `apiToken` and `zoneId` when adding custom domains.
3. Automatically creates non-proxied CNAME records pointing to `ingress.shanutechx.com`.

### 8.2 Traefik Dynamic Reverse Proxy & Let's Encrypt SSL
- Traefik 3.x listens on ports `80` and `443`.
- Automatically issues and renews **Let's Encrypt SSL certificates** for platform subdomains (`*.shanutechx.com`) and custom domains via HTTP-01 challenges.

---

## 9. Self-Hosted Supabase Studio Configuration

- **Studio Interface**: Accessible at `http://localhost:3003` when running the control plane stack.
- **Database Connection**: Direct connection to PostgreSQL database container (`postgres:5432`).
- **Features**: Visual table editor, SQL query editor, schema migrations viewer, and Auth inspector.

---

## 10. Hostinger Mail & Multi-Provider SMTP Setup

1. In Dashboard -> Email Studio, click **"+ Provision Mailbox"**.
2. Credentials will be generated (`smtp.shanutechx.com`, Port 587 TLS).
3. Add DNS TXT records for SPF and DKIM:
   - **SPF**: `v=spf1 include:smtp.shanutechx.com ~all`
   - **DKIM**: Add selector TXT key provided in mailbox details.
4. Launch built-in **Webmail Studio** (`/webmail`) to manage mailboxes with Column (3-pane) and Row (2-pane) layout options.

---

## 11. Developer REST API Key Scoping & OAuth SSO

- Platform security enforces Single Sign-On (SSO) via Google, GitHub, and Discord OAuth identities (`Authorization: Bearer <idToken>`).
- Generate Developer API Keys in Dashboard -> Settings -> API Keys (`shx_<48 hex chars>`).
- Authenticate via `x-api-key: shx_live_a1b2c3d4...` or `Authorization: Bearer shx_live_a1b2c3d4...`.
- Customer API Keys can **ONLY** manage resources owned by that customer (`userId === req.user.id`). Unauthorized access returns a secure `404 Not Found`.

---

## 📄 Support & Licensing

MIT © [ShanuTechX Cloud Engine](https://shanutechx.com)
