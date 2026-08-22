# 📁 ShanuTechX — Project Structure

> Complete directory map of the ShanuTechX monorepo.

---

## Root Directory

```
shanutechx/
├── README.md                    # Main project documentation
├── LICENSE                      # MIT License
├── package.json                 # Root workspace package
├── .gitignore
├── .dockerignore
│
├── apps/                        # Main applications
├── services/                    # Infrastructure services (node agent)
├── packages/                    # Shared SDK libraries
├── templates/                   # App catalog YAML templates
├── templates_removed_phase15/   # Archived legacy templates
├── docker/                      # Docker infrastructure stacks
├── docs/                        # Documentation
├── references/                  # Upstream open-source reference repos
├── config/                      # Configuration files
├── infra/                       # Infrastructure scripts
├── tests/                       # Test suites
│
├── docker-compose.local.yml     # Local dev docker-compose
├── deploy-production.sh         # Production deployment script
├── deploy-to-production.sh      # Full deployment automation
├── setup-full-stack.cmd         # Windows full stack setup
├── start-dev.cmd                # Windows dev start
└── run-full-stack.cmd           # Windows full stack runner
```

---

## apps/

### apps/api/ — Express REST API

```
apps/api/
├── src/
│   ├── index.ts                 # Express app entry point
│   ├── middleware/
│   │   ├── auth.ts              # JWT authentication + role guards
│   │   ├── rateLimit.ts         # Rate limiting
│   │   └── validate.ts          # Zod request validation
│   ├── lib/
│   │   ├── secretsVault.ts      # AES-256-GCM encryption/decryption
│   │   ├── leasewebClient.ts    # Leaseweb VPS API client
│   │   ├── notifier.ts          # Discord + email notifications
│   │   └── db.ts                # Prisma client singleton
│   └── routes/
│       ├── auth.ts              # Login / register / JWT refresh
│       ├── deployments.ts       # App deployment CRUD + env update
│       ├── deployWebhooks.ts    # Auto-deploy webhook info endpoint
│       ├── filesystem.ts        # File manager proxy routes
│       │                        #   → list, read, write, mkdir, delete
│       │                        #   → upload-binary, extract, rename
│       │                        #   → git-commit-push
│       ├── gitConnect.ts        # GitHub/GitLab App OAuth + token storage
│       ├── nodes.ts             # Node agent management + install.sh
│       ├── catalog.ts           # App catalog templates
│       ├── databases.ts         # Managed DB provisioning
│       ├── leaseweb.ts          # Leaseweb VPS reseller API
│       ├── monitoring.ts        # Uptime synthetic monitoring
│       ├── status.ts            # Public platform status endpoint
│       ├── secrets.ts           # Secrets vault (Infisical-style)
│       ├── smtp.ts              # SMTP account management
│       ├── billing.ts           # Stripe billing + invoices
│       ├── tickets.ts           # Support tickets
│       ├── users.ts             # User management
│       ├── admin/               # Admin-only routes
│       └── settings.ts          # Platform settings
├── tsconfig.json
└── package.json
```

### apps/dashboard/ — Next.js 15 Customer Dashboard

