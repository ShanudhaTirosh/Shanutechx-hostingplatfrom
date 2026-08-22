# 🚀 Run ALL Services - Quick Reference

## ⚡ Fastest Way to Run Everything

### 1. First Time Setup
```cmd
setup-full-stack.cmd
```

### 2. Start Everything
```cmd
run-full-stack.cmd
```
Choose option **[1]** - Start ALL services

### 3. Access Your Platform
- **Dashboard:** http://localhost:3000
- **API:** http://localhost:4000
- **Web:** http://localhost:3001
- **WhatsApp:** http://localhost:4100
- **Discord:** http://localhost:4200
- **Node Agent:** http://localhost:5000

---

## 📦 What Gets Started?

✅ **PostgreSQL** - Database (Port 5432)  
✅ **Redis** - Cache/Queue (Port 6379)  
✅ **API Server** - REST API (Port 4000)  
✅ **Worker** - Background Jobs  
✅ **Dashboard** - Admin UI (Port 3000)  
✅ **Web** - Landing Page (Port 3001)  
✅ **WhatsApp Bot** - Support (Port 4100)  
✅ **Discord Bot** - Notifications (Port 4200)  
✅ **Node Agent** - Deployments (Port 5000)  
✅ **BuildKit** - Container Builds  

**Total: 10 Services Running!**

---

## 🎮 Quick Commands

### Start Everything
```cmd
docker-compose -f docker-compose.local.yml up -d
```

### View Logs
```cmd
docker-compose -f docker-compose.local.yml logs -f
```

### Stop Everything
```cmd
docker-compose -f docker-compose.local.yml down
```

### Check Status
```cmd
docker-compose -f docker-compose.local.yml ps
```

### Restart Everything
```cmd
docker-compose -f docker-compose.local.yml restart
```

---

## ⚙️ Configuration Files

Edit these before starting:

1. **`apps/api/.env`** - API configuration
2. **`apps/dashboard/.env`** - Dashboard config
3. **`services/discord-bot/.env`** - Discord bot token
4. **`services/whatsapp-bot/.env`** - WhatsApp settings
5. **`services/node-agent/.env`** - Node agent config

---

## 🔍 Health Checks

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

## 🐛 Quick Fixes

### Services won't start
```cmd
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up -d
```

### View specific service logs
```cmd
docker-compose -f docker-compose.local.yml logs -f api
docker-compose -f docker-compose.local.yml logs -f discord-bot
docker-compose -f docker-compose.local.yml logs -f whatsapp-bot
```

### Restart specific service
```cmd
docker-compose -f docker-compose.local.yml restart api
```

### Complete reset
```cmd
docker-compose -f docker-compose.local.yml down -v
setup-full-stack.cmd
```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────┐
│  Dashboard (3000) + Web (3001)              │
└────────────────┬────────────────────────────┘
                 │ HTTP
┌────────────────▼────────────────────────────┐
│  API Server (4000)                          │
│  + Worker (Background Jobs)                 │
└┬────┬────┬────┬────┬─────────────────┬─────┘
 │    │    │    │    │                 │
 │    │    │    │    │                 │
┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼────────┐ ┌─────▼─────┐
│PG ││Red││WA ││Dis││Node Agnt│ │ BuildKit  │
│SQL││is ││Bot││Bot││ (5000)  │ │           │
└───┘└───┘└───┘└───┘└─────────┘ └───────────┘
5432 6379 4100 4200
```

---

## 📚 Full Documentation

For detailed information, see:
- **FULL_STACK_GUIDE.md** - Complete guide
- **QUICK_START.md** - Fast setup
- **LOCAL_SETUP_GUIDE.md** - Detailed instructions
- **README.md** - Platform documentation

---

## 🎯 Minimum Required Config

### apps/api/.env
```env
DATABASE_URL="postgresql://shanutechx:shanutechx_dev@postgres:5432/shanutechx?schema=public"
REDIS_URL="redis://redis:6379"
SECRETS_ENCRYPTION_KEY="64-character-hex-string"
PROJECT_AUTH_JWT_SECRET="your-secret"
WHATSAPP_INTERNAL_SECRET="local-dev-secret"
DISCORD_INTERNAL_SECRET="local-dev-secret"
NODE_AGENT_SECRET="local-node-agent-secret"
```

### services/discord-bot/.env
```env
DISCORD_BOT_TOKEN="your-discord-token"
API_BASE_URL=http://api:4000
DISCORD_INTERNAL_SECRET="local-dev-secret"
```

---

## ✅ Startup Checklist

- [ ] Docker Desktop is running
- [ ] Node.js 22+ installed
- [ ] Environment files configured
- [ ] At least 8GB RAM available
- [ ] Ports 3000-5000 are free

---

## 🚀 Ready to Start!

Run this command:
```cmd
setup-full-stack.cmd
```

Then:
```cmd
run-full-stack.cmd
```

**That's it! 🎉**

Access the dashboard at: **http://localhost:3000**

---

<div align="center">
  <strong>All Services Running!</strong><br/>
  <em>Check FULL_STACK_GUIDE.md for troubleshooting</em>
</div>
