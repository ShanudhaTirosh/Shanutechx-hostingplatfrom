# ShanuTechX Documentation Hub

Welcome to the ShanuTechX documentation hub. This directory contains comprehensive documentation, architecture guides, deployment runbooks, and audit reports for the platform.

---

## 🚀 Quick Navigation

- **[`TECH_STACK_AND_ARCHITECTURE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/TECH_STACK_AND_ARCHITECTURE.md)** — Full technology stack, rationale & reference architectures guide.
- **[`CLAUDE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/CLAUDE.md)** — Core AI context & architecture guide.
- **[`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)** — Operational quick-start & commands manual.
- **[`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)** — Complete defect tracking & security audit ledger.
- **[`SETUP_AND_CONFIGURATION_GUIDE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/SETUP_AND_CONFIGURATION_GUIDE.md)** — Master setup & port directory.

---

## 📝 Key Documentation Files

- **[`PROJECT_STRUCTURE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/PROJECT_STRUCTURE.md)** — Comprehensive monorepo workspace directory tree.
- **[`DEPLOYMENT_GUIDE.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/DEPLOYMENT_GUIDE.md)** — Production deployment & multi-container orchestration manual.
- **[`NEW_FEATURES.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/NEW_FEATURES.md)** — Detailed overview of recent platform capabilities.
- **[`COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/COMPREHENSIVE_AUDIT_AND_RESOLUTION_REPORT.md)** — Multi-pass vulnerability audit report.
- **[`LOCAL_DEV_README.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/docs/LOCAL_DEV_README.md)** — Local development environment setup guide.

---

## 📊 Monorepo Layout

```text
shanutechx/
├── apps/           # Core applications (api, dashboard, web, mobile-admin)
├── services/       # Autonomous daemons (node-agent, discord-bot, whatsapp-bot)
├── packages/       # Shared SDKs & modules (db, client, catalog, deployments, auth, types, tracing, supabase-js suite)
├── infra/          # Traefik, PostgreSQL, Redis control-plane & node configs
├── templates/      # 15+ One-click catalog Compose application templates
├── tests/          # Node test runner unit tests & Playwright E2E suites
└── docs/           # Central documentation hub (you are here)
```
