# 🚀 ShanuTechX - Complete Running Guide

This guide will help you run the entire ShanuTechX platform with all services using Docker.

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Docker Desktop** installed and running
  - Download: https://www.docker.com/products/docker-desktop
  - Version: Latest stable version
  
- ✅ **Node.js** v22 or higher
  - Download: https://nodejs.org/
  
- ✅ **Git** (if cloning the repository)

- ✅ At least **8GB RAM** available for Docker
- ✅ At least **20GB disk space** for images and volumes

## 🎯 Quick Start (Recommended)

### 1. Start Everything

```powershell
.\START-ALL.ps1
```

This single command will:
- ✓ Check all prerequisites
- ✓ Verify configuration files
- ✓ Install dependencies (if needed)
- ✓ Generate Prisma client
- ✓ Build all Docker images
- ✓ Start all services
- ✓ Run database migrations
- ✓ Show service status

**First run takes 10-15 minutes** due to Docker image building.

### 2. Check Status

```powershell
.\STATUS.ps1
```

Shows:
- Container status
- Health checks
- Access URLs

### 3. View Logs

```powershell
# All services
.\VIEW-LOGS.ps1

# Specific service
.\VIEW-LOGS.ps1 api
.\VIEW-LOGS.ps1 dashboard
.\VIEW-LOGS.ps1 postgres
```

### 4. Stop Everything

```powershell
.\STOP-ALL.ps1
```

## 🌐 Access URLs

Once running, access these URLs:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3001 | Main admin/customer dashboard |
| **API** | http://localhost:4000 | REST API server |
| **Web** | http://localhost:3000 | Marketing/landing website |
| **API Health** | http://localhost:4000/api/health | Health check endpoint |

## 🏗️ Stack Architecture

The complete stack includes:

### Core Services
- **PostgreSQL** - Main database (port 5432)
- **Redis** - Queue system for background jobs (port 6379)
- **Traefik** - Reverse proxy (ports 80, 443)

### Application Services
- **API** - Express REST API server (port 4000)
- **Worker** - Background job processor (no exposed port)
- **Dashboard** - Next.js customer/admin UI (port 3001)
- **Web** - Marketing website (port 3000)

### Bot Services
- **WhatsApp Bot** - Customer support bot (internal only)
- **Discord Bot** - Team notifications (internal only)

### Infrastructure Services
- **Node Agent** - VPS management agent (port 5000)
- **BuildKit** - Docker build system (internal)
- **LiveKit Server** - Video/audio rooms (optional)

## 📁 Configuration Files

All configuration is handled by these files:

```
apps/api/.env                    # API server configuration
apps/dashboard/.env              # Dashboard environment
infra/control-plane/.env         # Docker Compose configuration
services/whatsapp-bot/.env       # WhatsApp bot settings
services/discord-bot/.env        # Discord bot settings
```

## 🔧 Common Tasks

### Rebuild a Service

If you make changes to code:

```powershell
# Rebuild specific service
.\REBUILD.ps1 api
.\REBUILD.ps1 dashboard

# Rebuild everything
.\REBUILD.ps1
```

### Run Database Migrations

```powershell
npm run db:migrate
```

### Reset Database (⚠️ Deletes all data)

```powershell
# Stop services
.\STOP-ALL.ps1

# Remove database volume
docker volume rm control-plane_postgres-data

# Restart
.\START-ALL.ps1
```

### Access Database Directly

```powershell
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx
```

### Access Container Shell

```powershell
docker exec -it shanutechx-api sh
docker exec -it shanutechx-dashboard sh
```

## 🐛 Troubleshooting

### Services Won't Start

1. **Check Docker is running:**
   ```powershell
   docker ps
   ```

2. **Check logs for errors:**
   ```powershell
   .\VIEW-LOGS.ps1
   ```

3. **Restart Docker Desktop** and try again

### Port Already in Use

If you see "port is already allocated":

1. **Find what's using the port:**
   ```powershell
   netstat -ano | findstr :4000
   netstat -ano | findstr :3001
   ```

2. **Stop the conflicting service** or change the port in docker-compose.yml

### Database Connection Errors

1. **Wait longer** - PostgreSQL takes 30-60 seconds to start
2. **Check PostgreSQL logs:**
   ```powershell
   .\VIEW-LOGS.ps1 postgres
   ```

3. **Verify DATABASE_URL in apps/api/.env:**
   ```
   DATABASE_URL=postgresql://shanutechx:shanutechx@postgres:5432/shanutechx
   ```

### Build Failures

1. **Clear Docker cache:**
   ```powershell
   docker system prune -af
   docker volume prune -f
   ```

2. **Rebuild from scratch:**
   ```powershell
   .\STOP-ALL.ps1
   .\START-ALL.ps1
   ```

### API Returns 502/503

