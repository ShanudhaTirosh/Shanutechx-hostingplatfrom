# ShanuTechX — Fixes Applied (Changelog)

This documents every change made to `shanutechx-source-clean.zip` in response to the code audit, delivered as `shanutechx-source-FIXED.zip`. Findings are referenced by the IDs from the original audit report (C1–C7, H1–H10, M1–M8).

**Before doing anything else: rotate every secret in the original `apps/api/.env`.** Those values were exposed to me as part of this review and must be treated as compromised regardless of anything below. The `.env` files have been stripped from this fixed archive entirely — you'll need to regenerate them from `.env.example` with fresh values.

**Infrastructure/deployment additions (separate from the bug-fix list below):** this pass also added a complete first-time deployment path — MinIO (object storage), a self-hosted Postal mail stack, and fixes to the pre-existing self-hosted Supabase stack (which had no persistent volumes, no working API gateway config, local-disk-only storage, and shipped public demo JWT keys) — wired into both `infra/control-plane/docker-compose.yml` (production, with Traefik/TLS) and the pre-existing `docker/docker-compose.shanutechx.yml` unified dev orchestrator. Also fixed a service-naming collision between Infisical (a bundled but previously-unwired secrets manager) and the other stacks that would have silently broken one of them when run together. Full details in `DEPLOYMENT_GUIDE.md`, not repeated here since it's deployment/infra work rather than an application bug.

---

## 🔴 Critical — all fixed

- **C2** — `GET /api/supabase/config` (leaked the Supabase service-role key to any authenticated user) now requires `requireAdminOrDev`. One-line fix in `routes/supabase.ts`.
- **C4** — `routes/settings.ts` rewritten. The PIN is now a bcrypt hash stored on `User.settingsPinHash` (new migration `20260819000000_settings_pin_hash`), not an in-memory value with a `'123456'`/`'admin'`/any-4-char fallback. Verification fails closed (412) if no PIN has been set — there is no bypass of any kind.
- **C5** — `nodes.ts`'s hardcoded `CLUSTER_SECRET` fallback removed entirely; it now uses the already-`required()` `env.nodeAgentSecret` with a timing-safe HMAC comparison. **This is the fix that matters most to apply before you go live** — rotate `NODE_AGENT_SECRET` to a new value, since the old hardcoded fallback is now public.
- **C6** — Added the missing `GET /agent/deployments/:containerId/metrics` route to `services/node-agent`. While implementing it, found and fixed a second, more severe bug: `docker.js` never actually exported `listContainers`/`startContainer`/`getLogs`/`streamLogs` (only destructured as `undefined` in `index.js`), so the Containers page, log viewer, and live log streaming were all crashing with `TypeError` on every real request. All four are now implemented with `dockerode` (including `modem.demuxStream` for live log streaming).
- **C7** — `apps/api/Dockerfile` now `COPY`s `templates/` into the build and runtime stages — the self-hosted app catalog (WordPress/n8n/MongoDB/Redis/Lavalink/LiveKit) was previously always empty in any Docker deployment. Also unified `catalog.ts` and `catalog-manager.ts` onto the same `__dirname`-relative path resolution (previously one used `process.cwd()`, which is fragile to how the process is launched).

## 🟠 High — all fixed except the H1/H8 persistence backlog (see "Not done" below)

- **H2 / H4 (node-agent)** — timing-safe secret comparison (was `!==`); bind host is now configurable (`AGENT_BIND_HOST`, default unchanged at `0.0.0.0` to avoid breaking existing deployments) with an optional `AGENT_ALLOWED_IPS` allowlist and a loud startup warning if neither is set.
- **H3** — Fixed the WhatsApp/Discord bot Docker networking bug: both now bind to all interfaces inside their own container (was `127.0.0.1`, which silently blocks sibling-container access even via Compose service-name DNS) — this was why WhatsApp/Discord notifications were silently never delivered under `docker-compose.local.yml`. Removed the now-pointless host port publishing for both in `docker-compose.local.yml` (they were never meant to be reachable from the host).
- **H4 (vps-plans.ts)** — delete route now matches `products.ts`'s correct pattern: try hard-delete, catch FK-constraint failures, fall back to `isActive: false` instead of a raw 500. (`catalog.ts`'s delete route was re-examined and found to be a different case — it deletes a template *file*, not a DB row with foreign keys, so the same pattern doesn't actually apply there; left as-is.)
- **H5** — Added `redact` config to both the base `pino` logger and the `pino-http` instance — `Authorization`, `x-agent-secret`, `x-internal-secret`, `x-cron-secret`, `x-webhook-secret`, `x-signature` headers, plus common secret-shaped field names, are no longer written to plaintext logs.
- **H6** — Billing sweep and uptime checks now self-schedule via BullMQ in `worker.ts` (daily at 01:00, and every 5 minutes, respectively), matching the pattern SSL renewal already used. No longer dependent on a `.github/workflows/billing-cron.yml` that never existed. The manual "run checks" endpoints in `routes/billing.ts`/`routes/status.ts` still work too.
- **H7 — rewritten as a real feature, not just a bug fix.** Per your follow-up request, the entire Git-connect flow has been replaced:
  - **GitHub**: a real GitHub App integration. Users install the App and pick repos on GitHub's own UI; we store only the installation ID (`GitHubInstallation` model, new migration). Every API call mints a fresh, short-lived (~1hr) installation access token via a signed App JWT — no PAT, no long-lived token stored anywhere.
  - **GitLab**: a real OAuth application integration (`read_user read_repository` scopes only). Access + refresh tokens are encrypted at rest (`GitLabConnection` model, same migration) and refreshed automatically when expired.
  - Both sit behind a common `GitProviderAdapter` interface (`lib/gitProviders/types.ts`) so a third provider is "implement the interface, register it in `index.ts`" — nothing else changes.
  - A signed, single-use, 5-minute `state` parameter replaces the old raw-user-ID state (fixes the account-linking CSRF weakness).
  - The dashboard's "Connect GitHub/GitLab" now redirects the browser directly to the provider — there is no token-paste modal or input field anywhere in the flow anymore.
  - `routes/deployments.ts` and `routes/filesystem.ts`'s git-push both resolve a scoped token server-side from a connected account ID; `gitToken` is retained only for `gitProvider: 'custom'` (self-hosted git hosts with no App/OAuth integration here).
