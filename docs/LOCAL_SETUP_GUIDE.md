# 🚀 ShanuTechX Local Development Setup Guide

This guide will help you run the ShanuTechX platform locally on your Windows machine using Node.js and Docker.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

### Required Software
- **Node.js** ≥ 22.x - [Download](https://nodejs.org/)
- **npm** ≥ 10.x (comes with Node.js)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/downloads)

### Verify Installations
```cmd
node --version
npm --version
docker --version
docker-compose --version
git --version
```

---

## 🔧 Step 1: Clone and Install Dependencies

```cmd
cd c:\Users\tiros\OneDrive\Desktop\shanutechx-final\shanutechx
npm install --legacy-peer-deps
```

> **Note:** The `--legacy-peer-deps` flag is required for workspace dependency resolution.

---

## 🐳 Step 2: Set Up PostgreSQL with Docker

You can use Docker to run PostgreSQL locally:

```cmd
docker run -d ^
  --name shanutechx-postgres ^
  -e POSTGRES_USER=shanutechx ^
  -e POSTGRES_PASSWORD=shanutechx_dev ^
  -e POSTGRES_DB=shanutechx ^
  -p 5432:5432 ^
  postgres:16-alpine
```

Verify it's running:
```cmd
docker ps
```

---

## 🐳 Step 3: Set Up Redis with Docker

Redis is required for BullMQ queues and rate limiting:

```cmd
docker run -d ^
  --name shanutechx-redis ^
  -p 6379:6379 ^
  redis:7-alpine
```

---

## ⚙️ Step 4: Configure Environment Variables

### 4.1 API Environment

Copy the example file and configure it:

```cmd
copy apps\api\.env.example apps\api\.env
```

Edit `apps\api\.env` with the following minimal configuration:

```env
# Server
PORT=4000

# Database (using local Docker PostgreSQL)
DATABASE_URL="postgresql://shanutechx:shanutechx_dev@localhost:5432/shanutechx?schema=public&connection_limit=20&pool_timeout=10&connection_timeout=5"

# Redis (using local Docker Redis)
REDIS_URL="redis://localhost:6379"

# Firebase (Optional - for auth features)
# Get these from Firebase Console: https://console.firebase.google.com
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_DATABASE_URL=""

# Secrets
SECRETS_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
PROJECT_AUTH_JWT_SECRET="your-jwt-secret-change-this-in-production"

# Internal Services (for local development)
WHATSAPP_INTERNAL_SECRET="local-dev-secret"
WHATSAPP_BOT_URL="http://localhost:4100"
DISCORD_INTERNAL_SECRET="local-dev-secret"
DISCORD_BOT_URL="http://localhost:4200"

# Node Agent
NODE_AGENT_SECRET="local-node-agent-secret"
NODE_AGENT_PORT=5000

# Domain
ROOT_DOMAIN="localhost"

# Optional (leave empty for local dev)
GEMINI_API_KEY=""
GROQ_API_KEY=""
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""
LEASEWEB_API_KEY=""
SMS_WEBHOOK_SECRET=""
BILLING_CRON_SECRET=""
```

### 4.2 Dashboard Environment

Copy and configure the dashboard environment:

```cmd
copy apps\dashboard\.env.example apps\dashboard\.env
```

Edit `apps\dashboard\.env`:

```env
# API Base URL (local API)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Firebase Config (if using Firebase Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

### 4.3 Web App Environment (Optional)

```cmd
copy apps\web\.env.example apps\web\.env
```

---

## 🗄️ Step 5: Initialize the Database

Generate Prisma client and run migrations:

```cmd
npm run db:generate
npm run db:migrate
```

This will:
- Generate the Prisma client from the schema in `packages/db`
- Run all database migrations to set up tables

---

## 🚀 Step 6: Start Development Services

You have two options:

### Option A: Run Services Individually (Recommended for Development)

Open separate terminal windows for each service:

**Terminal 1 - API Server:**
```cmd
npm run dev:api
```
API will be available at: http://localhost:4000

**Terminal 2 - Dashboard:**
```cmd
npm run dev:dashboard
```
Dashboard will be available at: http://localhost:3000

**Terminal 3 - Web (Landing Page - Optional):**
```cmd
npm run dev:web
```
Web will be available at: http://localhost:3001

**Terminal 4 - Worker (Background Jobs - Optional):**
```cmd
npm run dev:worker
```

**Terminal 5 - WhatsApp Bot (Optional):**
```cmd
npm run dev:whatsapp
```

**Terminal 6 - Discord Bot (Optional):**
```cmd
npm run dev:discord
```

### Option B: Use Docker Compose (Production-like Environment)

First, create an `.env` file in `infra/control-plane/`:

```cmd
copy infra\control-plane\.env.example infra\control-plane\.env
```

Configure the environment variables, then start all services:

```cmd
cd infra\control-plane
docker-compose up --build
```

This will start:
- PostgreSQL
- Redis
- Traefik (reverse proxy)
- API
- Worker
- Dashboard
- Web
- WhatsApp Bot
- Discord Bot
- Node Agent
- BuildKit
- LiveKit Server (optional)

---

## 🧪 Step 7: Verify the Setup

### Check API Health
```cmd
curl http://localhost:4000/api/health
```

Or open in browser: http://localhost:4000/api/health

### Access the Dashboard

Open your browser and go to:
- **Dashboard:** http://localhost:3000
- **API:** http://localhost:4000
- **Web:** http://localhost:3001 (if running)

---

## 🔑 Step 8: Create Your First User

You can register through the dashboard UI or use the API directly:

```cmd
curl -X POST http://localhost:4000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@test.com\",\"password\":\"password123\",\"name\":\"Admin User\"}"
```

---

## 📦 Optional: Set Up Node Agent (For VPS Management)

The Node Agent runs on each VPS server to handle deployments. For local testing:

```cmd
cd services\node-agent
npm install
```

Create a `.env` file:
```env
AGENT_PORT=5000
NODE_AGENT_SECRET="local-node-agent-secret"
ROOT_DOMAIN="localhost"
LOG_LEVEL="debug"
```

Start the agent:
```cmd
npm run dev
```

---

## 🛠️ Development Commands

### Database

```cmd
# Generate Prisma client after schema changes
npm run db:generate

# Create a new migration
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:deploy
```

### Testing

```cmd
# Run unit tests
npm run test:unit
```

### Build

```cmd
# Build all packages
npm run build --workspaces
```

---

## 🐛 Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```cmd
# Check what's using a port (e.g., 4000)
netstat -ano | findstr :4000

# Kill the process (replace PID with the actual process ID)
taskkill /PID <PID> /F
```

### Database Connection Issues

1. Ensure PostgreSQL container is running:
```cmd
docker ps | findstr postgres
```

2. Test connection:
```cmd
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx
```

### Docker Issues

1. Restart Docker Desktop
2. Prune old containers and volumes:
```cmd
docker system prune -a
docker volume prune
```

### Prisma Issues

If Prisma client is not found:
```cmd
cd packages\db
npx prisma generate
```

### Node Modules Issues

Clear and reinstall:
```cmd
del /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

---

## 📚 Next Steps

1. **Explore the Templates Catalog:** Check out `templates/` directory for 500+ deployable apps
2. **Read the API Documentation:** See `README.md` for full API reference
3. **Set Up Firebase:** For authentication features, create a Firebase project
4. **Configure Leaseweb:** For VPS management, get a Leaseweb API key
5. **Set Up Stripe:** For billing features, create a Stripe account

---

## 🔗 Quick Reference

| Service | Local URL | Default Port |
|---------|-----------|--------------|
| API | http://localhost:4000 | 4000 |
| Dashboard | http://localhost:3000 | 3000 |
| Web | http://localhost:3001 | 3001 |
| WhatsApp Bot | http://localhost:4100 | 4100 |
| Discord Bot | http://localhost:4200 | 4200 |
| Node Agent | http://localhost:5000 | 5000 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

---

## 🎯 Minimum Setup for Basic Development

If you just want to get started quickly:

1. **Start PostgreSQL and Redis:**
```cmd
docker run -d --name shanutechx-postgres -e POSTGRES_USER=shanutechx -e POSTGRES_PASSWORD=shanutechx_dev -e POSTGRES_DB=shanutechx -p 5432:5432 postgres:16-alpine
docker run -d --name shanutechx-redis -p 6379:6379 redis:7-alpine
```

2. **Configure minimal environment:**
- Edit `apps/api/.env` with database and Redis URLs
- Edit `apps/dashboard/.env` with API URL

3. **Initialize database:**
```cmd
npm run db:generate
npm run db:migrate
```

4. **Start core services:**
```cmd
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:dashboard
```

5. **Access dashboard:** http://localhost:3000

---

## 🆘 Need Help?

- Check the main `README.md` for detailed documentation
- Review the `docs/` directory for guides
- Check GitHub Issues for common problems
- Review the codebase structure in the file tree

---

**Happy Coding! 🎉**
