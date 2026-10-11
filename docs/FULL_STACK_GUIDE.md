# 🚀 Full Stack Setup Guide - Complete ShanuTechX Platform

This guide will help you run the **COMPLETE** ShanuTechX platform locally with **ALL** services.

---

## 📦 What's Included in Full Stack?

### Infrastructure Services
- ✅ **PostgreSQL 16** - Main database (Port 5432)
- ✅ **Redis 7** - Queue & caching (Port 6379)

### Core Application Services
- ✅ **API Server** - Express REST API (Port 4000)
- ✅ **Worker** - Background job processor (BullMQ)
- ✅ **Web Storefront** - Marketing website & SEO/AI Discovery Hub (Port 3000)
- ✅ **Dashboard** - Next.js admin & customer portal (Port 3001)
- ✅ **Webmail** - Next.js enterprise business email client (Port 3002)

### Bot Services
- ✅ **WhatsApp Bot** - Customer support automation (Port 4100)
- ✅ **Discord Bot** - Team notifications (Port 4200)

### Deployment Services
- ✅ **Node Agent** - VPS deployment handler (Port 5000)
- ✅ **BuildKit** - Docker image builder

**Total: 11 Services** running simultaneously!

---

## ⚡ Quick Start (Full Stack)

### Option 1: Automated Setup (Recommended)

```cmd
REM Step 1: Run the full stack setup
setup-full-stack.cmd

REM Step 2: Configure your services (edit .env files)
REM See "Configuration" section below

REM Step 3: Start everything
run-full-stack.cmd
```

Choose option **[1]** to start all services.

### Option 2: Manual Docker Compose

```cmd
REM Install dependencies
npm install --legacy-peer-deps

REM Generate Prisma client
npm run db:generate

REM Start all services with Docker
docker-compose -f docker-compose.local.yml up -d

REM View logs
docker-compose -f docker-compose.local.yml logs -f
```

---

## ⚙️ Configuration Requirements

### 1. API Configuration (`apps/api/.env`)

**Minimum Required:**
```env
# Database (Docker internal)
DATABASE_URL="postgresql://shanutechx:shanutechx_dev@postgres:5432/shanutechx?schema=public"

# Redis (Docker internal)
REDIS_URL="redis://redis:6379"

# Security Keys (generate random strings)
SECRETS_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
PROJECT_AUTH_JWT_SECRET="your-jwt-secret-here"

# Internal Service URLs (Docker container names)
WHATSAPP_BOT_URL="http://whatsapp-bot:4100"
WHATSAPP_INTERNAL_SECRET="local-dev-secret"
DISCORD_BOT_URL="http://discord-bot:4200"
DISCORD_INTERNAL_SECRET="local-dev-secret"

# Node Agent
NODE_AGENT_SECRET="local-node-agent-secret"
NODE_AGENT_PORT=5000
```

**Optional but Recommended:**
```env
# Firebase (for authentication)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL="https://your-project.firebaseio.com"

# Leaseweb (for VPS management)
LEASEWEB_API_KEY="your-leaseweb-api-key"

# Stripe (for billing)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AI Services
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"

# Cloudflare (for DNS)
CLOUDFLARE_API_TOKEN="your-cloudflare-token"
CLOUDFLARE_ZONE_ID="your-zone-id"
ROOT_DOMAIN="yourdomain.com"
```

### 2. Dashboard Configuration (`apps/dashboard/.env`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Firebase (if using Firebase Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### 3. Webmail Configuration (`apps/webmail/.env`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### 4. WhatsApp Bot Configuration (`services/whatsapp-bot/.env`)

```env
PORT=4100
WHATSAPP_INTERNAL_SECRET=local-dev-secret
API_BASE_URL=http://api:4000

# Add your WhatsApp-Web.js configuration here
# Session data will be stored in services/whatsapp-bot/auth/
```

### 5. Discord Bot Configuration (`services/discord-bot/.env`)

```env
PORT=4200
DISCORD_INTERNAL_SECRET=local-dev-secret
API_BASE_URL=http://api:4000

# Required: Get from https://discord.com/developers/applications
DISCORD_BOT_TOKEN=your-discord-bot-token-here
DISCORD_GUILD_ID=your-server-id
DISCORD_NOTIFICATIONS_CHANNEL_ID=your-channel-id
```

### 6. Node Agent Configuration (`services/node-agent/.env`)

```env
AGENT_PORT=5000
NODE_AGENT_SECRET=local-node-agent-secret
ROOT_DOMAIN=localhost
LOG_LEVEL=info
NODE_ENV=development
```

---

## 🚀 Starting the Full Stack

### Using the Launcher Script

```cmd
run-full-stack.cmd
```

**Menu Options:**
- **[1]** Start ALL services ⭐ (Recommended)
- **[2]** Start Infrastructure only (PostgreSQL + Redis)
- **[3]** Start Core services (Infrastructure + API + Dashboard + Web)
- **[4]** Stop all services
- **[5]** View logs (all services)
- **[6]** View logs (specific service)
- **[7]** Restart all services
- **[8]** Check service status
- **[9]** Clean up everything

