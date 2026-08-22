# 🐳 Docker Setup for ShanuTechX

This directory contains everything you need to run the complete ShanuTechX platform using Docker.

## 📚 Quick Navigation

| File | Purpose |
|------|---------|
| **QUICK_START.md** | 👈 START HERE! Simple step-by-step guide |
| **SETUP_COMPLETE.md** | What's been configured and how everything works |
| **RUNNING_GUIDE.md** | Detailed documentation and troubleshooting |
| **START-ALL.cmd** | Main script to start everything |
| **CHECK-HEALTH.cmd** | Check if services are healthy |

## 🚀 Get Started in 3 Steps

### 1. Start Docker Desktop
Open Docker Desktop and wait for it to be ready.

### 2. Run the Setup
```cmd
START-ALL.cmd
```

### 3. Access the Platform
Wait 2-3 minutes, then open:
- Dashboard: http://localhost:3001
- API: http://localhost:4000

That's it! 🎉

## 📋 Available Scripts

### Windows Batch Scripts (.cmd)
These work directly in Command Prompt:

- **START-ALL.cmd** - Complete setup and startup
  ```cmd
  START-ALL.cmd
  ```

- **CHECK-HEALTH.cmd** - Test all services
  ```cmd
  CHECK-HEALTH.cmd
  ```

### PowerShell Scripts (.ps1)
These require PowerShell:

- **STOP-ALL.ps1** - Stop all services
  ```powershell
  .\STOP-ALL.ps1
  ```

- **STATUS.ps1** - View service status with health checks
  ```powershell
  .\STATUS.ps1
  ```

- **VIEW-LOGS.ps1** - View service logs
  ```powershell
  # All services
  .\VIEW-LOGS.ps1
  
  # Specific service
  .\VIEW-LOGS.ps1 api
  ```

- **REBUILD.ps1** - Rebuild and restart services
  ```powershell
  # Rebuild everything
  .\REBUILD.ps1
  
  # Rebuild specific service
  .\REBUILD.ps1 api
  ```

## 🏗️ What Gets Started

### Core Services
- PostgreSQL (Database)
- Redis (Queues)
- Traefik (Reverse Proxy)

### Application Services
- API Server (Express)
- Worker (Background Jobs)
- Dashboard (Next.js UI)
- Web (Marketing Site)

### Bot Services
- WhatsApp Bot
- Discord Bot

### Infrastructure
- Node Agent (VPS Management)
- BuildKit (Docker Builds)
- LiveKit Server (Video/Audio)

## 🌐 Access URLs

Once running:

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3001 |
| API | http://localhost:4000 |
| Web | http://localhost:3000 |
| Health Check | http://localhost:4000/api/health |

## 📊 Service Architecture

```
┌─────────────────────────────────────────┐
│          Your Browser                   │
│  localhost:3001 (Dashboard)             │
│  localhost:3000 (Web)                   │
└────────────┬────────────────────────────┘
             │ HTTP
┌────────────▼────────────────────────────┐
│          Traefik (Reverse Proxy)        │
│          Port 80, 443                   │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┬─────────────┐
    │                 │             │
┌───▼────┐      ┌────▼────┐   ┌───▼────┐
│  API   │      │Dashboard│   │  Web   │
│ :4000  │      │  :3001  │   │ :3000  │
└───┬────┘      └─────────┘   └────────┘
    │
    ├──────┐
    │      │
┌───▼──┐ ┌─▼──────┐
│Postgre││ Redis  │
│  SQL  ││ :6379  │
│ :5432 ││        │
└──────┘└────────┘
```

## 🔧 Configuration

Configuration is managed through:

1. **Docker Compose:** `infra/control-plane/docker-compose.yml`
2. **Environment Variables:**
   - `infra/control-plane/.env` - Docker settings
   - `apps/api/.env` - API configuration
   - `apps/dashboard/.env` - Dashboard configuration
   - `services/whatsapp-bot/.env` - WhatsApp bot
   - `services/discord-bot/.env` - Discord bot

## 💾 Data Persistence

Data is stored in Docker volumes:

- `postgres-data` - All database data
- `shanutechx-uploads` - Uploaded files
- `shanutechx-invoices` - Generated invoices
- `shanutechx-workspaces` - Deployment files
- `traefik-certs` - SSL certificates

