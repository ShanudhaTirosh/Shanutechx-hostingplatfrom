# Deploying ShanuTechX — Everything Together

**Important correction from an earlier pass of this guide:** I initially built a Supabase stack from scratch and inlined it directly into `docker-compose.local.yml`. Partway through, I found this repo already has a real, separate self-hosted Supabase stack (`docker/supabase/docker-compose.yml`) that's wired into a unified orchestrator (`docker/docker-compose.shanutechx.yml`, which combines it with `docker-compose.local.yml` and a self-hosted secrets manager, Infisical, via Compose's `include:`). My inline version would have collided with it. I removed the duplicate and instead **fixed the real bugs in the pre-existing stack** (it had no persistent volumes — meaning it lost all data on every restart, no `kong.yml` — meaning its API gateway had zero routes configured, local-disk storage instead of S3, and shipped Supabase's own publicly-known demo JWT keys as its actual example values). I also found and fixed a service-naming collision between Infisical and the other two stacks that would have silently broken one or the other. Full details in `CHANGELOG_fixes_applied.md`. What follows is the corrected picture.

---

## Three ways to run this, for different purposes

| Command | What it's for |
|---|---|
| `docker compose -f docker/docker-compose.shanutechx.yml up -d` (repo root) | **Local dev/testing, everything together**: control plane + self-hosted Supabase + Infisical secrets manager. No TLS, plain HTTP, all on localhost. |
| `docker compose -f docker-compose.local.yml up -d` (repo root) | Just the ShanuTechX control plane + MinIO + Postal, without Supabase/Infisical. |
| `docker compose -f infra/control-plane/docker-compose.yml up -d` (from `infra/control-plane/`) | **Real production deployment**: same idea as the unified dev orchestrator, but with Traefik, real Let's Encrypt TLS, and public/internal network separation. This is its own independent Supabase definition (not the same file as `docker/supabase/`) because production has different needs (public routing, TLS termination) that the dev version doesn't. |

For actually hosting this for real, use **`infra/control-plane/`**. The steps below cover that.

---

## Production deployment (`infra/control-plane/`)

```bash
git clone https://github.com/shanutechx/shanutechx.git /opt/shanutechx
cd /opt/shanutechx

# 1. Copy env templates
cp infra/control-plane/.env.example infra/control-plane/.env
cp apps/api/.env.example apps/api/.env

# 2. Generate the Supabase JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY triple
cd apps/api && npm install && cd ../..
node infra/supabase/generate-keys.js
# → paste the first block it prints into infra/control-plane/.env

# 3. Generate Postal's DKIM/signing key (postal-web won't start without it)
openssl genrsa -out infra/postal/signing.key 2048

# 4. Edit infra/control-plane/.env and apps/api/.env:
#    - ROOT_DOMAIN, ACME_EMAIL to your real domain/email
#    - Every *_PASSWORD/*_SECRET value away from the change-me placeholders
#      (MINIO_ROOT_PASSWORD, SUPABASE_DB_PASSWORD, SUPABASE_REALTIME_SECRET,
#      POSTAL_DB_ROOT_PASSWORD, POSTGRES_PASSWORD)
#    - Match infra/postal/postal.yml's main_db/message_db passwords to
#      whatever you put in POSTAL_DB_ROOT_PASSWORD

# 5. Point DNS at this server BEFORE starting Traefik, or the Let's
#    Encrypt HTTP challenge will fail: A records for ${ROOT_DOMAIN},
#    api.${ROOT_DOMAIN}, app.${ROOT_DOMAIN}, supabase.${ROOT_DOMAIN},
#    studio.${ROOT_DOMAIN}, postal.${ROOT_DOMAIN} all -> this server's IP.

# 6. Bring up everything.
cd infra/control-plane
docker compose up -d --build
```

This starts the control plane (Traefik, API, worker, dashboard, web, both bots, buildkit), the full self-hosted Supabase stack, MinIO, and the full Postal mail stack — together, in one command.

```bash
# 7. Run migrations once everything reports healthy.
docker compose exec api npx prisma migrate deploy --schema ../../packages/db/prisma/schema.prisma

# 8. Initialize Postal (one-time — its own first-run setup, can't be skipped).
docker compose exec postal-web postal initialize
docker compose exec postal-web postal make-user
```

Log into `https://postal.<yourdomain>`, create an Organization + Mail Server, copy the generated API key into `apps/api/.env` as `POSTAL_API_KEY`, then `docker compose restart api`.

At that point: `https://<yourdomain>` (marketing site), `https://app.<yourdomain>` (dashboard), `https://api.<yourdomain>` (API), `https://studio.<yourdomain>` (Supabase Studio), `https://supabase.<yourdomain>` (Supabase's Kong gateway), and `https://postal.<yourdomain>` (Postal admin) are all live with real TLS, and every module — deployments, VPS management, the Supabase panel, webmail, billing — is backed by real running infrastructure that came up together.

---

## Trying it locally first (optional, before committing to a real server)

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp docker/supabase/.env.example docker/supabase/.env
node infra/supabase/generate-keys.js
# paste the FIRST block into .env, the SECOND block into docker/supabase/.env
# (both need the same underlying values, just under different variable names)

docker compose -f docker/docker-compose.shanutechx.yml up -d --build
```

This brings up the control plane, Supabase (at `http://localhost:8001`, Studio at `http://localhost:3003`), and Infisical (a self-hosted secrets manager, at `http://localhost:4004` — included in the repo but not currently wired into any ShanuTechX feature; it's there for you to optionally use for managing this platform's own deployment secrets, separate from the customer-facing Secrets Vault feature in the dashboard). No TLS, no real mail server here — this is for kicking the tires locally, not for real traffic.

---

## Adding a worker VPS (for hosting customer deployments)

```bash
rsync -avz infra/node-stack/ user@worker-vps:/opt/shanutechx-node/
```
Fill in `/opt/shanutechx-node/.env` (`ROOT_DOMAIN`, `ACME_EMAIL`, `NODE_AGENT_SECRET` matching the control plane, `API_URL`), then:
```bash
cd /opt/shanutechx-node && docker compose up -d
```
Register the node's public IP in the dashboard (`/admin/nodes`).

**Your question about storage when adding a node — direct answer:** you never configure storage separately per node. Durable data (backups, uploads, Supabase Storage, secrets, everything customer-facing) lives centrally on the control plane's MinIO/R2 and Postgres — every node just talks back to those over the network. A node's only local volume (`shanutechx-workspaces`) is a live git-checkout/build context, intentionally ephemeral and rebuilt from the deployment's repo whenever needed — not something that needs backing up or migrating when you add or replace a node. There's genuinely nothing storage-related to set up beyond `NODE_AGENT_SECRET` matching the control plane (and, for defense-in-depth, `AGENT_ALLOWED_IPS` pointed at the control plane's IP).

---

## Production hardening checklist

1. Change every `change-me*`/`CHANGE_ME*` value in every `.env` file — defaults baked into a shared codebase are public by definition.
2. Consider real Cloudflare R2 instead of self-hosted MinIO (zero egress fees matter for backups) — override `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` in `apps/api/.env` and remove the corresponding lines from the `api` service's `environment:` in `docker-compose.yml`.
3. Rotate `NODE_AGENT_SECRET` and every other secret from the original leaked `.env` (from the earlier audit/changelog) before this ever touches real customer data.
4. Set up the GitHub App + GitLab OAuth application, a real Leaseweb API key, and a scoped Cloudflare API token.
5. Turn on the observability stack: `docker compose -f docker-compose.yml -f observability/docker-compose.observability.yml up -d` (from `infra/control-plane/`).

---

If you want, I can turn the DNS/SPF/DKIM/DMARC records into a concrete "here's exactly what to put in your DNS provider" list once you tell me your actual domain, or walk through sizing the server for your expected customer count.
