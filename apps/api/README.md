# ⚡ ShanuTechX Core REST API (`apps/api`)

The primary Express REST API backend and BullMQ background worker service for the ShanuTechX platform.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 🚀 Key Responsibilities & Capabilities

- **Platform Business Logic**: Source of truth for orders, billing, products, users, tickets, secrets, and node orchestration.
- **Prisma 5.22 ORM & PostgreSQL 16**: Relational database operations backing all entities.
- **BullMQ Background Worker ([`src/worker.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/worker.ts))**: Repeatable cron tasks for daily subscription billing sweeps and 5-minute node uptime checks.
- **Secrets Vault ([`src/lib/secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts))**: AES-256-GCM secret encryption with SHA-256 key derivation.
- **Cloudflare R2 Storage ([`src/lib/r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts))**: Database backup archiving and snapshot restoration.
- **WebSockets SSH Gateway ([`src/lib/sshTerminalGateway.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/sshTerminalGateway.ts))**: Real-time terminal access to nodes/containers.

---

## 📂 Codebase Structure

```text
apps/api/
├── src/
│   ├── index.ts                 # Express REST API server entrypoint
│   ├── worker.ts                # BullMQ repeatable background worker
│   ├── env.ts                   # Environment variable validator (throws at startup if missing)
│   ├── lib/
│   │   ├── db.ts                # PrismaClient singleton instance
│   │   ├── secretsVault.ts      # AES-256-GCM authenticated encryption/decryption
│   │   ├── r2Storage.ts         # Cloudflare R2 backup & restore manager
│   │   ├── sshTerminalGateway.ts# WebSockets SSH terminal gateway with xterm.js
│   │   ├── abuseDetector.ts     # Instant fraud & abuse teardown pipeline
│   │   ├── billing.ts           # Daily subscription billing and container suspension logic
│   │   ├── leasewebClient.ts    # Bare-metal Leaseweb VPS API client
│   │   ├── livekit.ts           # WebRTC room key generator & node registration
│   │   └── smtpProvisioner.ts   # Postal mail organization and mailbox provisioner
│   ├── middleware/
│   │   ├── auth.ts              # Firebase OAuth token authentication middleware
│   │   ├── rbac.ts              # Customer / Support / Admin / Dev RBAC ownership checks
│   │   └── validate.ts          # Zod schema request validation
│   └── routes/                  # Modular REST API endpoints (nodes, deployments, vps, billing, etc.)
├── Dockerfile                   # Multi-stage production container image
├── package.json
└── tsconfig.json
```

---

## 🛠️ Commands & Scripts

- **Development Server:** `npm run dev:api` (port `4000`)
- **Background Worker:** `npm run dev:worker`
- **TypeScript Check:** `npx tsc --noEmit --project apps/api/tsconfig.json`
- **Run Unit Tests:** `npm run test:unit`
