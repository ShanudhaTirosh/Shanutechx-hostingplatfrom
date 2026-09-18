# 📱 ShanuTechX Mobile Admin App (`apps/mobile-admin`)

A standalone React Native (Expo) administration application for staff (`admin` / `dev`) to review payment proofs, manage support tickets, monitor server node telemetry, and handle deployments on the go.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## ⚡ Highlights & Key Capabilities

- **OAuth SSO Token Authentication**: Authenticates with the Core API ([`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api)) using OAuth Bearer ID tokens (`Authorization: Bearer <idToken>`).
- **Payment Review Queue**: Live `/api/payments/review-queue` list for approving or declining manual payment proofs with instant notifications.
- **Support Ticket Chat**: Threaded customer support chat against `/api/tickets/*`.
- **Node Metrics & Telemetry**: Live CPU, RAM, and node health charts from `/api/admin/analytics`.
- **Isolated Workspace**: Excluded from the root npm workspace tree (`!apps/mobile-admin` in root [`package.json`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/package.json)) to maintain isolated Expo SDK 51 / React Native dependency pinning.

---

## 📂 Codebase Structure

```text
apps/mobile-admin/
├── App.tsx                      # Expo application root entrypoint
├── app.json                     # Expo configuration and API endpoint setup
├── eas.json                     # EAS Cloud Build configuration
├── src/
│   ├── lib/
│   │   ├── api.ts               # Typed API client for Core REST API
│   │   ├── firebase.ts          # Firebase SDK configuration
│   │   └── types.ts             # Mobile TypeScript type definitions
│   └── screens/                 # Dashboard tabs & screen components
├── package.json
└── tsconfig.json
```

---

## 🛠️ Commands & Typecheck

- **Typecheck Mobile App:** `npx tsc --noEmit` (run inside `apps/mobile-admin`)
- **Export Expo Bundle:** `npx expo export --platform android`
- **EAS Cloud Build (APK/AAB):** `eas build --platform android --profile preview`