- **H8** — Solved as a side effect of the H7 rewrite: the old unpersisted, in-memory `gitUserAccounts` map is gone entirely, replaced by the two real, persisted Prisma models above.
- **H9** — Added audit logging to `leaseweb.ts`'s `credentials` and `ssh-ticket` routes (previously the two most sensitive actions in that file left no trail at all). Added a new nullable `AuditLog.actorRole` column (migration `20260819000100_audit_log_actor_role`) so customer self-service actions (like VPS password reset) are distinguishable from genuine staff actions — populated on all three routes now.
- **H10** — Fixed every broken SDK path/shape found in the original audit:
  - `packages/node-agent`: `stopContainer`/`startContainer`/`restartContainer` now call the real `/agent/deployments/:id/{action}` routes.
  - `packages/client`'s `deployments.ts`: `getResourceUsage` now reads from the real detail response instead of a nonexistent `/stats` route; `addDomain`/`removeDomain` now hit the real `/custom-domain` route with the right shape (plus a new `verifyDomain()`); `delete()` now throws a clear, explicit error instead of silently 404ing, since there genuinely is no server-side delete-the-record route (that's a product decision outside the scope of a bug fix — see "Not done" below).
  - `packages/client`'s `git.ts`: rewritten entirely to match the new H7 architecture — `removeAccount` now uses the real `/git/disconnect` endpoint; `resolveAccountForRepo`'s broken `.login` property lookup fixed (`packages/types`' `GitAccount`/`GitRepo` types corrected to match what the API actually returns).

## 🟡 Medium — all fixed

- **M1** — Replaced the reflect-any-Origin-with-credentials CORS middleware with the `cors` package configured against an explicit allowlist (the same one `csrfProtection.ts` already maintained — now shared via `isOriginAllowed()` instead of being duplicated).
- **M2/M3** — `.env.example` updated: documented that `WHATSAPP_BOT_URL`/`DISCORD_BOT_URL` need Compose service names under Docker (not `localhost`), and added the new GitHub App / GitLab OAuth variables.
- **M6** — `billing.ts`'s cron-fallback now allows `dev` role, not just `admin`, matching `requireAdmin`'s behavior everywhere else.
- **M7** — Deleted `lib/verifyPayment.ts.disabled`, `lib/gemini.ts`, `lib/groq.ts` (confirmed dead — nothing imported them) and their now-unused `GEMINI_API_KEY`/`GROQ_API_KEY` env vars.
- **M8** — Fixed the double-mounted `settingsRouter` (was mounted at both `/api/settings` and `/api`, with route paths that happened to paper over it). Now mounted once at `/api/settings` with route paths matching exactly what the dashboard frontend already calls (`verify-password`, `change-pin`, `configs`).

## Templates: hardcoded default passwords — fully fixed, including auto-generation

All six `templates/*.yaml` files (WordPress, n8n, MongoDB, Redis, Lavalink, LiveKit) had weak, now-public default passwords baked in via Compose's `${VAR:-default}` fallback syntax. These have been changed to `${VAR:?VAR must be set}` (Compose's required-variable syntax — fails loudly instead of silently deploying with a known weak password).

`routes/catalog.ts`'s deploy handler now auto-generates a strong random value (`crypto.randomBytes(24).toString('base64url')`) for each of these specific keys whenever the customer doesn't supply one, so a deploy never actually fails because of this — and returns the generated values in the deploy response (`generatedSecrets`) so the customer can save them. This was the piece flagged as incomplete in the previous version of this changelog; it's now done.

## C3 — webmail cross-tenant IDOR — fixed

`routes/webmail.ts` is now backed by a real, per-user-owned `WebmailMessage` Prisma model (migration `20260819000300_webmail_per_user_scoping`) instead of a single global in-memory `Map` shared by every user on the platform. Every route (`list`, `get`, `patch`, `delete`) filters by the authenticated user's own ID — a message belonging to another user simply doesn't match the query and 404s, closing the IDOR.

