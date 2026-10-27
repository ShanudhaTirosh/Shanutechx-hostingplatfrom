# ShanuTechX Status — Public Cloud Uptime & Telemetry Platform

**Autonomous public status dashboard and live infrastructure monitor for the ShanuTechX platform. Features real-time HTTP/HTTPS, TCP port, and ICMP ping checks, SQLite history persistence, and a live `/admin` management studio.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)

---

## 🚀 Quick Start

### Local Development (Port 3003)
From the monorepo root:
```bash
npm run dev:status
```
Or inside `apps/status`:
```bash
npm install
npm run dev
```
Open [http://localhost:3003](http://localhost:3003) (or `/admin` for the admin portal).

### Production Docker Container
Integrated into `infra/control-plane/docker-compose.yml` and `docker-compose.prod.yml`:
- Domain: `https://status.shanutechx.com`
- Traefik Port: `3003`
- Database Volume: `status-data` mapped to `/app/data` (persists SQLite database `status.db`)

---

## Features

- **Admin Panel (no code required)**: Add, edit, enable/disable, and delete monitors and change all settings from a protected `/admin` UI — no code edits or redeploys. Changes are picked up by the monitoring loop live.
- **Multiple monitor types**: HTTP/HTTPS (status code + optional keyword match), TCP port, and ICMP ping.
- **Live Monitoring**: Background checks with configurable intervals and timeouts.
- **Modern UI**: Clean dashboard built with Next.js App Router and Tailwind CSS.
- **Timeline View**: Visual history of site health and latency.
- **Configurable branding**: Site name, tagline, and footer editable from the admin UI.
- **Notifications**: Email, Google Chat, MS Teams, and Telegram — editable from the admin UI (DB-backed, with env fallback).
- **Data retention**: Old check history is auto-pruned on a configurable schedule.

---

## Admin Panel

Everything is now managed at runtime — `lib/config.ts` only seeds the initial monitors on first run.

1. Set an admin password and session secret (see [Environment Variables](#environment-variables)).
2. Visit **`/admin`** — you'll be redirected to the login page.
3. Log in with `ADMIN_PASSWORD`. From there you can:
   - **Monitors**: add/edit/delete HTTP, TCP, or Ping monitors; toggle enabled; set interval/timeout.
   - **Settings**: branding (name/tagline/footer/meta), notification channels, data retention, and change the admin password.

Monitors and settings are stored in the SQLite database (persisted via the Docker volume), so they survive restarts. Deleting a monitor keeps its historical uptime data.

> ICMP **Ping** monitors require the `NET_RAW` capability in Docker (already set in `docker-compose.yaml`) and the `iputils` package (installed in the `Dockerfile`).

---

## Environment Variables

Copy `sample.env` to `.env` and adjust:

```env
# Admin panel (required for /admin)
ADMIN_PASSWORD=changeme
SESSION_SECRET=a-long-random-stable-string

# Notifications (initial defaults — also editable from the admin UI)
EMAIL_ENABLED=true
EMAIL_HOST=smtp.example.com
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_TO=admin@example.com
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/...
TEAMS_WEBHOOK_URL=https://outlook.office.com/...

# Telegram — bot token from @BotFather, chat ID from @userinfobot
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789
```

`SESSION_SECRET` must be a long random string and **stable across restarts** (otherwise active admin sessions are invalidated). The notification env vars are used as field-level fallbacks until you save notification settings in the admin UI.

---

## Project Structure (Feature-First)

- **app/**: Routes, layouts, and metadata.
- **features/**: Domain logic (status monitoring, notifications).
- **components/ui/**: Reusable UI components.
- **lib/**: Cross-feature utilities (database, config, env validation).

---

## License

This project is licensed under the AGPL-3.0 License.
