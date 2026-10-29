# ShanuTechX Platform — Production Readiness & Integrity Standards

## Executive Overview
This document defines the production verification criteria, security boundaries, runtime standards, and operational readiness checklist for the ShanuTechX cloud platform. All deployments must adhere to these requirements prior to processing production workloads.

---

## 1. Runtime & Environment Standardization

### Node.js 22 LTS Standard
- **Baseline Requirement**: All Docker containers, host agents, and CI pipelines must standardize on Node.js >= 22 (Debian Bookworm base `node:22-bookworm-slim` for binary compatibility with OpenSSL 3.0 and Prisma `debian-openssl-3.0.x`).
- **Host Installation**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- **EOL Deprecation**: Node.js 20 reached End-of-Life on 2026-04-30. Vendored Supabase SDKs and modern crypto libraries require Node >= 22.

---

## 2. Security & Multi-Tenant Isolation Audit

### Tenant Scoping & Resource Ownership
- Every API endpoint mutating or querying user resources must enforce `canAccessResource(ownerId, req, projectId, teamId, action)`.
- Cross-tenant requests to resources owned by another user must return HTTP `404 Not Found` rather than `403 Forbidden` to prevent resource ID enumeration.

### Role-Based Access Control (RBAC) Integrity
- **Role Hierarchy**: `customer`, `support`, `admin`, `dev`.
- **Strict Role Boundaries**:
  - `requireDev` strictly enforces `req.user?.role === 'dev'`. Admin and customer users are rejected with HTTP 403 on internal dev endpoints.
  - `requireAdmin` requires `req.user?.role === 'admin' || req.user?.role === 'dev'`.
  - `requireAdminOrDev` allows either administrator or developer access to shared infrastructure surfaces (nodes, managed databases, templates).
  - Mailbox ACL (`canAccessMailbox`) verifies specific granular permissions (`read`, `write`, `manage`) rather than blanket blocking administrator roles.

### Docker Socket & Host Isolation
- Tenant containers must NEVER mount `/var/run/docker.sock`.
- All Compose YAML files deployed by users or catalog templates undergo AST security analysis (`validateComposeSecurity`), rejecting:
  - Root directory host mounts (`/`, `/etc`, `/root`, `/var/run`)
  - `privileged: true`
  - Dangerous capabilities (`CAP_SYS_ADMIN`, `CAP_NET_ADMIN`)
  - Host network mode (`network_mode: host`)

### Secrets Vault & Token Protection
- Master database passwords, Git tokens, and VPS private keys are encrypted at rest using AES-256-GCM via `secretsVault.ts`.
- Build pipelines must never pass runtime secrets via Docker `--build-arg`, which persists secrets in Docker image layer history.

---

## 3. Zero-Mock Policy & Real Backend Connectivity

In production and automated integration verification:
- No mocked, simulated, or stubbed responses are allowed in operational paths.
- Docker operations must execute against real containers via the Docker Engine API (`dockerode`).
- Database metrics must reflect genuine container cgroup CPU and memory telemetry rather than synthetic numbers.
- Supabase services (Kong, Auth, PostgREST, Storage, Studio) must report genuine HTTP/TCP ping statuses.

---

## 4. Production Readiness Checklist

| Category | Verification Item | Required State | Status |
|---|---|---|---|
| **Runtimes** | Node.js Version | Node.js >= 22 LTS across host, Dockerfiles, and CI | Verified (`setup_22.x`) |
| **Monorepo** | Package SDK Builds | `npm run build:sdk` passes without type errors | Verified |
| **Database** | Prisma Migrations | All 27 migrations applied cleanly via `prisma migrate deploy` | Verified |
| **Security** | Role Guards | `requireDev` isolates dev endpoints; Mailbox ACL allows granular admin permissions | Verified |
| **Security** | Secret Redaction | Secrets masked in logs, AES-256-GCM vault active | Verified |
| **Networking** | Traefik Reverse Proxy | Traefik 3.x automatic TLS certificates issued | Verified |
| **Worker** | BullMQ Processor | Background worker container running `dist/worker.js` | Verified |
| **Testing** | Automated Test Suites | 100% Unit and Integration tests passing | Verified |
