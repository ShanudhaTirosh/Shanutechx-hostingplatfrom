# 🤖 ShanuTechX Discord Bot Service (`services/discord-bot`)

Automated Discord Bot daemon for server management, support ticket automation, payment review queue alerts, and unified event notifications.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## 📋 Features & Capabilities

- **Automated Ticket Management**: Open support tickets via `/ticket create`, view status, reply to messages, and close tickets within Discord.
- **Infrastructure Commands**: `/server status`, `/deployments list`, and `/nodes status` for real-time node visibility.
- **Direct Messaging (DM)**: Sends direct messages for payment approvals, VPS SSH credentials, and container alerts.
- **Unified Channel Alerts**: Posts rich embeds to `#alerts` channels for payments, orders, tickets, and node failovers.

---

## ⚙️ Environment Variables

Create `services/discord-bot/.env`:

```env
DISCORD_PORT=4200
DISCORD_BOT_TOKEN="your-discord-bot-token"
DISCORD_INTERNAL_SECRET="shared-secret-between-api-and-bot"
ADMIN_ALERT_CHANNEL_ID="123456789012345678"
LOG_LEVEL="info"
```

---

## 🚀 Commands & Execution

```bash
# Local execution:
npm start --workspace=services/discord-bot

# Docker Compose:
docker compose -f docker-compose.local.yml up -d discord-bot
```

---

## 📡 Internal API Endpoints

- `POST /internal/send-dm`: Sends DM notification to a user by `discordUserId`.
- `POST /internal/send-channel`: Sends rich embed message to `#alerts` channel.
- `GET /internal/health`: Liveness health check endpoint.