The API needs time to:
1. Wait for database to be ready
2. Run migrations
3. Start the Express server

**Solution:** Wait 2-3 minutes and refresh. Check logs:
```powershell
.\VIEW-LOGS.ps1 api
```

### Dashboard Shows "Cannot connect to API"

1. **Verify API is running:**
   ```powershell
   curl http://localhost:4000/api/health
   ```

2. **Check NEXT_PUBLIC_API_BASE_URL in apps/dashboard/.env:**
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   ```

3. **Rebuild dashboard:**
   ```powershell
   .\REBUILD.ps1 dashboard
   ```

## 🔍 Health Checks

### Check All Services

```powershell
.\STATUS.ps1
```

### Individual Health Endpoints

```powershell
# API
curl http://localhost:4000/api/health

# Dashboard (should return HTML)
curl http://localhost:3001

# Web (should return HTML)
curl http://localhost:3000
```

### Docker Health Status

```powershell
docker compose -f infra/control-plane/docker-compose.yml ps
```

Healthy services show `healthy` in the STATUS column.

## 📊 Monitoring

### View Real-Time Logs

```powershell
# All services
docker compose -f infra/control-plane/docker-compose.yml logs -f

# Multiple services
docker compose -f infra/control-plane/docker-compose.yml logs -f api worker

# Last 50 lines only
docker compose -f infra/control-plane/docker-compose.yml logs -f --tail=50 api
```

### Container Stats (CPU/RAM)

```powershell
docker stats
```

### Disk Usage

```powershell
docker system df
```

## 🔄 Development Workflow

### Making Code Changes

1. **Edit code** in your IDE
2. **Rebuild the affected service:**
   ```powershell
   .\REBUILD.ps1 api
   ```
3. **Watch logs:**
   ```powershell
   .\VIEW-LOGS.ps1 api
   ```

### Running Tests

```powershell
# Unit tests
npm run test:unit

# Inside a container
docker exec -it shanutechx-api npm test
```

### Database Changes

1. **Update Prisma schema** in `packages/db/prisma/schema.prisma`
2. **Generate client:**
   ```powershell
   npm run db:generate
   ```
3. **Create migration:**
   ```powershell
   npm run db:migrate
   ```
4. **Rebuild API:**
   ```powershell
   .\REBUILD.ps1 api
   ```

## 🎛️ Advanced Commands

### Shell into Running Container

```powershell
# API container
docker exec -it shanutechx-api sh

# Database container
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx

# Dashboard container
docker exec -it dashboard sh
```

### Export Database

```powershell
docker exec shanutechx-postgres pg_dump -U shanutechx shanutechx > backup.sql
```

### Import Database

```powershell
Get-Content backup.sql | docker exec -i shanutechx-postgres psql -U shanutechx shanutechx
```

### View Environment Variables in Container

```powershell
docker exec shanutechx-api env
```

### Restart Single Service

```powershell
docker compose -f infra/control-plane/docker-compose.yml restart api
docker compose -f infra/control-plane/docker-compose.yml restart dashboard
```

### Scale Services (if needed)

```powershell
docker compose -f infra/control-plane/docker-compose.yml up -d --scale worker=3
```

## 🧹 Cleanup

### Remove All Containers

```powershell
.\STOP-ALL.ps1
```

### Remove All Volumes (⚠️ Deletes data)

```powershell
docker compose -f infra/control-plane/docker-compose.yml down -v
```

### Clean Docker System

```powershell
# Remove unused images
docker image prune -a

# Remove everything unused
docker system prune -af --volumes
```

## 📚 Additional Resources

- **Main README:** [README.md](README.md)
- **API Documentation:** Check `/api/docs` endpoint (if configured)
- **Prisma Studio:** `npx prisma studio` (from packages/db)

## 🆘 Getting Help

If you encounter issues:

1. **Check this guide** for troubleshooting steps
2. **View service logs** with `.\VIEW-LOGS.ps1`
3. **Check service status** with `.\STATUS.ps1`
4. **Review configuration files** in `.env` files

## ✅ Verification Checklist

After starting, verify:

- [ ] All containers are running: `docker compose ps`
- [ ] PostgreSQL is healthy
- [ ] Redis is healthy
- [ ] API health endpoint responds: `curl http://localhost:4000/api/health`
- [ ] Dashboard loads: http://localhost:3001
- [ ] Web loads: http://localhost:3000
- [ ] No errors in logs: `.\VIEW-LOGS.ps1`

## 🎉 Success!

If all services are running and responding, you're ready to use ShanuTechX!

**Next Steps:**
1. Create your first admin user (see API documentation)
2. Configure your first VPS node
3. Deploy an application from the catalog

---

**Need help?** Check the logs first: `.\VIEW-LOGS.ps1 [service-name]`
