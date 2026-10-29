# BRIEFING — 2026-10-28T15:14:00Z

## Mission
Specification and technical design for Feature 7: Docker Persistent Volume Provisioning across API and Node-Agent.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Specification Mining, Technical Design, API Contract Definition
- Working directory: c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_spec_miner_m2_1
- Original parent: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6
- Milestone: Milestone 2: Container Management & Build System

## 🔒 Key Constraints
- Do NOT implement code directly — read-only specification miner role.
- All code/design specifications must adhere strictly to existing architecture and project guidelines.
- Output artifacts must be located in assigned folder: `analysis.md`, `handoff.md`, `progress.md`.
- No source code or tests in `.agents/teamwork/`.

## Current Parent
- Conversation ID: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6
- Updated: 2026-10-28T15:14:00Z

## Task Summary
- **What to build**: Specification for Docker Persistent Volume Provisioning (Feature 7).
- **Success criteria**:
  - Detailed inspection of `apps/api/src/routes/volumes.ts` and `services/node-agent/src/docker.js`.
  - Exact API contract for `POST /agent/volumes` in `node-agent/src/index.js`.
  - Detailed integration spec for `apps/api/src/routes/volumes.ts` calling `node-agent` via `callNodeAgent`.
  - Container volume mount spec for `services/node-agent/src/docker.js:runContainer` configuring `HostConfig.Binds`.
  - Comprehensive Edge Cases and Features Discovered tables.
- **Interface contracts**: PROJECT.md & SCOPE.md
- **Code layout**: apps/api, services/node-agent

## Key Decisions Made
- `POST /agent/volumes` will operate in dual-mode: when `deploymentId` is present, it provisions host storage directories under `/var/lib/shanutechx/volumes/<deploymentId>/<name>` with `0777` permissions (allowing write access for container non-root User `1000:1000`) and returns `{ success: true, path, name }`. When omitted, it creates Docker named volumes for Arcane/Docker dashboard management.
- `apps/api/src/routes/volumes.ts` verifies compute node assignment, checks for duplicate volume names and mount paths, calls `callNodeAgent(deployment.node, '/agent/volumes', 'POST', ...)` first, and only creates `prisma.deploymentVolume` after node-agent confirmation.
- `services/node-agent/src/docker.js:runContainer` accepts a `volumes` array, sanitizes host paths against restricted system paths (`/var/run/docker.sock`, `/proc`, `/sys`, etc.), ensures host directory write permissions, and populates `HostConfig.Binds`.
- `apps/api/src/lib/nodeAgentClient.ts:buildAndRun` automatically loads `prisma.deploymentVolume` records for the deployment and includes `volumes` in the build-and-run payload, guaranteeing persistent mounts across all rebuilds and redeployments.

## Artifact Index
- DISPATCH.md — Initial dispatch message
- BRIEFING.md — Persistent context & identity
- progress.md — Liveness and progress tracking
- analysis.md — Full technical specification and edge cases
- handoff.md — 5-component handoff report