### Using Docker Compose Directly

```cmd
# Start all services in background
docker-compose -f docker-compose.local.yml up -d

# Start all services with logs visible
docker-compose -f docker-compose.local.yml up

# Start specific services
docker-compose -f docker-compose.local.yml up -d postgres redis api dashboard

# View logs
docker-compose -f docker-compose.local.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.local.yml logs -f api

# Stop all services
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (WARNING: deletes database!)
docker-compose -f docker-compose.local.yml down -v
```

---

## 🌐 Access Your Services

Once all services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| **Web Storefront** | http://localhost:3000 | Storefront & SEO / AI Discovery |
| **Dashboard** | http://localhost:3001 | Customer & admin control panel |
| **Webmail** | http://localhost:3002 | Business email web client |
| **API** | http://localhost:4000 | REST API |
| **API Health** | http://localhost:4000/api/health | API status |
| **WhatsApp Bot** | http://localhost:4100 | WhatsApp integration |
| **Discord Bot** | http://localhost:4200 | Discord integration |
| **Node Agent** | http://localhost:5000 | Deployment engine |
| **PostgreSQL** | localhost:5432 | Database |
| **Redis** | localhost:6379 | Cache/Queue |

---

## 🔍 Monitoring & Logs

### View All Logs
```cmd
docker-compose -f docker-compose.local.yml logs -f
```

### View Specific Service Logs
```cmd
# API Server
docker-compose -f docker-compose.local.yml logs -f api

# Dashboard
docker-compose -f docker-compose.local.yml logs -f dashboard

# WhatsApp Bot
docker-compose -f docker-compose.local.yml logs -f whatsapp-bot

# Discord Bot
docker-compose -f docker-compose.local.yml logs -f discord-bot

# Worker
docker-compose -f docker-compose.local.yml logs -f worker

# Node Agent
docker-compose -f docker-compose.local.yml logs -f node-agent
```

### Check Service Status
```cmd
docker-compose -f docker-compose.local.yml ps
```

### Check Service Health
```cmd
# API
curl http://localhost:4000/api/health

# WhatsApp Bot
curl http://localhost:4100/internal/health

# Discord Bot
curl http://localhost:4200/internal/health

# Node Agent
curl http://localhost:5000/agent/health
```

---

## 🧪 Testing Your Setup

### 1. Test Infrastructure
```cmd
# Test PostgreSQL
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx -c "SELECT version();"

# Test Redis
docker exec -it shanutechx-redis redis-cli ping
```

### 2. Test API
```cmd
# Health check
curl http://localhost:4000/api/health

# Register a user
curl -X POST http://localhost:4000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"password123\",\"name\":\"Test User\"}"
```

### 3. Test Web, Dashboard & Webmail
- Open Web Storefront: http://localhost:3000
- Open Dashboard Portal: http://localhost:3001
- Open Webmail Client: http://localhost:3002

### 4. Test Bots
```cmd
# WhatsApp Bot health
curl http://localhost:4100/internal/health

# Discord Bot health
curl http://localhost:4200/internal/health
```

### 5. Test Node Agent
```cmd
curl http://localhost:5000/agent/health
```

---

## 🐛 Troubleshooting

### Services Won't Start

**Check Docker is running:**
```cmd
docker ps
```

**Check logs for errors:**
```cmd
docker-compose -f docker-compose.local.yml logs
```

**Rebuild images:**
```cmd
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up -d
```

### Database Connection Issues

**Check PostgreSQL is running:**
```cmd
docker ps | findstr postgres
```

**Restart PostgreSQL:**
```cmd
docker-compose -f docker-compose.local.yml restart postgres
```

**Check logs:**
```cmd
docker-compose -f docker-compose.local.yml logs postgres
```

### API or Services Failing

**Check environment variables:**
```cmd
# Make sure .env files exist
dir apps\api\.env
dir services\discord-bot\.env
dir services\whatsapp-bot\.env
dir services\node-agent\.env
```

**Check service logs:**
```cmd
docker-compose -f docker-compose.local.yml logs api
docker-compose -f docker-compose.local.yml logs worker
```

**Restart specific service:**
```cmd
docker-compose -f docker-compose.local.yml restart api
```

### Discord Bot Not Working

**Missing token:**
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "Bot" section
4. Copy the token
5. Add to `services/discord-bot/.env`:
```env
DISCORD_BOT_TOKEN=your-token-here
```
6. Restart the service:
```cmd
docker-compose -f docker-compose.local.yml restart discord-bot
```

### WhatsApp Bot Issues

**Authentication required:**
1. Check logs: `docker-compose -f docker-compose.local.yml logs whatsapp-bot`
2. Look for QR code in logs
3. Scan with WhatsApp mobile app
4. Session saved in `services/whatsapp-bot/auth/`

