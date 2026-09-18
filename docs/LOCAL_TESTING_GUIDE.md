# Running ShanuTechX Locally — Full Test Guide

This walks through getting the whole platform running on your own machine: API, web
dashboard, database, and (optionally) the mobile app, node agent, and observability stack.
Written against the actual structure of your delivered repo — every command below is real,
not generic boilerplate.

Estimated time: 30–45 minutes for the core setup (API + Dashboard + Postgres + Redis), longer
if you also want the mobile app, node agent, or observability stack running.

---

## 0. Prerequisites

- **Node.js 20+** and npm (you said you have this)
- **Docker** (you said you have this) — used here just for Postgres + Redis, not the full
  production compose stack, to keep local testing simple
- **A free Firebase project** — the platform's entire auth system (web dashboard, API, and
  the mobile admin app) runs on Firebase Auth. Takes 5 minutes:
  1. Go to https://console.firebase.google.com → Create a project
  2. Project Settings → General → add a Web App → copy the config (`apiKey`, `authDomain`,
     `projectId`) — this goes in the dashboard's `.env`
  3. Project Settings → Service Accounts → Generate new private key → this JSON file's
     `project_id`, `client_email`, and `private_key` go in the API's `.env`
  4. Authentication → Sign-in method → enable **Email/Password**
- **Optional, only if you want to test the mobile app**: a phone with the **Expo Go** app
  installed (from Google Play / App Store) — the fastest way to run the mobile app without
  building an APK at all.

---

## 1. Unzip and install

```bash
cd shanutechx
npm install --workspaces --include-workspace-root
```

This installs `apps/api`, `apps/dashboard`, `packages/db`, and `services/*` — everything
except `apps/mobile-admin`, which is deliberately excluded from the shared workspace (it needs
its own isolated dependency versions; see §7).

If you hit a Puppeteer download error during install (used by one report-generation feature),
run instead:
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install --workspaces --include-workspace-root
```

---

## 2. Start Postgres and Redis with Docker

Simplest path — two standalone containers, no compose file needed for local testing:

```bash
docker run -d --name shanutechx-postgres \
  -e POSTGRES_USER=shanutechx \
  -e POSTGRES_PASSWORD=localdevpassword \
  -e POSTGRES_DB=shanutechx \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d --name shanutechx-redis \
  -p 6379:6379 \
  redis:7-alpine
```

Confirm both are up:
```bash
docker ps
```
You should see both containers with status `Up`.

---

## 3. Configure environment variables

### `apps/api/.env`
```bash
cp apps/api/.env.example apps/api/.env
```
Edit it and fill in at minimum:
```ini
PORT=4000
DATABASE_URL="postgresql://shanutechx:localdevpassword@localhost:5432/shanutechx?schema=public"
REDIS_URL="redis://localhost:6379"

FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

ROOT_DOMAIN="localhost"
SECRETS_ENCRYPTION_KEY="$(openssl rand -hex 32)"
PROJECT_AUTH_JWT_SECRET="$(openssl rand -hex 32)"
```
For every other secret in the file (Cloudflare, Leaseweb, R2, Discord/WhatsApp bot URLs,
SMS webhook secret, node agent secret, billing cron secret) — **generate a random placeholder
value for now** (e.g. `openssl rand -hex 24`). The server needs *some* value to boot for most
of these; you only need the *real* credential once you're actually testing that specific
integration (Leaseweb, Cloudflare DNS, R2 backups, Discord/WhatsApp bots).

> **Note on the two values above using `$(openssl rand -hex 32)`**: that's shell command
> substitution — if you're editing the `.env` file directly rather than piping through a
> shell, just run `openssl rand -hex 32` once yourself and paste the result in, twice, as two
> *different* random values (never reuse the same secret for both).

### `apps/dashboard/.env`
```bash
cp apps/dashboard/.env.example apps/dashboard/.env
```
```ini
NEXT_PUBLIC_FIREBASE_API_KEY="from your Firebase web app config"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```
Leave `NEXT_PUBLIC_GRAFANA_URL` and `NEXT_PUBLIC_WILDDUCK_ADMIN_URL` blank unless you're also
standing up the observability stack (§8) or a real mail server.

---

## 4. Set up the database

```bash
cd packages/db
npm run generate       # generates the real Prisma Client — this actually works on your
                        # machine, unlike in the sandbox this was built in (no network
                        # restriction blocking binaries.prisma.sh on your PC)
