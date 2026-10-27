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

---

## 🐙 GitHub App Setup & Automated Deployment Guide

Connecting a GitHub App allows platform users to link their personal or organisation repositories with granular permissions (no personal access tokens stored), auto-fetch repos, and automatically redeploy customer containers whenever code is pushed.

### 1. Register a GitHub App on GitHub
1. Navigate to **GitHub -> Settings -> Developer Settings -> GitHub Apps -> New GitHub App**.
2. Set the following fields:
   - **GitHub App name**: `ShanuTechX Cloud` (or your platform branding)
   - **Homepage URL**: `https://yourdomain.com`
   - **Callback URL**: `https://api.yourdomain.com/api/git/github/callback`
   - **Setup URL (optional)**: `https://app.yourdomain.com/deployments`
   - **Webhook URL**: `https://api.yourdomain.com/api/deploy-webhooks/github-app`
   - **Webhook secret**: Generate a secure 32-character random string (`GITHUB_APP_WEBHOOK_SECRET`).

### 2. Configure Repository Permissions
Under **Repository permissions**, select:
- **Repository contents**: `Read-only` (or `Read and write` if committing from the Web IDE).
- **Metadata**: `Read-only` (required by GitHub).
- **Pull requests**: `Read-only` (enables PR preview deployments).
- **Webhooks**: `Read and write` (enables automatic registration of commit push webhooks).

### 3. Subscribe to Events
Under **Subscribe to events**, check:
- `Push`
- `Pull request`
- `Installation` and `Installation target`

### 4. Generate Private Key & Configure Platform `.env`
1. On your GitHub App settings page, click **Generate a private key** and download the `.pem` file.
2. In `apps/api/.env` (and `infra/control-plane/.env`), configure:
   ```env
   GITHUB_APP_ID=123456
   GITHUB_APP_SLUG=shanutechx-cloud
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQ...\n-----END RSA PRIVATE KEY-----"
   GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret
   ```
3. Once set, the dashboard's "Connect GitHub" button turns active. Selecting a repository and enabling Auto-Deploy will register the webhook, triggering automated zero-downtime rebuilds on every `git push`.

---

## 🛡️ Shadow Backup Engine (Verification & Setup)

The Shadow Backup engine creates an automated, private git mirror (`deploy-<deploymentId>`) on GitHub for every deployment instance created via ZIP upload or Web IDE edits.

### How it works:
1. When a user uploads a ZIP or saves files in the Web IDE, [`shadowBackup.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/shadowBackup.ts) queries GitHub's API.
2. If `deploy-<deploymentId>` does not exist, it creates a private repository in your backup organization or account.
3. The API instructs the node agent via `POST /agent/deployments/:id/git-backup-push`.
4. The node agent commits all files and pushes to the shadow remote over authenticated HTTPS (`x-access-token`) without leaking credentials into `.git/config`.

### Setup Requirements:
In `apps/api/.env`:
```env
BACKUP_GITHUB_TOKEN=ghp_yourPersonalAccessTokenOrFineGrainedToken
BACKUP_GITHUB_ORG=shanutechx-deploy-backups # (Optional: organization name or your GitHub username)
BACKUP_MAX_SIZE_MB=1500
```
- **Permission**: Ensure the token has `repo` (Full control of private repositories) or fine-grained repository administration rights.
- **Verification**: When `BACKUP_GITHUB_TOKEN` is supplied, every ZIP deployment and Web IDE change will automatically commit and push to your private GitHub backup repo.
