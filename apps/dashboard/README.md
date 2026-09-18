# 🎛️ ShanuTechX Control Panel Dashboard (`apps/dashboard`)

The customer control panel and administration studio for the ShanuTechX cloud hosting platform, built with **Next.js 14 App Router** and **Tailwind CSS**.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## ⚡ Highlights & Key Features

- **Unified Dev Studio & Databases Hub ([`app/(protected)/dev/projects/page.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/(protected)/dev/projects/page.tsx))**: Centralized studio for Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures.
- **OAuth Single Sign-On (SSO)**: Firebase Google, GitHub, and Discord OAuth authentication with direct email/password forms disabled.
- **Dev Superuser Gating**: `role: 'dev'` superuser access to platform administration and dev studio capabilities.
- **Webmail Studio (`/webmail`)**: Integrated 3-pane / 2-pane webmail interface for managing provisioned mailboxes.
- **Interactive Terminal (`/deployments/[id]`)**: Embedded WebSockets PTY SSH terminal supporting xterm.js.

---

## 📂 Codebase Structure

```text
apps/dashboard/
├── app/
│   ├── layout.tsx               # Root layout (providers, dark theme fonts)
│   ├── page.tsx                 # Root redirect to login / dashboard
│   ├── (auth)/                  # OAuth SSO login and authentication pages
│   └── (protected)/             # Role-gated dashboard routes
│       ├── dev/projects/        # Unified Dev Studio & Databases Hub
│       ├── deployments/         # Git push-to-deploy, file manager, logs & env vars
│       ├── databases/           # Managed database provisioning (Postgres, MySQL, Redis, MongoDB)
│       ├── catalog/             # 1-Click application catalog template browser
│       ├── webmail/             # Webmail Studio interface
│       ├── vps/                 # Leaseweb VPS reseller management
│       ├── billing/             # Subscription billing & payment proof uploads
│       └── admin/               # Host node registration & user management
├── components/                  # Dark-mode glassmorphism UI components
├── lib/                         # API client bindings and state helpers
├── package.json
└── tsconfig.json
```

---

## 🛠️ Commands & Development

- **Start Dev Server:** `npm run dev:dashboard` (runs on port `3001`)
- **Build Production Bundle:** `npm run build --workspace=apps/dashboard`
