# 🏗️ ShanuTechX Platform — Technology Stack & Reference Architecture Manual

> Complete architectural justification, technology selection guide, and upstream reference repository breakdown for the ShanuTechX autonomous cloud-hosting platform.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 📋 Table of Contents

- [1. Executive System Architecture Overview](#1-executive-system-architecture-overview)
- [2. Full Technology Stack & Architectural Rationale](#2-full-technology-stack--architectural-rationale)
  - [2.1 Backend Core & API Layer](#21-backend-core--api-layer)
  - [2.2 Frontend Control Panel & Storefront](#22-frontend-control-panel--storefront)
  - [2.3 Mobile Administration App](#23-mobile-administration-app)
  - [2.4 Database, Storage & Backup Infrastructure](#24-database-storage--backup-infrastructure)
  - [2.5 Mail Server & SMTP Infrastructure (WildDuck)](#25-mail-server--smtp-infrastructure-wildduck)
  - [2.6 Container Orchestration & Ingress (Traefik 3.x)](#26-container-orchestration--ingress-traefik-3x)
  - [2.7 Observability, Telemetry & Logging (Prometheus, Grafana, Loki)](#27-observability-telemetry--logging-prometheus-grafana-loki)
- [3. Upstream Reference Architectures Breakdown (references/)](#3-upstream-reference-architectures-breakdown-references)
- [4. Monorepo Package Design & Inter-Service Data Flow](#4-monorepo-package-design--inter-service-data-flow)

---

## 1. Executive System Architecture Overview

ShanuTechX is an enterprise-grade cloud-hosting platform and container orchestration engine built as a Node.js npm workspace monorepo. It manages the full lifecycle of compute nodes, application container deployments, managed database clusters, WebRTC video rooms, domain port exposures, and customer billing.

```text
                               ┌─────────────────────────────────────────┐
                               │           Traefik 3.x Ingress           │
                               │        (Port 80 / 443 + TLS 1.3)        │
                               └────────────────────┬────────────────────┘
                                                    │
             ┌──────────────────────────────────────┼──────────────────────────────────────┐
             ▼                                      ▼                                      ▼
┌──────────────────────────┐           ┌──────────────────────────┐           ┌──────────────────────────┐
│   apps/web (Port 3000)   │           │apps/dashboard (Port 3001)│           │   apps/api (Port 4000)   │
│ Next.js 14 Public Store  │           │  Next.js 14 Control UI   │           │ Express + Prisma 5.22 API│
└──────────────────────────┘           └──────────────────────────┘           └────────────┬─────────────┘
                                                                                           │
              ┌────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┐
              ▼                                                                            ▼                                  ▼
┌──────────────────────────┐                                                   ┌───────────────────────┐          ┌───────────────────────┐
│  services/node-agent     │                                                   │ PostgreSQL 16 & Redis │          │ WildDuck Mail Engine │
│  Container Engine Daemon │                                                   │  Primary DB & Queue   │          │ (MongoDB + IMAP/SMTP) │
└──────────────────────────┘                                                   └───────────────────────┘          └───────────────────────┘
```

---

## 2. Full Technology Stack & Architectural Rationale

### 2.1 Backend Core & API Layer

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **Node.js 20 LTS** | Runtime Environment | High-throughput asynchronous I/O, native EventLoop for non-blocking Server-Sent Events (SSE) build streaming, and unified JavaScript ecosystem across API, node agents, and workers. |
| **TypeScript 5.x** | Language | Compile-time type safety across shared monorepo packages (`@shanutechx/types`, `@shanutechx/client`), eliminating runtime type errors and object dereferencing bugs. |
| **Express.js** | Web Framework | Lightweight, modular HTTP router framework with minimal overhead, compatible with standard middleware chains (CORS, Rate Limit, Helmet, Pino HTTP). |
| **Prisma 5.22** | ORM & Migration Ledger | Strict relational data modeling with automatic SQL migration generation, typed queries, foreign key integrity protection, and client generation. |
| **BullMQ & Redis 7** | Async Background Queues | Offloads long-running tasks (daily subscription billing sweeps, payment OCR verification, uptime polling) from Express HTTP request threads to guarantee sub-50ms API response latency. |
| **Pino & Pino-HTTP** | Structured Logging | Fast JSON structured logging with field redaction (`Authorization`, `x-agent-secret`, secret tokens) ensuring zero cleartext secret leaks in logs. |
| **AES-256-GCM** | Vault Cryptography | Authenticated encryption with SHA-256 key derivation in [`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts) protecting stored credentials against tampering. |

---

### 2.2 Frontend Control Panel & Storefront

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **Next.js 14 App Router** | Full-Stack Web Framework | React Server Components (RSC), standalone Docker bundling, streaming SSR, and file-based route resolution for both marketing storefront (`apps/web`) and control panel studio (`apps/dashboard`). |
| **Tailwind CSS** | Styling System | Utility-first responsive styling with custom glassmorphism design tokens (`glass`, `bg-brand-gradient`, glowing borders) ensuring modern aesthetic. |
| **Firebase OAuth SSO** | Auth Client | Enforces Single Sign-On (SSO) exclusively via Google, GitHub, and Discord OAuth identities, eliminating direct password input forms and reducing authentication security risks. |
| **xterm.js & WebSockets** | SSH Terminal UI | Interactive in-browser PTY terminal emulator supporting real-time container log streaming and shell access. |

---

### 2.3 Mobile Administration App

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **Expo SDK 51 / React Native** | Cross-Platform Framework | Single codebase compiling native Android (`.apk`/`.aab`) and iOS applications for mobile staff control. |
| **Isolated Workspace** | Dependency Isolation | Excluded from the root npm workspace (`!apps/mobile-admin`) to preserve exact React 18.2 / Expo SDK version pinning without monorepo hoisting conflicts. |

---

### 2.4 Database, Storage & Backup Infrastructure

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **PostgreSQL 16** | Relational Database | Enterprise ACID relational store holding platform users, orders, subscriptions, nodes, deployments, and audit logs. |
| **Cloudflare R2** | Backup Object Storage | S3-compatible object storage with zero egress fees, used by [`r2Storage.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/r2Storage.ts) for automated daily gzipped database snapshot backups. |
| **Self-Hosted Supabase** | Managed BaaS Stack | Bundles GoTrue auth, PostgREST, Realtime WebSockets, Storage, and Studio interface (`http://localhost:3003`) into a single managed stack. |

---

### 2.5 Mail Server & SMTP Infrastructure (WildDuck)

> **Important Architecture Decision**: ShanuTechX uses **WildDuck Mail Server** (`wildduck-api`, `wildduck-engine`, `wildduck-imap`, `haraka-app`) — **NOT** Postal Mail.

| Technology | Component | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **WildDuck Engine** | `wildduck/wildduck:latest` | High-scalability IMAP/POP3 mail server written in Node.js. Stores all messages, mailboxes, and attachments in **MongoDB** with zero local disk dependency (No Single Point of Failure). |
| **MongoDB 7** | `shanutechx-wildduck-mongo` | Document database providing replicated, sharded mailbox persistence for WildDuck. |
| **Haraka SMTP** | `wildduck/haraka-app:latest` | High-throughput inbound SMTP server receiving external internet mail into WildDuck filters. |
| **WildDuck API** | `wildduck/wildduck-api:latest` | RESTful management API (`http://mail-api.${ROOT_DOMAIN}`) wrapped by [`apps/api/src/lib/wildduckClient.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/wildduckClient.ts) for provisioning customer mailboxes and domain aliases. |

---

### 2.6 Container Orchestration & Ingress (Traefik 3.x)

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **Traefik 3.x** | Edge Reverse Proxy & Ingress | Auto-discovers container routes via Docker labels (`traefik.enable=true`, `Host(...)`), issuing and renewing **Let's Encrypt TLS certificates** dynamically without restarting services. |
| **Dockerode** | Docker API SDK | Programmatic control of Docker containers, image building, volume mounting, and cgroup stats collection on host compute nodes. |

---

### 2.7 Observability, Telemetry & Logging (Prometheus, Grafana, Loki)

| Technology | Role / Version | Architectural Rationale (WHY Chosen) |
| :--- | :--- | :--- |
| **Prometheus v2.53** | Metrics Collector | Scrapes `/metrics` from API, `node-exporter:9100` (host hardware stats), and `cadvisor:8080` (container cgroups) every 15s. |
| **Grafana 11** | Monitoring Dashboards | Visualizes real-time CPU/RAM utilization, P95/P99 request latency, throughput RPS, and active deployment metrics. |
| **Loki 3.1 & Promtail 3.1** | Container Log Aggregator | Collects stdout/stderr container logs from `/var/lib/docker/containers/*/*.log` and indexes them by container label for instant LogQL querying. |
| **Uptime Kuma** | Synthetic Health Probes | Multi-protocol synthetic checks (HTTP/TCP/DNS/SSL) with webhook dispatch to Discord and WhatsApp. |

---

## 3. Upstream Reference Architectures Breakdown (`references/`)

ShanuTechX incorporates patterns and design principles from 6 open-source reference projects stored in [`references/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/references):

```text
references/
├── supabase-master/       # Managed BaaS stack, Schema-driven REST & Studio UI
├── uptime-kuma-master/    # Synthetic monitoring, multi-protocol probes & status page
├── infisical-main/        # AES-256-GCM secret key vault & SHA-256 key derivation
├── railpack-main/         # Zero-downtime container builds via BuildKit
├── grafana-main/          # Observability dashboard widgets & PromQL metrics
└── vps-monitor-main/      # Leaseweb bare-metal VPS API integration
```

1. **`references/supabase-master`**: Inspired the Self-Hosted Supabase Dev Studio hub, providing schema-driven PostgREST APIs, GoTrue OAuth token verification, and visual database table editing.
2. **`references/uptime-kuma-master`**: Inspired synthetic health probing, multi-protocol check execution (HTTP/TCP/DNS/SSL), and public status page telemetry.
3. **`references/infisical-main`**: Inspired the Secrets Vault architecture ([`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)), incorporating AES-256-GCM authenticated encryption and secret key rotation.
4. **`references/railpack-main`**: Inspired zero-downtime container image building via BuildKit sidecar and automated Dockerfile framework detection.
5. **`references/grafana-main`**: Inspired the embedded cluster telemetry panels and PromQL metrics aggregation.
6. **`references/vps-monitor-main`**: Inspired the Leaseweb bare-metal VPS reseller API wrapper ([`leasewebClient.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/leasewebClient.ts)).

---

## 4. Monorepo Package Design & Inter-Service Data Flow

The monorepo shares TypeScript definitions and SDK modules across 14 packages in `packages/`:

```text
packages/
├── db/              # Prisma 5.22 schema, database migrations & seeding
├── client/          # @shanutechx/client Developer REST API TypeScript SDK
├── catalog/         # 15+ Docker Compose application catalog manager
├── deployments/     # Shared deployment type definitions & build engine helpers
├── node-agent/      # @shanutechx/node-agent RPC client interfaces
├── auth/            # Auth middleware SDK helpers
├── types/           # Core shared platform TypeScript type definitions
├── tracing/         # OpenTelemetry tracing wrappers
└── supabase-js/     # Supabase Client SDK Suite (auth-js, functions-js, postgrest-js, realtime-js, storage-js)
```

### Inter-Service Communication Flow
1. **User Action**: Client triggers an action in Next.js Dashboard ([`apps/dashboard`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard)).
2. **API Authentication**: Express REST API ([`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api)) validates Firebase OAuth Bearer token via `requireAuth`.
3. **Database Transaction**: API executes atomic query with PostgreSQL via Prisma ORM (`packages/db`).
4. **Queue Offloading**: Background jobs are dispatched to Redis 7 and processed by BullMQ worker ([`apps/api/src/worker.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/worker.ts)).
5. **Node Provisioning**: API dispatches authenticated RPC request over internal Docker network to Node Agent ([`services/node-agent`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent)).
6. **Dynamic Routing**: Node Agent attaches Traefik labels to the container, and Traefik 3.x provisions Let's Encrypt TLS certificates dynamically.
7. **Telemetry & Alerts**: Prometheus scrapes metrics, Loki ingests container logs, and bot services ([`services/discord-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/discord-bot), [`services/whatsapp-bot`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/whatsapp-bot)) dispatch alerts.
