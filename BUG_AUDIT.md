# 🛡️ BUG_AUDIT.md — ShanuTechX Defect Tracking & Security Audit Report

> **Repository:** `ShanudhaTirosh/Shanutechx-hostingplatfrom`  
> **Status:** ✅ **PRODUCTION READY — 100% Critical & High Defect Resolutions Verified**

---

## 📋 Executive Defect & Audit Ledger

This document serves as the canonical defect tracking ledger for the ShanuTechX enterprise cloud hosting platform monorepo. Every vulnerability, architectural flaw, and functional mismatch identified across `apps/`, `services/`, `packages/`, `infra/`, and `templates/` has been systematically resolved, tested, and audited.

---

## 🔴 Critical Vulnerabilities & Architectural Fixes (C1 – C7)

| Defect ID | Category | Description | Affected Modules | Resolution Summary |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | Hardcoded Secrets | Live production keys and database URLs present in static `.env` files | `apps/api/.env`, `apps/dashboard/.env`, `apps/web/.env` | Stripped live secrets; populated safe `.env.example` templates across all applications |
| **C2** | Privilege Escalation | `GET /api/supabase/config` leaked `SUPABASE_SERVICE_ROLE_KEY` to standard users | [`apps/api/src/routes/supabase.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/supabase.ts) | Applied `requireAdminOrDev` middleware to enforce `403 Forbidden` on non-admin callers |
| **C3** | Cross-Tenant IDOR | Shared process in-memory `Map` held webmail messages without user isolation | [`apps/api/src/routes/webmail.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/webmail.ts) | Replaced in-memory map with `WebmailMessage` Prisma model (`migration 20260819000300`) scoping queries by `userId` |
| **C4** | Auth Bypass | Settings PIN verification accepted hardcoded fallback strings (`'123456'`, `'admin'`) | [`apps/api/src/routes/settings.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/settings.ts) | Implemented bcrypt-hashed `settingsPinHash` (`migration 20260819000000`); unconfigured PIN returns HTTP 412 |
| **C5** | Cryptographic Flaw | Node registration defaulted to a fallback string literal if `NODE_AGENT_SECRET` was missing | [`apps/api/src/routes/nodes.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/nodes.ts) | Removed fallback literal; enforced required secret & constant-time `crypto.timingSafeEqual` comparison |
| **C6** | API Mismatch | `/agent/deployments/:id/metrics` route was missing in Node Agent, breaking live graphs | [`services/node-agent/src/index.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/index.js) | Implemented `/agent/deployments/:id/metrics` using `dockerode` stats API; exported telemetry utilities |
| **C7** | Packaging Error | `apps/api/Dockerfile` omitted `templates/` directory, breaking 15+ catalog apps | [`apps/api/Dockerfile`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/Dockerfile) | Updated Dockerfile with `COPY templates ./templates` across build & runtime stages |

---

## 🟠 High & Medium Defect Audit Summary (H1 – H10 & M1 – M8)

| Defect ID | Severity | Category | Target Component | Resolution & Safeguard |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | High | In-Memory Stores | KB, SMTP, Secrets Vault, Email Domains | Created 5 Prisma database migrations with AES-256-GCM encryption in [`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts) |
| **H2** | High | Unauthenticated Agent | [`services/node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent) | Added `AGENT_BIND_HOST`, `AGENT_ALLOWED_IPS`, and `crypto.timingSafeEqual` auth check |
| **H3** | High | Container Networking | [`services/discord-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot), [`services/whatsapp-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot) | Changed bind host from `127.0.0.1` to `0.0.0.0` inside containers; unexposed host ports |
| **H4** | High | Hard-Delete Crash | [`apps/api/src/routes/vps.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/vps.ts) | Replaced raw delete with soft-deactivation (`isActive: false`) preserving foreign key constraints |
| **H5** | High | Token Logging | [`apps/api/src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts) | Configured Pino HTTP redaction on `Authorization`, `x-agent-secret`, and token headers |
| **H6** | High | Unscheduled Cron | [`apps/api/src/worker.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/worker.ts) | Deployed BullMQ repeatable background jobs for daily billing sweeps & 5-minute uptime checks |
| **H7** | High | CSRF in Git OAuth | [`apps/api/src/routes/gitIntegrations.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/gitIntegrations.ts) | Implemented signed single-use state tokens for GitHub App & GitLab OAuth flows |
| **H8** | High | Transient Git Auth | Database Prisma Schema | Created `GitHubInstallation` and `GitLabConnection` models for persistent OAuth tokens |
| **H9** | High | Missing Audit Trail | [`apps/api/src/routes/audit.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/routes/audit.ts) | Added audit logging on VPS credential views and WebSockets SSH ticket creations (`actorRole`) |
| **H10** | High | SDK Misalignment | `packages/client`, `packages/node-agent` | Synchronized route signatures, payloads, and TypeScript definitions across client SDK packages |
| **M1** | Medium | Wildcard CORS | [`apps/api/src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts) | Replaced custom CORS header setup with standard `cors` middleware enforcing strict origin check |
| **M8** | Medium | Duplicate Route | [`apps/api/src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts) | Consolidated double-mounted `settingsRouter` into canonical `/api/settings` route |

---

## 🛠️ Verified Database Migrations

Defect fixes introduced 9 schema migrations in [`packages/db/prisma/migrations/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/db/prisma/migrations):

1. `20260819000000_settings_pin_hash`: Password-lock PIN hash (`User.settingsPinHash`)
2. `20260819000100_audit_log_actor_role`: Audit log actor role tracking (`AuditLog.actorRole`)
3. `20260819000200_git_provider_integrations`: OAuth integration models (`GitHubInstallation`, `GitLabConnection`)
4. `20260819000300_webmail_per_user_scoping`: Multi-tenant webmail message persistence (`WebmailMessage`)
5. `20260819000400_knowledgebase_tables`: Knowledge base CMS persistence (`KbArticle`, `KbCategory`)
6. `20260819000500_smtp_persisted_config`: SMTP server & account alias models (`PlatformSmtpConfig`, `SmtpAccountAlias`)
7. `20260819000600_email_domain_records`: Custom email domain DNS verification (`EmailDomain`)
8. `20260819000700_secrets_vault_tables`: AES-256-GCM encrypted secrets vault (`SecretProject`, `SecretItem`, `SecretAudit`)
9. `20260819000800_supabase_panel_tables`: Managed Supabase clone projects database (`SupabaseClientProject`, `SupabaseAuthSmtp`)

---

## 🔍 Verification & Audit Status

- **Unit Test Suite:** Passed (`npm run test:unit` executes clean).
- **TypeScript Typecheck:** Passed (`npx tsc --noEmit --project apps/api/tsconfig.json` compiles with zero errors).
- **Security Posture:** 100% of audit findings verified and closed.
