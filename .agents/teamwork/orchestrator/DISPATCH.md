## 2026-10-28T13:24:57Z

Research, audit, repair, complete, integrate, and production-harden the existing self-hostable cloud platform using the repository as the source of truth, making every implemented feature genuinely functional, tested, secure, and connected to its real infrastructure backend.

Integrity mode: development

## Requirements

### R1. Repository Audit and Technology Research
Conduct a thorough investigation of the existing repository structure, frameworks, APIs, migrations, containers, and deployment scripts to establish an operational baseline. Research official documentation and upstream repositories for supported integration methods (Docker Engine API, self-hosted Supabase stack, managed databases, Nixpacks/buildpacks, Git workflows, reverse proxy, SMTP, and VPS management), and produce an architecture and research report.

### R2. Container Management and Build System
Complete container management through the real Docker Engine API (lifecycle, streaming logs, health, resource monitoring, networks, persistent volumes, Docker Compose stacks) with proper security isolation preventing raw Docker socket exposure. Implement a pluggable build pipeline supporting framework detection, Dockerfile builds, and buildpack/Nixpacks-compatible builds with secure secret handling and build logging.

### R3. Self-Hosted Supabase and Managed Database Platform (Developer Users)
Implement complete lifecycle management for deploying and running multiple independent, isolated self-hosted Supabase projects (PostgreSQL, GoTrue/Auth, PostgREST, Realtime, Storage, Kong, Studio, connection pooling) specifically tailored for developer users, with dedicated credentials, routing, backups, and verification. Build a provider-adapter architecture for managed database engines (PostgreSQL, MySQL, MariaDB, Redis, and MongoDB) for developer users, supporting provisioning, secure credentials, persistent storage, metrics, backups, and restore operations.

### R4. Application Deployment and Service Catalog
Complete the application deployment system to deploy applications from Git repositories (GitHub authorization, commits/branches, env vars, build/start commands, webhooks, deployment history, rollbacks) and a functional application/infrastructure service catalog where catalog installations provision real resources, launch services, and verify health.

### R5. Remote Infrastructure, Email, Networking, and Security Hardening
Complete reverse proxy routing and automatic TLS management (Traefik or existing proxy) with custom domain support. Implement VPS and remote server management adapters for real server registration, health, and target assignment against actual infrastructure APIs, without mocked or simulated responses. Complete SMTP/email infrastructure with support for WildDuck or compatible real delivery services. Enforce multi-tenant isolation, RBAC, tenant ownership checks, input validation, audit logging, and ensure no secrets or infrastructure credentials leak to browsers, git, or build logs.

## Acceptance Criteria

### Platform Build and Core Integrity
- [ ] The existing application builds successfully without type errors, lint failures, or broken migrations.
- [ ] Authentication, tenant isolation, and project ownership checks are enforced on all server actions and API routes.
- [ ] Existing working features remain intact and functional.

### Deployment and Infrastructure Management
- [ ] Repository deployments successfully build and launch real applications from configured Git sources.
- [ ] Service catalog entries install and provision actual running, healthy services on the target infrastructure.
- [ ] Container management operations (start, stop, restart, inspect, logs, resource monitoring) operate against real containers via the Docker Engine API.

### Supabase and Database Services (Developer Users)
- [ ] Multiple independent self-hosted Supabase projects can be provisioned and operated for developer users with full credential and network isolation.
- [ ] Provisioned Supabase services (PostgreSQL, Auth, PostgREST, Realtime, Storage, Studio) pass health and functionality checks.
- [ ] Supported managed database instances (PostgreSQL, MySQL, MariaDB, Redis) can be provisioned, connected to, queried, backed up, and restored for developer users.

### Networking, Reliability, Operations, and Real Verification
- [ ] All integrations, APIs, and infrastructure operations connect to real backends and actual services; no mocked, stubbed, or simulated responses are used in production or verification paths.
- [ ] Reverse proxy routing, custom domains, and TLS certificate generation function in the target environment.
- [ ] Logs, health metrics, and deployment statuses reflect actual system state rather than simulated or placeholder data.
- [ ] Long-running background jobs track progress, handle failures gracefully, and survive platform restarts.
- [ ] No secrets, database passwords, or host infrastructure tokens leak to the frontend, logs, or unauthorized projects.
- [ ] Automated static, unit, and integration tests pass for all completed features against real backends.
- [ ] Accurate operational documentation, environment configuration guides, and a list of verified vs. blocked features are provided.
