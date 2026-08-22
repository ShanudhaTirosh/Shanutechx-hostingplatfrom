# 🆕 ShanuTechX — New Features & Changelog

---

## Phase 16 — Browser File Manager, Encrypted Env Vars, Archive Extraction & Git Push

### 📂 Browser File Manager
- **In-browser file tree navigation**: Browse workspace directories with breadcrumb navigation
- **Code Editor**: Edit text files with Tab-key indentation support and `Ctrl+S` save shortcut
- **Create Files & Folders**: Create new files and directories from the toolbar
- **Rename & Delete**: Rename or delete any file/directory with confirmation dialogs
- **Multi-File Upload**: Upload binary files, images, archives, or source files directly into any workspace directory via `📤 Upload Files` button
- **Archive Extraction (Zip/Tar)**: 1-click "Extract" button on `.zip`, `.tar.gz`, `.tgz`, `.tar` files — runs on the node agent via `unzip` / `tar`
- **File Icons**: Smart context-aware icons (🐳 Dockerfile, 🔐 .env, 🟦 TypeScript, 📦 archives, etc.)

### 🔐 Encrypted Environment Variables Panel
- **Platform DB Storage**: Env vars are encrypted with AES-256-GCM and stored in `envVarsEncrypted` column — never written to Git
- **Auto-Import from Repo**: On first load (when no env vars exist), automatically reads `.env` or `.env.example` from workspace and pre-fills the form
- **Manual Repo Import Button**: "📥 Import Defaults from Repo (.env)" — merges repo defaults without overwriting existing values
- **Live Container Restart**: Saving env vars triggers an immediate container restart with live build streaming log
- **Mask/Reveal Per Field**: Eye icon toggle to mask/reveal each value individually
- **Duplicate Key Detection**: Validates no duplicate keys before saving

### ↑ Git Commit & Push from Browser
- **Edit & Push**: Edit any file in the browser and push a commit directly to GitHub or GitLab
- **Account Picker**: If multiple Git accounts are connected, pick which one to push from
- **Commit Message Field**: Custom commit message input with smart default (`Update <filename>`)
- **Opens Commit URL**: After successful push, auto-opens the GitHub/GitLab commit page

### ⚡ Auto-Deploy Webhook Panel
- **Webhook URL Generation**: GET `/api/deployments/:id/webhook-info` returns a unique signed webhook URL and secret
- **GitHub & GitLab Instructions**: Tab UI with provider-specific setup instructions and copy buttons

### Node Agent Enhancements
- `POST /agent/fs/:id/upload-binary` — Write binary file from base64 string
- `POST /agent/fs/:id/extract` — Extract `.zip`, `.tar.gz`, `.tgz`, `.tar` archives using system `unzip`/`tar`
- Both endpoints are jail-pathed to the deployment workspace root to prevent directory traversal

---

## Phase 15 — Git App Integration, Auto-Deploy, Railpack Custom Deployments

### 🔌 GitHub App & GitLab App OAuth Integration
- Full OAuth flow: auth redirect → code exchange → token storage (AES-256-GCM encrypted in secretsVault)
- `GET /api/git/github/auth` + `GET /api/git/github/callback`
- `GET /api/git/gitlab/auth` + `GET /api/git/gitlab/callback`
- `GET /api/git/repos` — list repos for all connected accounts (supports both GitHub and GitLab)
- `GET /api/git/accounts` — list connected git accounts for a user
- `DELETE /api/git/accounts/:id` — disconnect/remove a git account

### 📦 Multiple Git Accounts Support
- Connect multiple GitHub and/or GitLab accounts per user
- Account selector when deploying — pick which account owns the repo
- Auto-detection: platform matches repo URL prefix to the correct account token

### 🔄 Auto-Deploy Webhooks
- `GET /api/deployments/:id/webhook-info` — returns the unique deployment webhook URL + HMAC secret
- DeployWebhookPanel.tsx component with tab UI for GitHub/GitLab setup instructions

### 📁 Git Push from File Manager
- `POST /api/fs/:id/git-commit-push` — Reads file content, builds GitHub API commit tree, creates a commit, and updates the branch reference
- Supports both GitHub and GitLab REST APIs
- Account auto-matching by repo URL prefix (e.g. `github.com/user/` maps to stored GitHub tokens)

---

## Phase 14 — Leaseweb VPS Reseller, Node Agent Enhancement, Status Page

### 🏢 Leaseweb VPS Reseller API
- `GET /api/leaseweb/vps` — list all ordered VPS instances
- `GET /api/leaseweb/vps/:id` — get VPS detail with bandwidth stats
- `POST /api/leaseweb/vps/:id/reinstall` — OS reinstall with image selection modal
- `POST /api/leaseweb/vps/:id/snapshot` — create named VPS snapshot
- `POST /api/leaseweb/vps/:id/restore/:snapshotId` — restore a snapshot
- `DELETE /api/leaseweb/vps/:id/snapshots/:snapshotId` — delete snapshot
- Power controls: start / stop / restart via Leaseweb API

### 🤖 Node Agent 1-Line Onboarding
- Rewrote `GET /api/nodes/install.sh` — self-contained bash script that installs Docker, probes hardware, self-registers, and starts the node-agent container
- SSH-based automated node connection from Admin UI (password or PEM key)

### 🌐 Public Platform Status Page
- New `/status` page — no authentication required
- Displays health for 6 components: API Gateway, Database Clusters, Traefik, VPS Edge Fleet, SMTP, Storage
- Incident history log with timestamps, auto-refreshes every 30 seconds

### 📹 LiveKit Moved to App Catalog
- Removed LiveKit from sidebar
- Created `templates/livekit.yaml` — LiveKit Server + Redis as 1-click catalog template

---

## Phase 13 — App Catalog Templates

### New Curated Templates
| Template | Stack |
|----------|-------|
| `redis.yaml` | Redis 7 with password auth |
| `n8n.yaml` | n8n + PostgreSQL 16 |
| `lavalink.yaml` | Lavalink 4.x audio node |
| `mongodb.yaml` | MongoDB 7 with root credentials |
| `wordpress.yaml` | WordPress + MariaDB 10.11 |

### Legacy Template Archival
- Moved all old/unsupported templates to `templates_removed_phase15/`

---

## Phase 12 — Monitoring, VPS Telemetry, SSH Terminal

### 🚨 Uptime & Synthetic Monitoring
- Multi-protocol synthetic checks: HTTP/HTTPS, TCP port, DNS, SSL certificate expiry
- Alert dispatch to Discord webhooks and customer email channels on state transitions

### 🖥️ VPS Monitoring & Terminal
- Real-time CPU, RAM, disk, and load-average collection via node agent stats endpoint
- In-browser WebSocket SSH terminal (xterm.js) for direct VPS/container access

### 📊 Dashboard Widgets
- Unified stats cards for active nodes, deployments, managed databases, and tickets
- Responsive dark-mode glassmorphism UI

---

## Reference Sources

All upstream open-source repositories that inspired platform features are in `references/`:

| Folder | Project | License |
|--------|---------|---------|
| `references/grafana-main/` | Grafana | AGPL-3.0 |
| `references/infisical-main/` | Infisical | MIT |
| `references/railpack-main/` | Railpack | MIT |
| `references/supabase-master/` | Supabase | Apache-2.0 |
| `references/uptime-kuma-master/` | Uptime Kuma | MIT |
| `references/vps-monitor-main/` | vps-monitor | MIT |
