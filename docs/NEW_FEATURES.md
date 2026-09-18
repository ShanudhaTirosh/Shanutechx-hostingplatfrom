# 🆕 ShanuTechX — New Features & Platform Capabilities Changelog

> Comprehensive log of platform capabilities, architecture upgrades, and feature releases across all monorepo phases.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Ledger: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

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
