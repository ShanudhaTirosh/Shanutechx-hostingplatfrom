# ShanuTechX Platform — Complete Production Deployment Guide

## Overview
ShanuTechX is an autonomous, self-hostable cloud hosting engine and PaaS/IaaS management control plane. This guide details how to deploy the complete ShanuTechX platform on a production Linux server (Ubuntu 22.04/24.04 LTS or Debian 12) with Traefik 3.x reverse proxy, automated Let's Encrypt TLS certificate generation, PostgreSQL 16 database, Redis 7 caching and queue broker, MinIO S3-compatible object storage, BullMQ background job workers, Supabase Studio, and the Node Agent daemon.

---

## 1. System Requirements & Architecture

### Minimum Hardware
- **CPU**: 2 vCPUs minimum (4+ vCPUs recommended for multi-tenant container workloads)
- **RAM**: 4 GB minimum (8 GB+ recommended)
- **Storage**: 40 GB NVMe / SSD
- **OS**: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS or Debian 12 (Bookworm)

### Network Ports & Firewall Rules
Ensure the following ports are open on your host firewall:
- `80/tcp`: HTTP (Traefik ACME challenge & HTTP->HTTPS redirect)
- `443/tcp`: HTTPS (Traefik TLS termination)
- `8080/tcp`: Traefik Dashboard (restricted/internal access)
- `22/tcp`: SSH administration

### DNS Prerequisites
Configure your DNS provider (e.g., Cloudflare with Proxy set to DNS-Only) with the following records pointing to your public server IP:
- `A` record: `@` -> `<SERVER_IP>`
- `A` record: `api` -> `<SERVER_IP>`
- `A` record: `dashboard` -> `<SERVER_IP>`
- `A` record: `webmail` -> `<SERVER_IP>`
- `A` record: `status` -> `<SERVER_IP>`
- `A` record: `*` -> `<SERVER_IP>` (wildcard for dynamic app deployments and tenant subdomains)

---

## 2. Server Installation & Dependencies

SSH into your target production server as a user with `sudo` privileges:

```bash
# 1. Update OS packages and install core build tools
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git openssl build-essential ca-certificates gnupg ufw

# 2. Install Docker Engine and Docker Compose Plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. Install Node.js 22 LTS (Active Enterprise Runtime)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Verify installed versions
docker --version
docker compose version
node -v # Must be v22.x.x
npm -v
```

---

## 3. Clone Repository & Setup Monorepo

```bash
# Clone the repository to /opt/shanutechx
git clone https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom.git /opt/shanutechx
cd /opt/shanutechx

# Install monorepo dependencies
npm install --legacy-peer-deps

# Build SDK packages (@shanutechx/types, @shanutechx/client, @shanutechx/catalog, etc.)
npm run build:sdk

# Generate Prisma ORM client
npm run db:generate
```

---

## 4. Environment Configuration

### Generate Production Secrets
Generate cryptographically strong secrets for the control plane:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
NODE_AGENT_SECRET=$(openssl rand -hex 24)
SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)
BILLING_CRON_SECRET=$(openssl rand -hex 24)
SMS_WEBHOOK_SECRET=$(openssl rand -hex 24)
STATUS_SESSION_SECRET=$(openssl rand -hex 32)
```

### Populate Control Plane Environment (`.env`)
Create `/opt/shanutechx/.env` (and `infra/control-plane/.env`):

```env
NODE_ENV=production
ROOT_DOMAIN=shanutechx.com
ACME_EMAIL=admin@shanutechx.com

# Core Databases
POSTGRES_USER=shanutechx
POSTGRES_PASSWORD=<GENERATED_POSTGRES_PASSWORD>
POSTGRES_DB=shanutechx
DATABASE_URL=postgresql://shanutechx:<GENERATED_POSTGRES_PASSWORD>@postgres:5432/shanutechx?schema=public
REDIS_PASSWORD=<GENERATED_REDIS_PASSWORD>
REDIS_URL=redis://:<GENERATED_REDIS_PASSWORD>@redis:6379

# Object Storage (MinIO / Cloudflare R2)
MINIO_ROOT_USER=shanutechx_minio
MINIO_ROOT_PASSWORD=<GENERATED_MINIO_ROOT_PASSWORD>
R2_ENDPOINT=http://minio:9000
R2_ACCESS_KEY_ID=shanutechx_minio
R2_SECRET_ACCESS_KEY=<GENERATED_MINIO_ROOT_PASSWORD>
R2_BUCKET_NAME=shanutechx-backups

# Security & Secrets Vault
NODE_AGENT_SECRET=<GENERATED_NODE_AGENT_SECRET>
SECRETS_ENCRYPTION_KEY=<GENERATED_SECRETS_ENCRYPTION_KEY>
BILLING_CRON_SECRET=<GENERATED_BILLING_CRON_SECRET>
SMS_WEBHOOK_SECRET=<GENERATED_SMS_WEBHOOK_SECRET>
STATUS_SESSION_SECRET=<GENERATED_STATUS_SESSION_SECRET>

# Public Service Endpoints
NEXT_PUBLIC_API_BASE_URL=https://api.shanutechx.com
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.shanutechx.com
NEXT_PUBLIC_STATUS_URL=https://status.shanutechx.com
NEXT_PUBLIC_WEBMAIL_URL=https://webmail.shanutechx.com
```

---

## 5. Deploy Production Infrastructure

### Launch Containers with Docker Compose
```bash
# Launch the full production stack using docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d --build
```

### Apply Database Migrations
Once PostgreSQL is running and healthy, deploy Prisma migrations:

```bash
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
```

---

## 6. Verification & Health Checks

Verify that all containers are healthy and reachable:

```bash
# 1. Check container statuses
docker compose -f docker-compose.prod.yml ps

# 2. Check API health endpoint
curl -fsSL https://api.shanutechx.com/api/health

# 3. Check Traefik SSL certificate status
docker compose -f docker-compose.prod.yml logs traefik | grep -i acme
```

---

## 7. Creating the First Admin Account

Sign up via the dashboard frontend (`https://dashboard.shanutechx.com`). Then promote the account to `dev` or `admin` directly in PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml exec -it postgres psql -U shanutechx -d shanutechx -c "UPDATE \"User\" SET role = 'dev' WHERE email = 'your-email@example.com';"
```
