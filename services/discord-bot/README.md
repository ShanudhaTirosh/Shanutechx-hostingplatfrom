# 🤖 ShanuTechX Discord Bot Service (`services/discord-bot`)

> Automated Discord Bot for Server Management, Support Ticket Automation, Invoice & Credential Delivery, and Unified Event Notifications.

---

## 📋 Features

- **Automated Ticket Management**: Allows customers to open support tickets via `/ticket create`, view status, reply to messages, and close tickets directly within Discord.
- **Server & Deployment Management**: Supports `/server status`, `/deployments list`, and `/nodes status` commands for real-time infrastructure visibility.
- **Direct Delivery & Notifications**: Sends direct messages (DMs) with invoice PDFs, payment approvals, VPS SSH credentials, and deployment failure alerts.
- **Unified Channel Alerts**: Posts automated rich embeds to `#alerts` channels for new payments, orders, tickets, and node failover events.

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

## 🚀 Running via Docker & Monorepo

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