```
apps/dashboard/
├── app/
│   ├── layout.tsx               # Root layout (fonts, providers)
│   ├── page.tsx                 # Landing / redirect
│   ├── status/
│   │   └── page.tsx             # Public platform status page (no auth)
│   └── (protected)/             # Auth-required pages
│       ├── deployments/
│       │   ├── page.tsx         # Deployment list + create new
│       │   └── [id]/
│       │       └── page.tsx     # Deployment detail (4 tabs):
│       │                        #   📊 Overview & Logs
│       │                        #   📁 File Manager & Git Push
│       │                        #   🔐 Environment Variables
│       │                        #   ⚡ Auto-Deploy Webhook
│       ├── vps/
│       │   └── page.tsx         # VPS management (Leaseweb)
│       ├── catalog/
│       │   └── page.tsx         # App catalog browser
│       ├── databases/
│       │   └── page.tsx         # Managed databases
│       ├── monitoring/
│       │   └── page.tsx         # Uptime monitors
│       ├── smtp/
│       │   └── page.tsx         # SMTP account management
│       ├── webmail/
│       │   └── page.tsx         # Gmail-style webmail
│       ├── secrets/
│       │   └── page.tsx         # Secrets vault
│       ├── billing/
│       │   └── page.tsx         # Billing & invoices
│       ├── tickets/
│       │   └── page.tsx         # Support tickets
│       ├── settings/
│       │   └── page.tsx         # Platform settings (password gated)
│       └── admin/
│           ├── nodes/page.tsx   # Node manager (connect/install)
│           ├── users/page.tsx   # User management
│           └── ...
│
├── components/
│   ├── ui.tsx                   # Shared UI components (Button, Card, Badge, Modal...)
│   ├── Sidebar.tsx              # Navigation sidebar
│   ├── FileManagerPanel.tsx     # Browser file manager + code editor
│   ├── EnvVarsPanel.tsx         # Encrypted environment variables UI
│   ├── DeployWebhookPanel.tsx   # Auto-deploy webhook setup UI
│   ├── DomainManagement.tsx     # Custom domain management
│   ├── EnvVarEditor.tsx         # Standalone env var editor widget
│   └── ...
│
├── lib/
│   ├── api.ts                   # Typed API client (all fetch bindings)
│   ├── logUtils.ts              # Log filtering and formatting utilities
│   ├── auth.ts                  # Auth helper functions
│   └── types.ts                 # Shared TypeScript types
│
├── public/                      # Static assets
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## services/node-agent/

```
services/node-agent/
├── .env                         # Agent runtime environment
├── .env.example                 # Reference env file
├── Dockerfile                   # Node agent container image
├── package.json
└── src/
    ├── index.js                 # Express server + all route handlers
    │   Routes:
    │   ├── POST /agent/deploy           # Full deploy (clone + build + run)
    │   ├── POST /agent/build            # Build Docker image (Railpack)
    │   ├── POST /agent/run              # Run container
    │   ├── GET  /agent/logs/:id         # Get container logs
    │   ├── GET  /agent/logs/stream/:id  # Stream container logs (SSE)
    │   ├── GET  /agent/stats/:id        # CPU/RAM/disk stats
    │   ├── POST /agent/stop/:id         # Stop container
    │   ├── POST /agent/start/:id        # Start container
    │   ├── POST /agent/restart/:id      # Restart container
    │   ├── DELETE /agent/remove/:id     # Stop + remove container
    │   │
    │   ├── GET  /agent/fs/:id/list      # List workspace directory
    │   ├── GET  /agent/fs/:id/read      # Read file content
    │   ├── PUT  /agent/fs/:id/write     # Write text file
    │   ├── POST /agent/fs/:id/upload-binary  # Write binary (base64)
    │   ├── POST /agent/fs/:id/extract   # Extract archive (zip/tar)
    │   ├── POST /agent/fs/:id/mkdir     # Create directory
    │   ├── DELETE /agent/fs/:id/delete  # Delete file/directory
    │   ├── POST /agent/fs/:id/rename    # Rename/move path
    │   │
    │   ├── POST /agent/domain/add       # Add Traefik reverse proxy route
    │   ├── POST /agent/domain/remove    # Remove Traefik route
    │   ├── POST /agent/db/provision     # Provision managed database container
    │   ├── POST /agent/livekit/add-key  # Add LiveKit API key
    │   └── GET  /agent/containers       # List all containers
    │
    ├── filesystem.js            # Jail-pathed file operations
    │   ├── listDir()
    │   ├── readFile()
    │   ├── writeFile()
    │   ├── writeBinaryFile()    # Base64 → binary write
    │   ├── extractArchive()     # zip/tar.gz/tgz/tar extraction
    │   ├── makeDir()
    │   ├── remove()
    │   └── rename()
    │
    ├── docker.js                # Docker container lifecycle
    ├── build.js                 # Railpack image builder
    ├── repo.js                  # Git workspace preparation
    ├── stats.js                 # Container resource stats
    ├── customDomain.js          # Traefik route management
    ├── managedDb.js             # DB container provisioning
    ├── livekit.js               # LiveKit key management
    └── projects.js              # Supabase-compatible project management
```

---

## templates/

```
templates/
├── redis.yaml           # Redis 7 — in-memory cache
├── n8n.yaml             # n8n + PostgreSQL 16 — workflow automation
├── lavalink.yaml        # Lavalink 4 — Discord audio node
├── mongodb.yaml         # MongoDB 7 — document database
├── wordpress.yaml       # WordPress + MariaDB 10.11 — CMS
└── livekit.yaml         # LiveKit Server + Redis — WebRTC platform
```

---

## packages/

```
packages/
├── db/
│   ├── schema.prisma        # Prisma data model
│   ├── migrations/          # Database migration files
│   └── seed.ts              # Database seeder
└── (SDK libraries)
```

---

## docker/

```
docker/
├── supabase/
│   └── docker-compose.yml   # Supabase self-hosted (Kong:8001, Studio:3003, PG:5435)
├── infisical/
│   └── docker-compose.yml   # Infisical vault (API:4004, PG:5434, Redis:6380)
└── docker-compose.shanutechx.yml  # Master compose file
```

---

## docs/

```
docs/
├── START_HERE.md              # Quick onboarding guide
├── LOCAL_SETUP_GUIDE.md       # Local development setup
├── DEPLOYMENT_GUIDE.md        # Production server deployment
├── PROJECT_STRUCTURE.md       # This file
├── NEW_FEATURES.md            # Feature changelog by phase
├── FULL_STACK_GUIDE.md        # Full stack architecture guide
├── QUICK_START.md             # 5-minute quick start
├── LOCAL_DEV_README.md        # Local dev environment details
├── LOCAL_TESTING_GUIDE.md     # Testing guide
├── PHASE15_PATCH_NOTES.md     # Phase 15 patch notes
├── DELIVERY_NOTES.md          # Feature delivery notes
└── audits/                    # Code audit reports
```

---

## references/

```
references/
├── grafana-main/          # Grafana dashboard (AGPL-3.0) — dashboard widgets inspiration
├── infisical-main/        # Infisical (MIT) — secrets vault inspiration
├── railpack-main/         # Railpack (MIT) — build engine
├── supabase-master/       # Supabase (Apache-2.0) — project management stack
├── uptime-kuma-master/    # Uptime Kuma (MIT) — monitoring & status page
└── vps-monitor-main/      # vps-monitor (MIT) — VPS telemetry
```

> These reference repositories are kept for development reference only. They are not used directly in the production build.