npm run migrate:deploy  # applies all 12 migrations — verified end-to-end against a real
                        # Postgres database while building this (see DELIVERY_NOTES.md §4.1),
                        # so this should apply cleanly
```

If you want to double check it worked:
```bash
DATABASE_URL="postgresql://shanutechx:localdevpassword@localhost:5432/shanutechx?schema=public" \
  npx prisma studio
```
This opens a real database browser in your default browser at `http://localhost:5555` — you
should see all 44+ tables, empty.

### Backfill the product catalog (only if you have existing `Service` rows to migrate)
```bash
npm run migrate:services-to-products
```
Safe to skip entirely on a fresh database with no existing services.

---

## 5. Start the API and Dashboard

Two separate terminal windows/tabs:

**Terminal 1 — API:**
```bash
cd apps/api
npm run dev
```
You should see it log that it's listening on port 4000. If you see a Firebase credential
error, double-check `FIREBASE_PRIVATE_KEY` — it must keep its `\n` literal characters exactly
as Firebase exports them (don't let your editor "helpfully" convert them to real newlines).

**Terminal 2 — Dashboard:**
```bash
cd apps/dashboard
npm run dev
```
Opens on `http://localhost:3001` (confirmed in `package.json` — `next dev -p 3001`).

Visit `http://localhost:3001` in your browser. You should land on a sign-in page.

---

## 6. Create your first account and become the dev/owner

1. On the dashboard, sign up with an email/password (this hits Firebase Auth directly from
   the browser — no backend involvement yet — then the API's `requireAuth` middleware
   auto-creates a matching `User` row in Postgres the first time that Firebase user makes an
   authenticated request).
2. Sign in once so that `User` row actually gets created.
3. Grab your Firebase UID: Firebase Console → Authentication → Users tab → copy the "User
   UID" column for the account you just created.
4. Promote yourself to the one true `dev` (owner) role:
   ```bash
   cd packages/db
   FIREBASE_UID="paste-your-uid-here" npm run seed:dev-owner
   ```
5. Refresh the dashboard. You should now see the **"Dev Dashboard"** button pinned to the top
   of the sidebar, and full access to every `/admin/*` and `/dev/*` page.

---

## 7. Testing checklist — what to actually click through

Once signed in as dev, here's a concrete path through the major features built this session:

- **Products & Plans** (`/admin/services`) — create a Product (pick any category, e.g.
  "VPS"), add a Plan to it (name, price, billing period). Confirm it shows up on `/services`
  (the customer storefront) grouped under the right category tab.
- **Cart & checkout** (`/cart`) — add the plan you just created, check out. Since there's no
  payment gateway (manual bank transfer by design), this creates an order in
  `awaiting_payment` and lets you upload a proof image.
- **Payment review** (`/admin/review-queue`) — approve or decline the payment you just
  submitted. Try declining without typing a reason first — it should refuse to let you submit,
  matching the server-side rule.
- **Discord webhooks** (`/dev/webhooks`) — paste in a real Discord webhook URL (Discord →
  channel settings → Integrations → Webhooks → New Webhook → Copy URL) and hit "Send Test" —
  you should see a real message land in that Discord channel within a second or two. This is
  one of the few things in this whole build that's fully testable without any other
  infrastructure.
- **Tickets** (`/tickets`, `/admin` side too) — open a ticket, reply to it, change its status.
- **VPS page** (`/vps`) — will show empty unless you actually have a Leaseweb account and API
  key configured; the page itself should load without erroring either way.
- **Projects / Database Studio** (`/projects`) — create a project, open its Table Editor and
  SQL Runner tabs, try a `SELECT 1` in the SQL runner.
- **Backups** (`/dev/backups`) — will show a real error if `R2_ACCESS_KEY_ID` etc. aren't set
  to real Cloudflare R2 credentials; that's expected without a real R2 bucket.

---

## 8. Optional: Node Agent, observability stack, full Docker Compose

### Node Agent (only needed to actually test deploying an app/container)
```bash
cd services/node-agent
npm install
npm run dev
```
Needs `NODE_AGENT_SECRET` (matching the same value in the API's `.env`) and a working local
Docker socket — since this agent literally runs `docker build`/`docker run` on whatever
machine it's on. Running it on your own dev machine means deployed apps end up as containers
on your own Docker, which is a fine way to test the flow end-to-end locally.

### Full production-style stack (Traefik, all services, one command)
```bash
cd infra/control-plane
cp .env.example .env   # if one doesn't exist, create it with the same vars as apps/api/.env
                        # plus POSTGRES_PASSWORD and ACME_EMAIL
docker compose up -d
```
This is the "as if it were really deployed" path — Traefik reverse proxy included, Postgres
and Redis run as containers instead of the standalone ones from §2. Heavier to set up, not
necessary just to click through features.

### Observability stack (Prometheus + Grafana + Loki)
```bash
cd infra/control-plane
docker compose -f docker-compose.yml -f observability/docker-compose.observability.yml up -d
```
Requires `GRAFANA_ADMIN_PASSWORD` set in your `.env` first. Once up:
- Prometheus targets: `http://localhost:9090/targets` (only reachable if you've also exposed
  that port — the compose file keeps it internal-only by default; add a `ports:` mapping if
  you want to check from your host browser)
- Grafana: exposed the same way — internal-only by default in the compose file. Add a
  `ports: ["3000:3000"]` line under the `grafana` service in
  `infra/control-plane/observability/docker-compose.observability.yml` if you want to open
  `http://localhost:3000` directly during local testing (change it back / put real auth in
  front before ever exposing this publicly).
- Once you can reach Grafana, log in (`admin` / whatever you set `GRAFANA_ADMIN_PASSWORD` to)
  and open the pre-provisioned **"ShanuTechX Overview"** dashboard.
- Set `NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000` in the dashboard's `.env` and restart it
  to light up the `/dev/monitoring` and `/dev/logs` pages.

This is genuinely the first time this stack will have actually run anywhere — it was written
as real infra-as-code but never executed in the sandbox that built it (no Docker there). Your
machine is the first real test of it.

---

## 9. Optional: running the mobile admin app

```bash
cd apps/mobile-admin
npm install
```

Before starting, fill in two things:
1. **`src/lib/firebase.ts`** — replace the placeholder Firebase config with your real values
   (same Firebase project as the dashboard).
2. **`app.json`** — set `expo.extra.apiBaseUrl`. If you're running the API on the same
   machine and want to test from your **phone** (not an emulator), `localhost` won't work from
   the phone's perspective — use your computer's LAN IP instead, e.g.
   `http://192.168.1.42:4000` (find yours with `ipconfig` on Windows or `ifconfig`/`ip a` on
   Mac/Linux). Your phone and computer need to be on the same Wi-Fi network.

Then:
```bash
npx expo start
```
This prints a QR code in your terminal. Open the **Expo Go** app on your phone and scan it —
the app loads directly on your phone, no build/APK needed for this kind of testing. Sign in
with the same account you created in §6.

If you'd rather use an Android emulator instead of a physical phone, press `a` in the terminal
after `expo start` (needs Android Studio + an AVD set up separately — not something this guide
covers, since you said you're testing on a PC and Docker is the tool you have ready).

To eventually get a real installable `.apk` (not needed just for testing the app, only for
actually distributing it): see `apps/mobile-admin/README.md`'s `eas build` instructions —
needs a free Expo account, no local Android SDK required for that path either.

---

## 10. Running the automated test suites yourself

To reproduce the exact verification numbers from `DELIVERY_NOTES.md`:

```bash
cd apps/api && npm run test        # should show 165 passing
cd apps/dashboard && npm run test  # should show 23 passing
cd apps/mobile-admin && npx tsc --noEmit   # should show zero errors
```

---

## Troubleshooting quick reference

| Symptom | Likely cause |
|---|---|
| API won't start, Firebase error | `FIREBASE_PRIVATE_KEY` newlines got mangled — must contain literal `\n` sequences, not real line breaks, inside the quoted `.env` value |
| `relation "X" does not exist` during migrate | You're on an old/partial database — `docker rm -f shanutechx-postgres` and redo §2–§4 fresh |
| Dashboard loads but every page 401s | You signed up but never actually signed in once (the `User` row is created on first authenticated API call, not at signup) |
| `/dev` pages 403 | You haven't run `seed:dev-owner` yet, or used the wrong Firebase UID |
| Mobile app can't reach the API from your phone | Using `localhost` instead of your computer's real LAN IP in `app.json` |
| Discord test button fails | Webhook URL pasted wrong, or Discord itself rate-limiting rapid test sends — wait a few seconds and retry |
| VPS/Backups/Leaseweb pages show connection errors | Expected without real credentials for those specific third-party services — every other page should still work fine |
