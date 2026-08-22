# 🚀 ShanuTechX — Start Here

> Your quick onboarding guide to the ShanuTechX platform.

---

## What Is This?

ShanuTechX is a self-hosted, multi-tenant cloud platform. Think Coolify + Vercel + Leaseweb panel — all in one, self-hosted on your own infrastructure.

---

## Key URLs (Local Dev)

| Service | URL |
|---------|-----|
| Dashboard (Next.js) | `http://localhost:3001` |
| API Backend | `http://localhost:4000` |
| Public Status Page | `http://localhost:3001/status` |
| Webmail | `http://localhost:3001/webmail` |

---

## 5-Minute Quick Start

### 1. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Set up environment variables

```bash
# Copy and fill in your values
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
```

### 3. Start Docker services

```bash
docker-compose -f docker/docker-compose.shanutechx.yml up -d
```

### 4. Run database migrations

```bash
cd packages/db && npx prisma migrate deploy && npx prisma db seed
```

### 5. Start the dev servers

```bash
# Windows
start-dev.cmd

# or manually
npm run dev --workspace=apps/api       # Port 4000
npm run dev --workspace=apps/dashboard # Port 3001
```

---

## Platform Roles

| Role | Access |
|------|--------|
| **customer** | Deployments, VPS, Databases, Catalog, Billing |
| **admin** | All customer features + User management, Tickets, Reports |
| **dev** | All admin features + Raw nodes, Settings vault, Backups |

---

## Core Features at a Glance

| Feature | Location |
|---------|----------|
| Deploy from Git (GitHub/GitLab) | `/deployments` → New Deployment |
| Browse & edit workspace files | `/deployments/[id]` → File Manager tab |
| Set encrypted env vars | `/deployments/[id]` → Environment Variables tab |
| Setup auto-deploy webhook | `/deployments/[id]` → Auto-Deploy Webhook tab |
| VPS management (Leaseweb) | `/vps` |
| App catalog (1-click deploys) | `/catalog` |
| Managed databases | `/databases` |
| Uptime monitors | `/monitoring` |
| Platform status (public) | `/status` |
| SMTP & Webmail | `/smtp` and `/webmail` |
| Secrets vault | `/secrets` |
| Admin: Node management | `/admin/nodes` |
| Platform settings | `/settings` (password protected) |

---

## Connecting a Git Repository

### GitHub App
1. Go to **Deployments** → **New Deployment**
2. Click **"Connect GitHub App Account"**
3. Authorize the platform GitHub App
4. Select a repository from the dropdown
5. Click **Deploy**

### GitLab App
1. Go to **Deployments** → **New Deployment**
2. Click **"Connect GitLab App Account"**
3. Authorize the platform GitLab App
4. Select a repository from the dropdown
5. Click **Deploy**

### Public Git URL
1. Paste any public git URL directly

---

## Adding a VPS Node

From **Admin → Nodes**:
1. Click **"Connect Node via SSH"**
2. Enter the VPS IP, SSH port, username, and credentials
3. The platform auto-runs the install script and registers the node

Or run manually on the server:
```bash
curl https://your-platform.com/api/nodes/install.sh | bash
```

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [`README.md`](../README.md) | Full platform overview |
| [`docs/LOCAL_SETUP_GUIDE.md`](LOCAL_SETUP_GUIDE.md) | Detailed local setup |
| [`docs/DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) | Production deployment |
| [`docs/PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) | Directory map |
| [`docs/NEW_FEATURES.md`](NEW_FEATURES.md) | Feature changelog |
| [`references/`](../references/) | Upstream reference repos |
