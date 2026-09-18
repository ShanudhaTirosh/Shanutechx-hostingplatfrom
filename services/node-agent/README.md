# 🛠️ ShanuTechX Node Agent Daemon (`services/node-agent`)

The plain JavaScript (`.js`) container management and telemetry control agent running on each VPS host compute node.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 🚀 Core Responsibilities & Safety Guardrails

- **Docker Container Lifecycle**: Full build, run, stop, restart, metrics, and log streaming (`getLogs`, `streamLogs`) via Dockerode.
- **Path Traversal Jailing**: Workspace file operations in [`filesystem.js`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/services/node-agent/src/filesystem.js) sanitize inputs with `path.basename()` and enforce `resolveSafe()` against `WORKSPACE_ROOT`.
- **Traefik Reverse Proxy Routing**: Dynamic router label attachment (`traefik.enable`, `traefik.http.routers...`) for subdomains.
- **Authentication Security**: Verified via `x-agent-secret` header using constant-time `crypto.timingSafeEqual()` comparisons.

---

## 📂 Codebase Structure

```text
services/node-agent/
├── src/
│   ├── index.js                 # Express server & authenticated route endpoints
│   ├── nodeEngine.js            # Dockerode container lifecycle & Traefik router labeling
│   ├── filesystem.js            # Path-jailed file manager operations (list, read, write, extract)
│   ├── stats.js                 # Container resource usage stats (CPU/RAM telemetry)
│   └── customDomain.js          # Cloudflare & Traefik custom domain binding
├── Dockerfile                   # Node Agent container image definition
├── package.json
└── .env.example
```

---

## 📡 API Endpoints Summary

- `GET /agent/health` — Agent health check.
- `POST /agent/deploy` — Git clone, container build (Railpack), and container execution.
- `GET /agent/deployments/:id/metrics` — Container CPU, RAM, and network telemetry stats.
- `GET /agent/logs/stream/:id` — Server-Sent Events (SSE) live build log stream.
- `GET /agent/fs/:id/list` — List workspace directory.
- `GET /agent/fs/:id/read` — Read file content.
- `PUT /agent/fs/:id/write` — Save file content.