**To reset all data:**
```cmd
docker compose -f infra\control-plane\docker-compose.yml down -v
```
⚠️ **Warning:** This deletes everything!

## 🔍 Monitoring

### Check Container Status
```cmd
docker compose -f infra\control-plane\docker-compose.yml ps
```

### View Logs
```cmd
REM All services
docker compose -f infra\control-plane\docker-compose.yml logs -f

REM Specific service
docker compose -f infra\control-plane\docker-compose.yml logs -f api
docker compose -f infra\control-plane\docker-compose.yml logs -f dashboard
docker compose -f infra\control-plane\docker-compose.yml logs -f postgres
```

### Resource Usage
```cmd
docker stats
```

## 🛠️ Common Tasks

### Stop All Services
```cmd
docker compose -f infra\control-plane\docker-compose.yml down
```

### Restart a Service
```cmd
docker compose -f infra\control-plane\docker-compose.yml restart api
```

### Access Database
```cmd
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx
```

### Shell into Container
```cmd
docker exec -it shanutechx-api sh
```

### Run Database Migrations
```cmd
npm run db:migrate
```

## 🐛 Troubleshooting

### Docker Not Running
**Error:** `failed to connect to the docker API`
**Fix:** Start Docker Desktop

### Port Conflicts
**Error:** `port is already allocated`
**Fix:** Stop other services or change ports in docker-compose.yml

### Services Not Responding
**Fix:** Wait 3-5 minutes, check logs:
```cmd
docker compose -f infra\control-plane\docker-compose.yml logs [service]
```

### Build Failures
**Fix:** Clean and rebuild:
```cmd
docker system prune -af
START-ALL.cmd
```

## 📖 Documentation Files

| File | What's Inside |
|------|---------------|
| **QUICK_START.md** | Simple getting started guide |
| **SETUP_COMPLETE.md** | What's configured and setup details |
| **RUNNING_GUIDE.md** | Complete running guide with troubleshooting |
| **README.md** | Main project documentation |

## ⚡ Performance Tips

1. **Allocate More RAM to Docker**
   - Open Docker Desktop → Settings → Resources
   - Set memory to at least 8GB

2. **Allocate More CPU**
   - Set CPUs to at least 4 cores

3. **Enable WSL 2** (Windows)
   - Better performance than Hyper-V
   - Docker Desktop → Settings → General → Use WSL 2

4. **SSD Storage**
   - Store Docker images on SSD for faster builds

## 🔒 Security Notes

1. **Change Default Passwords**
   - PostgreSQL password in `infra/control-plane/.env`
   - All secrets in `apps/api/.env`

2. **Don't Expose to Internet**
   - This setup is for local development only
   - For production, use proper SSL/TLS
   - Configure firewall rules

3. **Secrets Management**
   - Never commit `.env` files
   - Use Docker secrets in production

## 🎯 Next Steps After Setup

1. **Create Admin User**
   - Use API to create first admin account
   
2. **Register VPS Nodes**
   - Add your VPS servers to the platform
   
3. **Deploy Applications**
   - Use the template catalog to deploy apps

4. **Configure Integrations**
   - Set up Stripe for billing
   - Configure WhatsApp bot
   - Set up Discord notifications

## 🆘 Need Help?

1. **Check the logs:**
   ```cmd
   docker compose -f infra\control-plane\docker-compose.yml logs -f
   ```

2. **Read the guides:**
   - QUICK_START.md
   - RUNNING_GUIDE.md
   - SETUP_COMPLETE.md

3. **Check service health:**
   ```cmd
   CHECK-HEALTH.cmd
   ```

4. **View service status:**
   ```cmd
   docker compose -f infra\control-plane\docker-compose.yml ps
   ```

## ✅ Pre-Launch Checklist

Before starting:
- [ ] Docker Desktop is installed
- [ ] Docker Desktop is running
- [ ] Node.js 22+ is installed
- [ ] At least 8GB RAM available
- [ ] At least 20GB disk space
- [ ] No services on ports 3000, 3001, 4000, 5432, 6379

Ready? Run:
```cmd
START-ALL.cmd
```

---

**Happy Developing! 🚀**

For questions or issues, check the logs and documentation files.
