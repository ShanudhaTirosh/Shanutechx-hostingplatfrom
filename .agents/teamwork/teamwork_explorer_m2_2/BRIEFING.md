# BRIEFING — 2026-10-28T15:15:00Z

## Mission
Technical investigation and design for Milestone 2: Feature 8 (Direct Image Deployment) and Feature 9 (Build Secrets Protection).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m2_2\
- Original parent: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6
- Milestone: Milestone 2: Container Management & Build System

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Strictly follow Handoff Protocol (5 components)
- Output detailed findings to analysis.md and handoff.md

## Current Parent
- Conversation ID: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6
- Updated: 2026-10-28T15:15:00Z

## Investigation State
- **Explored paths**:
  - `apps/api/src/routes/dockerDeployments.ts` (lines 121–165)
  - `apps/api/src/routes/volumes.ts` (lines 40–85)
  - `apps/api/src/lib/nodeAgentClient.ts`
  - `apps/api/src/lib/deployPipeline.ts`
  - `services/node-agent/src/index.js` (lines 450–650)
  - `services/node-agent/src/docker.js` (lines 14–115, 390–420)
  - `services/node-agent/src/build.js` (lines 224–394)
  - `tests/e2e/tier1-features/m2-container-build.test.ts` (lines 98–230)
  - `tests/e2e/tier2-boundary/limits-and-validation.test.ts`
  - `tests/e2e/tier3-interactions/volume-container-persistence.test.ts`
  - `tests/e2e/infra/test-server.ts`
- **Key findings**:
  - Direct image deployment fails because `services/node-agent/src/index.js` is missing `POST /agent/deployments/:id/run-image`. The 404 triggers a fallback to `buildAndRun` with `image://${image}`, which executes `git clone image://...` and crashes.
  - `docker.js`'s `pullImage` mangles tagged images (e.g. `redis:7-alpine` -> `redis:7-alpine:latest`).
  - `runContainer` omitted `volumes` and `ports`, leaving persistent volumes disconnected.
  - `build.js:243-248` serialized all runtime `envVars` into `--build-arg`, leaking database credentials and tokens into Docker image layer history.
- **Unexplored areas**: None for Features 8 and 9 scope.

## Key Decisions Made
- Designed `POST /agent/deployments/:id/run-image` route handler in `services/node-agent/src/index.js` with 400 validation, image pulling, volume bind mounting, and 201 response.
- Designed tag-safe `pullImage` and volume-enabled `runContainer` updates for `docker.js`.
- Designed `buildArgs` segregation in `build.js` to ensure runtime secrets are never passed to `docker build`.

## Artifact Index
- DISPATCH.md — Incoming parent tasks
- BRIEFING.md — Persistent working state
- progress.md — Liveness heartbeat
- analysis.md — Detailed technical findings and complete designs
- handoff.md — Formal 5-component handoff report
