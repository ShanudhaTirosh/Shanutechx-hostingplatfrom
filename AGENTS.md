# AGENTS.md — ShanuTechX

An autonomous enterprise cloud-hosting platform. Monorepo (npm workspaces). See [CLAUDE.md](CLAUDE.md) for design guardrails; this file is the operational quick-start.

## Environment

- **Node 20 required** (CI uses `node-version: 20`; `engines` in the API allows `>=18`).
- **`apps/mobile-admin` is NOT an npm workspace** — excluded by the root `workspaces` glob (`!apps/mobile-admin`). It's a standalone Expo app with its own `npm ci`. Typecheck it from inside that dir: `npx tsc --noEmit`.
- **`.npmrc` pins `@shanutechx:registry=https://npm.pkg.github.com`** — workspace deps install from the GitHub Packages registry, which may require npm auth.

## Workspace commands (root)

- Dev servers: `npm run dev:api` (port 4000), `dev:dashboard` (3001), `dev:web` (3000), `dev:whatsapp`, `dev:discord`, `dev:node-agent`. Run a service with `npm run dev --workspace=apps/api` (etc.).
- Database (all delegate to `packages/db`): `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`. Also there: `migrate:services-to-products`, `seed:dev-owner`, `prisma studio`.
- Tests: `npm run test:unit`
- SDK build: `npm run build:sdk` (types, client, auth, deployments, catalog, node-agent) then `npm run publish:sdk` (changesets → GitHub Packages).
- API typecheck: `npx tsc --noEmit --project apps/api/tsconfig.json`

## Testing (three distinct setups — don't assume one runner)

- `tests/unit/*.test.ts` → run by root `npm run test:unit` via `tsx --test` (node:test). Pure functions, **no DB / env** required. **This is the only suite CI runs.**
- `tests/integration/*.test.ts` → root `tsx --test tests/integration/*.test.ts`. Import `lib/prisma`, so require a **generated Prisma client** (`npm run db:generate`). **Not run in CI.**
- `apps/api/src/routes/*.test.ts` → **vitest** (`npm run test --workspace=apps/api`). Separate runner, not invoked by root `test:unit`.

## API boot requirements

- `apps/api/src/env.ts` **throws at boot** on any missing `required(...)` var — it is the authoritative env contract. Reading `.env.example` alone is not reliable: it's stale and several names differ (e.g. `SECRETS_ENCRYPTION_KEY`, `SMS_WEBHOOK_SECRET`, `BILLING_CRON_SECRET`, `PROJECT_AUTH_JWT_SECRET`, `FIREBASE_*`).
- Real entrypoints: `apps/api/src/index.ts` (Express) and `apps/api/src/worker.ts` (background jobs, BullMQ).

## Architecture (concise)

- Workspaces: `apps/*` (minus mobile-admin), `packages/*`, `services/*`.
- `apps/`: `api` (Express + Prisma, source of truth for routes/business logic), `dashboard` + `web` (Next.js App Router).
- `services/node-agent` is **plain JavaScript** (`.js`, not TypeScript) — Docker control + telemetry agent run per VPS node.
- `services/discord-bot` and `services/whatsapp-bot`: notification gateways.
- `packages/` includes core packages (`types`, `client`, `catalog`, `db`, `deployments`, `node-agent`, `tracing`) plus vendored/derived Supabase SDKs (`supabase-js`, `postgrest-js`, `realtime-js`, `storage-js`, `auth-js`, `functions-js`).

## Design guardrails (details in CLAUDE.md)

- Strict TS interfaces; no hardcoded dummy data — query via `prisma.*` / `api.*`.
- Deactivate (`isActive: false`) entities with historical order references instead of hard-deleting (avoids FK errors).
- Encrypt sensitive secrets with AES-256-GCM via `encryptSecret`/`decryptSecret` in `apps/api/src/lib/secretsVault.ts`.
- Reference workspace files with clickable `file:///...` links.