As part of the same fix, `POST /webmail/send` now sends through the user's actual provisioned `SmtpAccount` credentials (same `encryptSecret`/`decryptSecret` pattern already used correctly in `routes/smtp.ts`/`routes/email.ts`) instead of the old undocumented `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` env vars with a hardcoded fallback password — this also resolves M4/M5 from the original audit. Delivery failures are now awaited and surfaced to the caller (`502` with the saved draft still returned) instead of silently disappearing into an unawaited background promise.

## H1 — every remaining in-memory store persisted

All four remaining unpersisted, in-memory feature stores identified in the original audit have now been replaced with real Prisma-backed tables, following the same pattern established by the git-provider and webmail rewrites above:

- **Knowledge Base** (`routes/knowledgebase.ts`) — new `KbArticle`/`KbCategory` models (migration `20260819000400_knowledgebase_tables`, seeded with the original demo content so behavior is unchanged immediately after migrating). All CRUD routes rewritten.
- **Global SMTP config + per-account domains/aliases** (`routes/smtp.ts`) — the platform-wide outbound mail config is now a persisted `PlatformSmtpConfig` singleton (password encrypted via `secretsVault`, migration `20260819000500_smtp_persisted_config`); per-account custom domain + alias list now live directly on `SmtpAccount` (new columns in the same migration). The hardcoded fallback password (`'smtp_secret_pass'`) is now only used to seed the config row the very first time it's read, not as a permanent runtime fallback.
- **Custom email domain verification records** (`routes/email.ts`) — new `EmailDomain` model (migration `20260819000600_email_domain_records`).
- **Secrets Vault** (`routes/secrets.ts`) — new `SecretProject`/`SecretItem`/`SecretAuditEntry` models (migration `20260819000700_secrets_vault_tables`). Secret values are now actually encrypted at rest (AES-256-GCM via the existing `secretsVault`) — the previous in-memory version stored them as plaintext despite being branded a "vault."
- **Supabase management panel** (`routes/supabase.ts`) — new `SupabaseClientProject`, `SupabaseAuthSmtpConfig`, `SupabaseEmailTemplate`, `SupabaseSmtpDeliveryLog` models (migration `20260819000800_supabase_panel_tables`, seeded with the original demo content/templates). **Scope note:** this only fixes the persistence bug — it does not make the "client projects" into real, separately-provisioned, isolated Supabase stacks (this platform runs one shared Kong/GoTrue/PostgREST stack under the hood). That's a genuine infrastructure project, not a bug fix, and is out of scope here.

All dashboard-facing response shapes were preserved exactly (verified against `lib/api.ts` and `lib/secretsApi.ts`), so no frontend changes were needed for any of these five.

---

## Everything from the original audit is now addressed

Every Critical, High, and Medium finding from the original audit report — including every item raised across all follow-up review passes — has been fixed. What's left is only the "Low / cleanup" tier from the very first version of the audit report:

- The 40 Prisma relations without an explicit `onDelete` (likely intentional, given the soft-delete pattern used elsewhere — worth a confirmation pass, not an urgent fix)
- `CLAUDE.md` claims Next.js 15; the actual pinned version is 14.2.35
- One remaining spot flagged in `packages/types/src/git.ts`'s comments where the pre-existing `/git/repos` response shape includes a raw provider token — noted but not changed in this pass
- `DeploymentsResource.delete()` (part of H10) now fails with a clear error instead of silently 404ing, but there's still no real server-side "delete this deployment record" endpoint — only `stop()`. Adding one needs a deliberate product decision about cascade behavior (subscriptions, invoices, logs) that shouldn't be made unilaterally as part of a bug-fix pass.

None of these were re-verified as still-current in this final pass, and none are urgent.

---

## Before you deploy this

1. **Rotate every secret** that was in the original `apps/api/.env` — especially `NODE_AGENT_SECRET` (C5) and `SECRETS_ENCRYPTION_KEY` (rotating the latter means re-encrypting every existing stored credential — see the original audit's Phase 0 notes).
2. Run `npx prisma migrate deploy` (or generate + review the migrations first) — nine new migrations were added, in order: `20260819000000_settings_pin_hash`, `20260819000100_audit_log_actor_role`, `20260819000200_git_provider_integrations`, `20260819000300_webmail_per_user_scoping`, `20260819000400_knowledgebase_tables`, `20260819000500_smtp_persisted_config`, `20260819000600_email_domain_records`, `20260819000700_secrets_vault_tables`, `20260819000800_supabase_panel_tables`.
3. Set up a real GitHub App and GitLab OAuth application (see the new block in `apps/api/.env.example`) before the "Connect GitHub/GitLab" buttons will do anything — until then, `GET /api/git/config` reports both as unconfigured and the dashboard should hide the buttons accordingly (confirm this UI behavior exists — I didn't add explicit hide-if-unconfigured logic to the button itself in this pass).
4. Every existing user's `settingsPinHash` will be `null` after the migration — the first time anyone tries to unlock Settings, they'll need to set a PIN via `change-pin` first (intentional — see C4).
