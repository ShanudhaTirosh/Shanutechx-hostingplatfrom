# 📱 ShanuTechX WhatsApp Bot Service (`services/whatsapp-bot`)

Automated WhatsApp Notification & Customer Messaging Engine built with Baileys.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 📋 Features & Capabilities

- **Automated Payment & Order Alerts**: Sends instant WhatsApp messages to customers upon payment submission, approval, or rejection.
- **Credential & Invoice Delivery**: Delivers VPS SSH passwords, database connection URIs, and invoice links directly to the customer's phone number (`phoneNumber`).
- **Interactive Bot Commands**: Customers can text `!status`, `!invoice`, `!support`, or `!deployments` for account summaries.
- **Persistent Baileys Auth Session**: Preserves QR pairing credentials across container restarts in `./auth`.

---

## ⚙️ Environment Variables

Create `services/whatsapp-bot/.env`:

```env
WHATSAPP_PORT=4100
WHATSAPP_INTERNAL_SECRET="shared-secret-between-api-and-bot"
LOG_LEVEL="info"
```

---

## 🚀 Commands & Execution

```bash
# Local execution:
npm start --workspace=services/whatsapp-bot

# Docker Compose:
docker compose -f docker-compose.local.yml up -d whatsapp-bot
```

---

## 📡 Internal API Endpoints

- `POST /internal/send-notification`: Sends WhatsApp notification to `phoneNumber`.
- `GET /internal/health`: Liveness health check endpoint.
