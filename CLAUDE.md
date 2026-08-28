# CLAUDE.md — ShanuTechX Developer & AI Assistant Guide

Context, common commands, architectural rules, and coding standards for developers and AI assistants working on the ShanuTechX codebase. For the operational quick-start (commands, test runners, env requirements), see [AGENTS.md](AGENTS.md).

## Common Workspace Commands

### Development Servers
- **Express API Backend:** `npm run dev:api` (`http://localhost:4000`)
- **Next.js Dashboard:** `npm run dev:dashboard` (`http://localhost:3001`)
- **Storefront Web:** `npm run dev:web` (`http://localhost:3000`)
- **Node Agent Engine:** `npm run dev:node-agent`
- **WhatsApp Service:** `npm run dev:whatsapp`
- **Discord Service:** `npm run dev:discord`

### Database Commands (Prisma & PostgreSQL)
- **Generate Prisma Client:** `npm run db:generate`
- **Apply DB Migrations:** `npm run db:migrate`
- **Deploy Migrations (Production):** `npm run db:migrate:deploy`

### Build & Testing
- **Run Unit Tests (CI-allowed suite):** `npm run test:unit`
- **Build Shared SDK Packages:** `npm run build:sdk` → `npm run publish:sdk` (changesets → GitHub Packages)
- **TypeScript Check (API):** `npx tsc --noEmit --project apps/api/tsconfig.json`
- **Expo Mobile Admin typecheck:** `npx tsc --noEmit` (from `apps/mobile-admin`, which is NOT part of the root workspaces)

## Architecture & Project Layout

- `apps/`
  - `api/` — Express REST API (TypeScript). Source of truth for routes/business logic. Entrypoints: `src/index.ts` (Express) and `src/worker.ts` (BullMQ background jobs).
  - `dashboard/` — Next.js App Router customer/admin dashboard.
  - `web/` — Next.js App Router public storefront & marketing site.
  - `mobile-admin/` — Expo / React Native Android & iOS admin app (standalone — excluded from npm workspaces).
- `packages/` — core packages (`db`, `types`, `client`, `catalog`, `deployments`, `node-agent`, `tracing`, `auth`) plus vendored/derived Supabase SDKs (`supabase-js`, `postgrest-js`, `realtime-js`, `storage-js`, `auth-js`, `functions-js`).
- `services/`
  - `node-agent/` — plain JavaScript (`.js`), Docker control + telemetry agent run per VPS node.
  - `discord-bot/`, `whatsapp-bot/` — notification gateways.
- `docker/`, `infra/`, `templates/` — compose files, infra setups, and one-click app catalog templates.

## Env / Boot Requirements

- `apps/api/src/env.ts` **throws at boot** on any missing `required(...)` var (e.g. `DATABASE_URL`, `FIREBASE_*`, `CLOUDFLARE_*`, `ROOT_DOMAIN`, `SECRETS_ENCRYPTION_KEY`, `SMS_WEBHOOK_SECRET`, `BILLING_CRON_SECRET`, `PROJECT_AUTH_JWT_SECRET`). Treat it as the authoritative env contract — `.env.example` is stale and its names diverge.
- `.npmrc` pins `@shanutechx:registry=https://npm.pkg.github.com`; installing workspace deps may require GitHub Packages npm auth.

## Key Design Principles & Guardrails

1. **Strict Types & Real Data:** Avoid hardcoded dummy data arrays in production components. Use dynamic DB queries (`prisma.*`) or API endpoints (`api.*`).

2. **Database Integrity & Deactivation:** When deleting entities that have existing historical order references (e.g. Products/Plans), set `isActive: false` (deactivate) rather than hard-deleting, to avoid foreign key constraint errors.

3. **Security & Secrets Encryption:** Store sensitive environment variables and secrets encrypted with AES-256-GCM via `encryptSecret` / `decryptSecret` in `apps/api/src/lib/secretsVault.ts`.

4. **Code Style & Markdown Links:** Use strict TypeScript interfaces. Reference workspace files with clickable Markdown links: `[file.ts](file:///absolute/path/to/file.ts)`.
