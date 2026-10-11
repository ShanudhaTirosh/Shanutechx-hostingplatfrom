# 🆕 ShanuTechX — New Features & Platform Capabilities Changelog

> Comprehensive log of platform capabilities, architecture upgrades, and feature releases across all monorepo phases.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Ledger: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## Phase 18 — SEO, Dynamic Sitemap, AI Bot Discovery & Enterprise Security Disclosure

### 🗺️ Dynamic Sitemap Engine (`/sitemap.xml`)
- **20 Platform Routes**: Automated indexing via [`apps/web/app/sitemap.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/sitemap.ts) with dynamic lastModified timestamps, change frequencies (daily/weekly/monthly), and priority hierarchies (1.0 for Home, 0.9 for VPS, App Hosting, Bot Hosting, Databases, Pricing, Docs, and Catalog).

### 🤖 Granular Robots.txt & AI Web Crawler Permissions
- **Dual Policy Governance**: Configured in [`apps/web/app/robots.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/robots.ts).
- **Search Engines (`*`)**: Allowed on public pages, disallowed on `/dashboard`, `/api`, `/login`, `/cart`, `/admin`.
- **AI Crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `Amazonbot`, `cohere-ai`, `Meta-ExternalAgent`, `Bytespider`, `Diffbot`, `CCBot`)**: Explicitly permitted to learn about public business capabilities, catalog templates, pricing matrices, and technical documentation, while strictly blocking access to private user sessions and authenticated endpoints.
- **Subsystem Isolation**: Added `User-agent: *\nDisallow: /` and `noindex` directives across [`apps/dashboard`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard), [`apps/webmail`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/webmail), and [`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api) `/robots.txt`.

### 🧠 LLM Standards (`/llms.txt` & `/llms-full.txt`)
- **Concise Context Feed**: [`apps/web/public/llms.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/llms.txt) adhering to the llmstxt.org specification, delivering high-signal summaries of business offerings, developer capabilities, and usage policies.
- **Exhaustive Technical Reference**: [`apps/web/public/llms-full.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/llms-full.txt) providing complete hardware tiers, REST API endpoint schemas, catalog template specifications, and deployment recipes for AI agent ingestion.

### 🛡️ RFC 9116 Security Disclosure & RFC 8461 Email Security
- **RFC 9116 Vulnerability Disclosure**: Policy at [`apps/web/public/.well-known/security.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/.well-known/security.txt) with security contact (`security@shanutechx.com`), safe harbor scope, 2027 expiration, and `/security.txt` redirect.
- **RFC 8461 SMTP MTA-STS**: Policy at [`apps/web/public/.well-known/mta-sts.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/.well-known/mta-sts.txt) enforcing strict TLS encryption on incoming mail transport for `mail.shanutechx.com`.
- **RFC Human Credit**: Standard [`apps/web/public/humans.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/humans.txt) celebrating the team, open source credits, and tech stack.

### 📊 Schema.org Rich Data & Client Metadata Wrappers
- **Connected `@graph`**: Injected into [`apps/web/app/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/layout.tsx) linking `Organization`, `WebSite`, and `SoftwareApplication` with product pricing offers.
- **Client Metadata Wrappers**: Added dedicated `layout.tsx` files for client-side pages (`/docs`, `/pricing`, `/faqs`, `/help`, `/status`, `/reviews`) enabling full title/OG tags and `FAQPage` rich snippets.

---

## Phase 17 — Unified Dev Studio, OAuth SSO Standard & Node Port Exposure Engine

### 🔐 Multi-Provider OAuth SSO Standard
- **OAuth-Only Authentication**: Security posture updated to require Single Sign-On (SSO) exclusively via Google, GitHub, and Discord OAuth identities (`Authorization: Bearer <idToken>`). Direct email/password input forms are disabled across client applications (`apps/dashboard`, `apps/mobile-admin`, `apps/web`).
- **Automatic User Provisioning**: Backend APIs auto-provision and synchronize user accounts tied to OAuth tokens upon login.

### 🌐 Unified Dev Studio & Databases Hub
- **Single Workspace**: Unified control panel page ([`apps/dashboard/app/(protected)/dev/projects/page.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/(protected)/dev/projects/page.tsx)) to manage Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures.
- **Target Node Selection & Direct Studio Launch**: Target VPS host node selection with direct Launch Studio UI button (`http://<nodeIp>:<studioPort>`) opening in a new tab.

