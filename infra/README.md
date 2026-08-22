# 🛠️ ShanuTechX Infrastructure & Deployment Runbook

> Complete operational guide for deploying, managing, monitoring, and scaling ShanuTechX control-plane and worker nodes.

---

## 📋 Infrastructure Components

| Layer | Component | Port | Network | Description |
|-------|-----------|------|---------|-------------|
| **Ingress** | Traefik v2/v3 | 80, 443 | public & internal | Edge reverse proxy & Let's Encrypt SSL provider |
| **Control Plane** | `api` (Express) | 4000 | public & internal | Main platform control REST API |
| **Control Plane** | `web` (Next.js) | 3000 | public | Customer landing page |
| **Control Plane** | `dashboard` (Next.js) | 3001 | public | Main customer & admin dashboard UI |
| **Background Queue** | `worker` | - | internal | BullMQ async queue processor (billing, uptime checks, SSL renewal, payment reviews) |
| **Database** | PostgreSQL 16 | 5432 | internal | Core relational database |
| **Cache & Queue** | Redis 7 | 6379 | internal | Session cache, queue backend |
| **Node Agent** | `node-agent` | 5000 | internal & public | Node container & workspace daemon |
| **Build Engine** | BuildKit | - | socket | Container image builder for Railpack |
| **Object Storage** | MinIO | 9000/9001 | internal | Self-hosted S3-compatible storage for backups, uploads, and Supabase Storage — swappable for real Cloudflare R2 |
| **BaaS** | Supabase stack (`supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-realtime`, `supabase-storage`, `supabase-imgproxy`, `supabase-meta`, `supabase-kong`, `supabase-studio`) | 8000 (Kong, public), Studio public | internal (Kong+Studio public) | Self-hosted Postgres+GoTrue+PostgREST+Realtime+Storage+Studio, backing the Managed Backend-as-a-Service module |
| **Mail** | Postal (`postal-db`, `postal-web`, `postal-smtp`, `postal-worker`) | 25, 587, web UI public | internal (web UI + SMTP public) | Self-hosted mail server backing the Business Email / SMTP module |
| **Observability** | Prometheus | 9090 | internal | Metrics collection & time series storage |
| **Observability** | Grafana | 3000 | internal | Real-time monitoring dashboards |
| **Observability** | Loki & Promtail | 3100, 9080 | internal | Container log aggregation stack |

---

## 🚀 Initial Production Deployment

### 1. Control Plane Server Setup

Requirements: Ubuntu 22.04 LTS+, minimum 2 CPU cores, 4 GB RAM, 40 GB SSD. If you're running the full stack (control plane + Supabase + Postal, all together), size up — 4 CPU cores / 8 GB RAM is a more realistic minimum once Supabase's several services and Postal's mail processing are added in.

```bash
# Clone the repository
git clone https://github.com/shanutechx/shanutechx.git /opt/shanutechx
cd /opt/shanutechx

# Copy environment files
cp infra/control-plane/.env.example infra/control-plane/.env
cp apps/api/.env.example apps/api/.env

# Generate the Supabase JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY triple
# and paste the output into infra/control-plane/.env
cd apps/api && npm install && cd ../..
node infra/supabase/generate-keys.js

# Generate Postal's DKIM/signing key (postal-web won't start without it)
openssl genrsa -out infra/postal/signing.key 2048
```

Edit `infra/control-plane/.env` and `apps/api/.env` with your domain, database passwords, and API secrets — see the comments in `infra/control-plane/.env.example` for what each one is for, including the new MinIO/Supabase/Postal section.

### 2. Launching Everything Together

```bash
cd /opt/shanutechx/infra/control-plane
docker compose up -d --build
```

This single command brings up the control plane, MinIO, the full self-hosted Supabase stack, and the full Postal mail stack together — not just the core API/dashboard. Run database migrations once everything reports healthy:
```bash
docker compose exec api npx prisma migrate deploy --schema ../../packages/db/prisma/schema.prisma
```

Then finish Postal's one-time initialization (this can't be automated — it's Postal's own first-run flow):
```bash
docker compose exec postal-web postal initialize
docker compose exec postal-web postal make-user
```
Log into `https://postal.${ROOT_DOMAIN}`, create an Organization + Mail Server, copy its API key into `apps/api/.env` as `POSTAL_API_KEY`, then `docker compose restart api`.

**What still needs real DNS before it'll work end-to-end:** point `A` records at this server's public IP for `${ROOT_DOMAIN}`, `api.${ROOT_DOMAIN}`, `app.${ROOT_DOMAIN}`, `supabase.${ROOT_DOMAIN}`, `studio.${ROOT_DOMAIN}`, and `postal.${ROOT_DOMAIN}` — Traefik's Let's Encrypt HTTP challenge needs each of those to actually resolve here first. For mail specifically, also set up reverse DNS (PTR) + SPF/DKIM/DMARC once Postal gives you its DKIM key — this is a hard requirement for mail deliverability, not optional.

### 3. Launching Observability Stack (Optional)

```bash
docker compose -f docker-compose.yml -f observability/docker-compose.observability.yml up -d
```

---

## 💻 Worker VPS Node Onboarding

To add an additional worker VPS for hosting customer applications:

1. Copy `infra/node-stack` to the worker VPS:
   ```bash
   rsync -avz infra/node-stack/ user@worker-vps:/opt/shanutechx-node/
   ```
2. Configure `/opt/shanutechx-node/.env`:
   ```env
   ROOT_DOMAIN=shanutechx.com
   ACME_EMAIL=admin@shanutechx.com
   NODE_AGENT_SECRET=your-shared-agent-secret
   API_URL=https://api.shanutechx.com
   ```
3. Start the node stack:
   ```bash
   cd /opt/shanutechx-node && docker compose up -d
   ```
4. In the ShanuTechX Admin Dashboard (`https://app.shanutechx.com/admin/nodes`), register the new Node with its public IP address.

**No storage configuration is needed on a new node.** The `shanutechx-workspaces` volume in `infra/node-stack/docker-compose.yml` is a local build workspace only — a live git checkout + build context that's rebuilt from the deployment's repo whenever needed, not durable data. Everything that actually needs to survive a node being destroyed and replaced (backups, uploads, Supabase Storage files, secrets) already lives centrally on the control plane's MinIO/R2 and Postgres, which every node talks back to over the network — there's nothing node-local to back up or migrate.

---

## 🔐 Security & Secret Management

- All environment variables for user deployments are stored encrypted at rest with **AES-256-GCM** in PostgreSQL (`envVarsEncrypted`).
- Node Agent endpoints are protected via `x-agent-secret` header verification.
- Redis and PostgreSQL run strictly on `shanutechx-internal` and are never exposed to public host ports.

---

## 📈 Monitoring & Alerts

Access Grafana internally or via SSH tunnel:
```bash
ssh -L 3000:localhost:3000 user@control-plane-ip
```
Open `http://localhost:3000` (default user: `admin`).

View pre-built panels:
- **HTTP Requests/sec**
- **p95 Request Latency**
- **5xx Error Rate**
- **Active Deployments & Online Nodes**
- **Container Log Stream (Loki)**
