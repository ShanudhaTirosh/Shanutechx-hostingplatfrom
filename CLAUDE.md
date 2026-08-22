# CLAUDE.md — ShanuTechX Developer & AI Assistant Guide

This document provides context, common commands, architectural rules, and coding standards for developers and AI assistants working on the ShanuTechX codebase.

---

## 🛠️ Common Workspace Commands

### Development Servers
- **Start Express API Backend:** `npm run dev:api` (Runs on `http://localhost:4000`)
- **Start Next.js Dashboard:** `npm run dev:dashboard` (Runs on `http://localhost:3001`)
- **Start Storefront Web:** `npm run dev:web` (Runs on `http://localhost:3000`)
- **Start Node Agent Engine:** `npm run dev:node-agent` (Runs on `http://localhost:9090` / `5000`)
- **Start WhatsApp Service:** `npm run dev:whatsapp`
- **Start Discord Service:** `npm run dev:discord`

### Database Commands (Prisma & PostgreSQL)
- **Generate Prisma Client:** `npm run db:generate`
- **Apply Database Migrations:** `npm run db:migrate`
- **Deploy Migrations (Production):** `npm run db:migrate:deploy`

### Build & Testing
- **Run Unit Tests:** `npm run test:unit`
- **Build Shared SDK Packages:** `npm run build:sdk`
- **TypeScript Check (API):** `npx tsc --noEmit --project apps/api/tsconfig.json`

---

## 🏗️ Architecture & Project Layout

```
shanutechx/
├── apps/
│   ├── api/                    # Express REST API (TypeScript)
│   │   └── src/routes/         # API endpoints (deployments, products, email, supabase, etc.)
│   ├── dashboard/              # Next.js 15 App Router Customer/Admin Dashboard
│   │   └── app/(protected)/    # Authenticated user pages
│   ├── web/                    # Next.js 15 Public Storefront & Marketing Site
│   └── mobile-admin/           # Expo / React Native Android Admin App
├── packages/
│   ├── db/                     # Prisma schema & PostgreSQL database migrations
│   └── types/                  # Shared TypeScript interfaces & types
├── services/
│   ├── node-agent/             # Docker control & telemetry agent (runs per VPS node)
│   ├── discord-bot/            # Discord notification gateway
│   └── whatsapp-bot/           # WhatsApp notification gateway
└── docker/                     # Compose files & infra setups
```

---

## 🔑 Key Design Principles & Guardrails

1. **Strict Types & Real Data:**
   - Avoid hardcoded dummy data arrays in production components.
   - Use dynamic database queries (`prisma.*`) or API endpoints (`api.*`).

2. **Database Integrity & Deactivation:**
   - When deleting entities with existing historical order references (e.g. Products/Plans), gracefully set `isActive: false` (deactivate) rather than crashing with foreign key constraint errors.

3. **Security & Secrets Encryption:**
   - Store sensitive environment variables and secrets encrypted with AES-256-GCM (`encryptSecret` / `decryptSecret`).

4. **Self-Hosted Integrations:**
   - **Supabase Stack Studio:** Accessible at local gateway `http://localhost:8000`.
   - **Traefik Gateway:** Includes automatic database deployment fallback when Traefik container API is unreachable.
   - **SMTP Host & Webmail:** Supports custom domains, SPF/DKIM/DMARC records, resource quotas (Storage MB, Aliases, Daily Send Limit), and direct Webmail access.

5. **Code Style & Markdown Links:**
   - Use strict TypeScript interfaces.
   - Always reference workspace files using clickable Markdown links: `[file.ts](file:///absolute/path/to/file.ts)`.