### 🛰️ Global Node Registration & Auto-DNS
- **Global Compute Capability**: Registering a host node automatically defaults to global capabilities without mandatory usage configuration.
- **Automatic Cloudflare A-Record**: Creates a Cloudflare DNS A-record (`node-<label>.<rootDomain>`) pointing to the node IP address upon registration.

### 🔌 Node Port Exposure Engine
- **Custom/Auto Subdomain Port Mapping**: Expose any internal port on a compute node to an auto-created platform subdomain (e.g., `http://node1-port-8080.shanutechx.com`).
- **Cloudflare DNS & Database Tracking**: Tracked via `NodePortExposure` Prisma model and synced directly with Cloudflare DNS zone records.

### 💾 Cloudflare R2 Database Backups
- **Automated Gzipped Snapshots**: Daily automated PostgreSQL backups compressed via gzip and uploaded to Cloudflare R2 object storage.
- **1-Click Database Restore**: Built-in automated restore module ([`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts)) supporting gzipped SQL archive restoration directly into `psql`.

---

## Phase 16 — Browser File Manager, Encrypted Env Vars, Archive Extraction & Git Push

### 📂 Browser File Manager
- **In-browser file tree navigation**: Browse workspace directories with breadcrumb navigation.
- **Code Editor**: Edit text files with Tab-key indentation support and `Ctrl+S` save shortcut.
- **Create Files & Folders**: Create new files and directories from the toolbar.
- **Rename & Delete**: Rename or delete any file/directory with confirmation dialogs.
- **Multi-File Upload**: Upload binary files, images, archives, or source files directly into any workspace directory via `Upload Files` button.
- **Archive Extraction (Zip/Tar)**: 1-click "Extract" button on `.zip`, `.tar.gz`, `.tgz`, `.tar` files — runs on the node agent via `unzip` / `tar`.

### 🔐 Encrypted Environment Variables Panel
- **Platform DB Storage**: Env vars encrypted with AES-256-GCM via [`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts) and stored in `envVarsEncrypted` column.
- **Auto-Import from Repo**: Automatically reads `.env` or `.env.example` from workspace and pre-fills the form.
- **Live Container Restart**: Saving env vars triggers an immediate container restart with live build streaming log.

### ↑ Git Commit & Push from Browser
- **Edit & Push**: Edit any file in the browser and push a commit directly to GitHub or GitLab.
- **Account Picker**: Pick which connected account to push from.

---

## Phase 15 — Git App Integration, Auto-Deploy, Railpack Custom Deployments

### 🔌 GitHub App & GitLab App OAuth Integration
- Full OAuth flow: auth redirect -> code exchange -> token storage (AES-256-GCM encrypted in secretsVault).
- Connect multiple GitHub and/or GitLab accounts per user.

### 🔄 Auto-Deploy Webhooks
- `GET /api/deployments/:id/webhook-info` — returns unique deployment webhook URL + HMAC secret.

---

## Phase 14 — Leaseweb VPS Reseller, Node Agent Enhancement, Status Page

### 🏢 Leaseweb VPS Reseller API
- Manage VPS instances, check bandwidth stats, trigger OS reinstalls, and manage snapshots via Leaseweb API wrapper ([`leasewebClient.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/leasewebClient.ts)).

### 🤖 Node Agent 1-Line Onboarding
- Self-contained bash installer script (`GET /api/nodes/install.sh`) for installing Docker, hardware probing, self-registering, and running the node agent container.
