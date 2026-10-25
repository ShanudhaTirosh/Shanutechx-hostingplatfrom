# ShanuTechX Platform — Complete Features & Architecture Specification

**ShanuTechX** is an autonomous enterprise cloud-hosting platform and container orchestration engine built as a modular npm workspace monorepo. It features an **Apple Human Interface Guidelines (HIG)-inspired Monochrome Liquid Glass UI (`#0A0A0A`, `#FFFFFF`)**, **Firebase OAuth SSO**, a **High-Performance Express & Prisma REST API**, an **Autonomous Compute Node & Port Exposure Engine**, a **Self-Hosted Supabase Stacks Hub**, an **Interactive WebSockets SSH Terminal**, and an **Autonomous Business Webmail Client**.

---

## 📑 Table of Contents

1. [UI/UX & Strict Monochrome Design Architecture (`#0A0A0A` / `#FFFFFF`)](#1-uiux--strict-monochrome-design-architecture-0a0a0a--ffffff)
2. [Node.js 22 LTS Modernization & Runtime Specification](#2-nodejs-22-lts-modernization--runtime-specification)
3. [Authentication, Identity & Security Standards](#3-authentication-identity--security-standards)
4. [Customer Dashboard (`apps/dashboard` - `/dashboard`)](#4-customer-dashboard-appsdashboard---dashboard)
5. [Admin Control Center (`apps/dashboard` - `/admin`)](#5-admin-control-center-appsdashboard---admin)
6. [Dev Superuser Studio & Infrastructure Hub (`apps/dashboard` - `/dev`)](#6-dev-superuser-studio--infrastructure-hub-appsdashboard---dev)
7. [Enterprise Webmail Client (`apps/webmail`)](#7-enterprise-webmail-client-appswebmail)
8. [Node Engine & Per-VPS Agent Daemon (`services/node-agent`)](#8-node-engine--per-vps-agent-daemon-servicesnode-agent)
9. [Automated Provisioning, Vault & Storage Services](#9-automated-provisioning-vault--storage-services)
10. [Autonomous Messaging & Gateway Bots](#10-autonomous-messaging--gateway-bots)
11. [Public Web Storefront & AI Bot Discovery (`apps/web`)](#11-public-web-storefront--ai-bot-discovery-appsweb)
12. [Summary Table of Monorepo Components & Capabilities](#12-summary-table-of-monorepo-components--capabilities)

---

## 1. UI/UX & Strict Monochrome Design Architecture (`#0A0A0A` / `#FFFFFF`)

Inspired by Apple Human Interface Guidelines and enterprise cloud control planes, the platform enforces a strict, distraction-free monochromatic glassmorphic palette:

- **Primary Background**: `#0A0A0A` OLED deep obsidian dark.
- **Surface Elevation Layers**:
  - Base Surfaces: `#121212` / `#141414` subtle charcoal with `1px solid rgba(255, 255, 255, 0.08)` borders.
  - Secondary Elevated Cards: `#1E1E1E` / `#262626` hover states.
- **Primary Action Buttons**: Solid, high-contrast pure white buttons with bold deep-black text (`bg-white text-[#0A0A0A] font-semibold hover:bg-neutral-200 active:scale-95`).
- **Secondary Action Buttons**: Dark glass buttons with subtle light borders (`bg-white/5 border border-white/10 text-white hover:bg-white/10`).
- **Sidebar & Navigation**:
  - Dark obsidian sidebar (`bg-[#0A0A0A]` with `border-r border-white/5`).
  - Active navigation pill: Translucent glass highlight (`rgba(255, 255, 255, 0.08)`) with a crisp solid white left accent bar and pure white text.
- **High-Contrast Typography**:
  - Primary Headers & Values: `#FFFFFF` stark white.
  - Subtitles & Labels: `#A1A1AA` / `#737373` muted light-neutral gray.
- **Semantic Indicators (Crisp Accent Badges)**:
  - **Online / Running**: Emerald Green (`#10B981` / `rgba(16, 185, 129, 0.10)`).
  - **Offline / Terminated**: Crimson Red (`#EF4444` / `rgba(239, 68, 68, 0.10)`).
  - **Degraded / Warning**: Amber Yellow (`#F59E0B` / `rgba(245, 158, 11, 0.10)`).
  - **Neutral / Metric Count**: Monochrome Light (`#FFFFFF` / `rgba(255, 255, 255, 0.06)`).
- **Ambient Lighting**: Delicate monochromatic white ambient glass orbs (`rgba(255, 255, 255, 0.02) blur-[120px]`), banning saturated rainbow gradients.

---

## 2. Node.js 22 LTS Modernization & Runtime Specification

Applied and validated via `shanutechx-node22.patch`:

- **Node.js 22 LTS Requirement**: Enforced across CI pipelines, Docker container bases, and setup documentation.
- **Container Base Images Modernization**:
  - `apps/api/Dockerfile`: Updated builder to `node:22-alpine` and pinned runtime runner to `node:22-bookworm-slim` (matching Prisma's `debian-openssl-3.0.x` binary targets).
  - `apps/dashboard/Dockerfile`: Updated to `node:22-alpine` deps and runner.
  - `apps/web/Dockerfile`: Updated to `node:22-alpine` deps and runner.
  - `services/discord-bot/Dockerfile`: Updated to `node:22-alpine`.
  - `services/whatsapp-bot/Dockerfile`: Updated to `node:22-alpine`.
  - `services/node-agent/Dockerfile`: Updated to `node:22-bookworm-slim` for Docker CLI and Railpack tooling compatibility.
- **CI / CD GitHub Workflows**:
  - `.github/workflows/ci.yml`: Enforces `node-version: 22`.
  - `.github/workflows/publish-sdk.yml`: Enforces `node-version: 22`.
- **Automated Verification Test Suite**:
  - `tests/unit/nodeVersion.test.ts`: Automated test suite asserting all Dockerfiles, CI workflows, and documentation reference Node 22+.

---

## 3. Authentication, Identity & Security Standards

- **Firebase OAuth Single Sign-On (SSO)**:
  - Exclusively uses Google, GitHub, and Discord OAuth identities.
  - Insecure direct email/password input forms are disabled across client portals.
  - Automated user account provisioning and role sync upon OAuth login.
- **Role-Based Access Control (RBAC)**:
  - `customer`: Access to personal instances, deployments, databases, webmail, and invoices.
  - `support`: Access to customer support desk, ticket replies, and diagnostic telemetry.
  - `admin`: Order approvals, staff management, and billing operations.
  - `dev`: Unrestricted superuser access to the entire platform, compute fleet, and database clusters.
- **AES-256-GCM Secrets Vault**:
  - End-to-end encryption for API keys, SSH private keys, S3 storage secrets, and database credentials.
- **Enterprise Security Compliance**:
  - RFC 9116 `security.txt` and RFC 8461 `mta-sts.txt` transport security standards.
  - Anti-tamper right-click protector with dev-mode bypass switch.

---

## 4. Customer Dashboard (`apps/dashboard` - `/dashboard`)

- **Resource Overview**:
  - Live summary of active cloud deployments, VPS servers, database instances, and open support tickets.
- **Autonomous Web & App Deployments**:
  - Git repository connection (GitHub / GitLab / custom Git URLs).
  - Real-time build logs streaming via Server-Sent Events (SSE).
  - One-click rollback and deployment history.
  - Custom domain attachment with automated SSL certificate provisioning.
- **Managed Databases Hub**:
  - Instant provisioning of PostgreSQL 16, MySQL 8, Redis 7, and MongoDB 7.
  - One-click connection string copy and environment variable injection.
- **Interactive WebSockets SSH Terminal**:
  - Embedded browser terminal (`xterm.js` + fit addon) connecting directly to provisioned instances via the platform SSH gateway.
- **File Manager**:
  - Web-based file browser, code editor, file uploader, and permission manager.
- **Billing, Invoices & Orders**:
  - Invoice history with one-click PDF generation.
  - Bank slip payment proof upload for manual review.
- **Support Desk**:
  - Real-time ticket thread system with markdown support and attachment uploads.

---

## 5. Admin Control Center (`apps/dashboard` - `/admin`)

- **Payment Review Queue**:
  - Inspect customer-uploaded payment proofs and bank transfer slips.
  - 1-Click order approval triggering automated container & service provisioning.
  - Rejection workflow with customer notification dispatch.
- **Customer Directory**:
  - Comprehensive customer database with lifetime spend, assigned staff, and account status.
  - Superuser account impersonation banner to assist users in real-time.
- **Product & Plan Catalog Management**:
  - Create and configure hosting plans, resource limits (CPU, RAM, Disk, Bandwidth), and billing cycles.
- **Staff Delegation & Workload**:
  - Assign tickets and customer accounts to support staff members.
- **Platform Audit Ledger**:
  - Searchable log of administrative actions, role modifications, and critical system events.

---

## 6. Dev Superuser Studio & Infrastructure Hub (`apps/dashboard` - `/dev`)

- **Global VPS Fleet Orchestrator**:
  - Manage all VPS compute host nodes across datacenters.
  - Per-node bandwidth tracking against 30 TB quotas.
  - Automated Cloudflare DNS A-record registration (`node-<label>.<rootDomain>`) pointing to host IPs.
- **Unified Self-Hosted Supabase Stacks Hub**:
  - One-click provisioning of dedicated Supabase stacks per VPS node.
  - Automated setup of PostgreSQL database, GoTrue Auth, PostgREST API, S3-compatible Storage, and Deno Edge Functions.
  - Direct "Launch Studio" button opening the Supabase Studio UI (`http://<nodeIp>:<studioPort>`) in a new browser tab.
  - Live Supabase project observability (CPU %, RAM MB, active DB connections, cache hit ratio).
- **Node Port Exposure Engine**:
  - Expose any port on any registered compute node to a custom or automatic platform subdomain.
  - Automated Cloudflare DNS record tracking, certificate management, and Traefik reverse proxy configuration.
- **One-Click App Catalog**:
  - Instant deployment of 15+ Docker Compose application templates (WordPress, Ghost, N8N, Nextcloud, Uptime Kuma, Plausible, etc.).
- **Live Container Manager**:
  - Direct Docker socket inspection across compute nodes: restart, stop, kill, inspect logs, and view open ports.
- **Automated Dunning & Billing Engine**:
  - Daily cron sweeps for expired subscriptions, container suspension, and grace-period reminders.
- **Cloudflare R2 Backup Integration**:
  - Automated snapshot creation, database dumps, and S3-compatible cold storage offloading.
- **Observability & Log Search**:
  - Integrated LogQL log query interface and Grafana PromQL performance metrics.

---

## 7. Enterprise Webmail Client (`apps/webmail`)

- **Full-Featured Mailbox Client**:
  - Unified Inbox, Starred, Snoozed, Sent, Drafts, Archive, Spam, and Trash.
  - Custom folder creation, tag management, and search indexing.
- **Multi-Mailbox Account Switcher**:
  - Instant switching between multiple business email addresses with token caching.
- **Rich Composer**:
  - Rich text formatting, CC/BCC headers, scheduled sending, and file attachment handling.
- **Background Mailbox Worker**:
  - Scheduled drafts sweep, due snoozed message restore, and quota checks.
- **Mail Host Node & Storage Administration**:
  - WildDuck mail server integration, DKIM/SPF/DMARC record generator, and S3 attachment offloading.

---

## 8. Node Engine & Per-VPS Agent Daemon (`services/node-agent`)

- **Host Telemetry Agent**:
  - Real-time CPU, memory, disk, network I/O, and load average telemetry.
- **Docker Daemon Engine**:
  - Remote container creation, network bridging, volume management, and image caching.
- **Remote Filesystem Operations**:
  - Safe path-jailed file reading, streaming writing, chmod, chown, and directory traversal.
- **Automated Host Node Discovery**:
  - Automatic hardware spec detection and Cloudflare DNS pairing upon registration.

---

## 9. Automated Provisioning, Vault & Storage Services

- **Instant Service Provisioning**:
  - Container spin-up upon payment confirmation.
  - Git webhook registration (`deployWebhookSecret`).
  - Automated LiveKit video room key generation.
  - Automated business email inbox creation on WildDuck nodes.
- **Cloudflare R2 Cloud Storage**:
  - S3-compatible object storage with presigned upload URLs.
- **Encrypted Vault**:
  - Envelope encryption with key rotation capabilities for customer and node credentials.

---

## 10. Autonomous Messaging & Gateway Bots

- **Discord Bot Daemon (`services/discord-bot`)**:
  - Automated alerts for new customer orders, payment slips uploaded, and container failures.
  - Support ticket channel synchronization and customer notification webhooks.
- **WhatsApp Baileys Gateway (`services/whatsapp-bot`)**:
  - Automated customer WhatsApp messaging for order activations, overdue invoice alerts, and 2FA recovery.

---

## 11. Public Web Storefront & AI Bot Discovery (`apps/web`)

- **High-Performance Public Portal**:
  - Modern Next.js 14 App Router storefront with interactive service pricing calculator.
- **SEO & Search Standards**:
  - Dynamic canonical `sitemap.xml` covering 20 platform routes.
  - RFC 9116 `security.txt` and RFC 8461 `mta-sts.txt` mail transport security.
  - `humans.txt` team and architecture credits.
- **AI Crawler & LLM Ingestion Feeds**:
  - `llms.txt` and `llms-full.txt` standard specification feeds for automated AI discovery.
  - Granular `robots.txt` safely enabling AI crawlers (GPTBot, ClaudeBot, PerplexityBot) on public documentation while protecting control panels.

---

## 12. Summary Table of Monorepo Components & Capabilities

| Subsystem | Tech Stack | Primary Capabilities | Port / Runtime |
| :--- | :--- | :--- | :--- |
| **API** (`apps/api`) | Express, TypeScript, Prisma 5.22, PostgreSQL 16, Redis 7 | Auth, Billing, Provisioning, Orchestration, SSH Terminal Gateway | Port 4000 (Node 22) |
| **Dashboard** (`apps/dashboard`) | Next.js 14 App Router, TailwindCSS, Monaco, xterm.js | Customer, Admin, Dev Superuser, Support Paneling in Strict Monochrome UI | Port 3001 (Node 22) |
| **Webmail** (`apps/webmail`) | Next.js 14 App Router, TailwindCSS, Lucide | Enterprise Business Email, Mailbox Switcher, Rich Composer | Port 3002 (Node 22) |
| **Web Storefront** (`apps/web`) | Next.js 14 App Router, TailwindCSS | Public Storefront, Pricing, Documentation, LLM & SEO Endpoints | Port 3000 (Node 22) |
| **Mobile Admin** (`apps/mobile-admin`) | Expo, React Native, TypeScript | Standalone iOS & Android Admin Companion App | React Native |
| **Node Agent** (`services/node-agent`) | Node.js, Docker CLI, Railpack | Host Telemetry, Container Lifecycle, Jailed File System RPC | Per-Host Daemon |
| **Discord Bot** (`services/discord-bot`) | Discord.js, Node.js | Alerts, Ticket Notifications, Order Review Channel Feeds | Daemon Process |
| **WhatsApp Gateway** (`services/whatsapp-bot`) | Baileys, Node.js | WhatsApp Customer Order & Renewal Alerts | Daemon Process |
| **Database Package** (`packages/db`) | Prisma 5.22, PostgreSQL 16 | Relational Schema & Migration Ledger | Shared Package |
| **SDK Client** (`packages/client`) | TypeScript | `@shanutechx/client` Developer REST API Client | Published SDK |