### Port Conflicts

**Check what's using ports:**
```cmd
netstat -ano | findstr :4000
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :5432
```

**Kill conflicting processes:**
```cmd
taskkill /PID <PID> /F
```

### Complete Reset

```cmd
# Stop and remove everything
docker-compose -f docker-compose.local.yml down -v

# Remove all images
docker-compose -f docker-compose.local.yml down --rmi local

# Clean install
rmdir /s /q node_modules
npm install --legacy-peer-deps

# Rebuild and restart
setup-full-stack.cmd
```

---

## 📊 Resource Requirements

### Minimum Requirements
- **RAM:** 8GB
- **Disk:** 10GB free space
- **CPU:** 4 cores
- **Docker:** Latest version

### Recommended Requirements
- **RAM:** 16GB
- **Disk:** 20GB free space
- **CPU:** 8 cores
- **SSD:** For better performance

### Service Resource Usage (Approximate)
- PostgreSQL: ~200MB RAM
- Redis: ~50MB RAM
- API: ~300MB RAM
- Worker: ~200MB RAM
- Dashboard: ~300MB RAM
- Web: ~200MB RAM
- WhatsApp Bot: ~400MB RAM
- Discord Bot: ~150MB RAM
- Node Agent: ~200MB RAM
- BuildKit: ~100MB RAM

**Total:** ~2GB RAM for all services

---

## 🎯 Development Workflow

### Daily Workflow

```cmd
# Morning: Start everything
run-full-stack.cmd
# Choose option [1]

# Work on your code...
# Changes will require rebuild for some services

# View logs while developing
docker-compose -f docker-compose.local.yml logs -f api

# Restart a service after code changes
docker-compose -f docker-compose.local.yml restart api

# Evening: Stop everything
docker-compose -f docker-compose.local.yml down
```

### Making Code Changes

**For API changes:**
```cmd
# Rebuild and restart
docker-compose -f docker-compose.local.yml build api
docker-compose -f docker-compose.local.yml restart api
```

**For Dashboard changes:**
```cmd
docker-compose -f docker-compose.local.yml build dashboard
docker-compose -f docker-compose.local.yml restart dashboard
```

**For Database schema changes:**
```cmd
# Update schema in packages/db/prisma/schema.prisma
npm run db:generate
npm run db:migrate

# Restart services that use database
docker-compose -f docker-compose.local.yml restart api worker
```

---

## 🔧 Advanced Commands

### Database Management

```cmd
# Access PostgreSQL CLI
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx

# Backup database
docker exec shanutechx-postgres pg_dump -U shanutechx shanutechx > backup.sql

# Restore database
docker exec -i shanutechx-postgres psql -U shanutechx shanutechx < backup.sql

# Drop and recreate database
docker exec -it shanutechx-postgres psql -U shanutechx -c "DROP DATABASE shanutechx;"
docker exec -it shanutechx-postgres psql -U shanutechx -c "CREATE DATABASE shanutechx;"
npm run db:migrate
```

### Redis Management

```cmd
# Access Redis CLI
docker exec -it shanutechx-redis redis-cli

# Flush all Redis data
docker exec -it shanutechx-redis redis-cli FLUSHALL

# View Redis stats
docker exec -it shanutechx-redis redis-cli INFO
```

### Container Management

```cmd
# View container resource usage
docker stats

# Execute command in container
docker exec -it shanutechx-api sh

# Copy files from/to container
docker cp shanutechx-api:/app/file.txt ./file.txt
docker cp ./file.txt shanutechx-api:/app/file.txt

# View container details
docker inspect shanutechx-api
```

---

## 🚀 Production Deployment

When ready for production, use:
- `infra/control-plane/docker-compose.yml` - Full production stack
- Proper SSL certificates via Traefik + Let's Encrypt
- Secure environment variables
- Managed database service
- Proper firewall rules

See the main README.md and deployment documentation for details.

---

## 📚 Additional Resources

- **QUICK_START.md** - Fast setup guide
- **LOCAL_SETUP_GUIDE.md** - Detailed setup instructions
- **LOCAL_DEV_README.md** - Development reference
- **README.md** - Full platform documentation
- **docker-compose.local.yml** - Docker configuration

---

## 🆘 Getting Help

1. **Check logs first:**
   ```cmd
   docker-compose -f docker-compose.local.yml logs -f
   ```

2. **Verify services are running:**
   ```cmd
   docker-compose -f docker-compose.local.yml ps
   ```

3. **Test individual components:**
   ```cmd
   curl http://localhost:4000/api/health
   ```

4. **Reset if needed:**
   ```cmd
   run-full-stack.cmd
   # Choose option [9] for complete cleanup
   ```

---

<div align="center">
  <strong>Full Stack Ready! 🎉</strong><br/>
  <br/>
  <em>Run setup-full-stack.cmd to begin</em><br/>
  <em>Then use run-full-stack.cmd to manage services</em>
</div>
