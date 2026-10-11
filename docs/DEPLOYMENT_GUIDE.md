# Deploying ShanuTechX — Production Orchestration & Deployment Guide

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## Three Deployment Modes

| Command | Environment Purpose | Key Components |
|---|---|---|
| `docker compose -f docker/docker-compose.shanutechx.yml up -d` (repo root) | **Unified Local Dev**: Control plane + self-hosted Supabase + Infisical secrets manager. No TLS, HTTP on localhost. | Control Plane, Supabase Stack, Infisical |
| `docker compose -f docker-compose.local.yml up -d` (repo root) | **Standalone Dev Stack**: Control plane + MinIO + Node Agent. | API, Dashboard, Web, Node Agent, MinIO |
| `docker compose -f infra/control-plane/docker-compose.yml up -d` (`infra/control-plane/`) | **Production Deployment**: Real production stack with Traefik 3.x, Let's Encrypt TLS, and network isolation. | Traefik SSL, Core API, Worker, Dashboard, Web, Webmail, Bots |

---

## Production Deployment Workflow ([`infra/control-plane/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/infra/control-plane))

### Step 1. Clone & Setup Environment
```bash
git clone https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom.git /opt/shanutechx
cd /opt/shanutechx

# Copy environment file templates
cp infra/control-plane/.env.example infra/control-plane/.env
cp apps/api/.env.example apps/api/.env
```

### Step 2. Configure Environment Variables
Configure production values in `.env`:
- `ROOT_DOMAIN`: e.g. `shanutechx.com`
- `DATABASE_URL`: `postgresql://shanutechx:SecurePass@postgres:5432/shanutechx?schema=public`
- `NODE_AGENT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `JWT_SECRET`: Random 32/64-byte hex values.
- `CLOUDFLARE_API_TOKEN`: Cloudflare Zone DNS API key.

### Step 3. Generate WildDuck Mail & Supabase Keys
```bash
cd apps/api && npm install && cd ../..
node infra/supabase/generate-keys.js
# WildDuck Mail Server API keys are generated via WildDuck REST API / mail-api.${ROOT_DOMAIN}
```

### Step 4. Launch Stack & Apply Database Migrations
```bash
cd infra/control-plane
docker compose up -d --build

# Apply Prisma 5.22 Schema Migrations:
docker compose exec api npx prisma migrate deploy --schema ../../packages/db/prisma/schema.prisma
```

---

## Node VPS Onboarding ([`infra/node-stack/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/infra/node-stack))

To add a worker VPS host node:
1. Sync node stack configuration to worker VPS:
   ```bash
   rsync -avz infra/node-stack/ user@worker-vps:/opt/shanutechx-node/
   ```
2. Configure `/opt/shanutechx-node/.env` (`ROOT_DOMAIN`, `NODE_AGENT_SECRET`, `API_URL`).
3. Start node stack:
   ```bash
   cd /opt/shanutechx-node && docker compose up -d
   ```
4. Register worker node IP in Admin Control Panel (`/admin/nodes`).

---

## Production Security & Hardening Checklist

1. **Rotate All Secrets**: Ensure default passwords (`NODE_AGENT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `DATABASE_URL`) are replaced with random hex strings.
2. **Cloudflare R2 Backups**: Configure R2 credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) in `apps/api/.env`.
3. **SSO OAuth Standard**: Ensure OAuth SSO client IDs and secrets for Google, GitHub, and Discord are set.
4. **Audit Logging**: Confirm actor roles (`actorRole`) are captured in [`AuditLog`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/db/prisma/schema.prisma) records.
5. **SEO & Bot Governance Verification**: Confirm `sitemap.xml` and `robots.txt` return correct HTTP 200 headers on `apps/web`, while `apps/dashboard`, `apps/webmail`, and `apps/api` strictly disallow crawling to protect internal systems (see [`SEO_AND_AI_DISCOVERY.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/SEO_AND_AI_DISCOVERY.md)).
