# ⚡ Quick Start - ShanuTechX Local Development

## 🎯 The Fastest Way to Get Started

### Step 1: Run the Setup Script (First Time Only)

```cmd
setup-local.cmd
```

This will:
- Install all dependencies
- Start PostgreSQL and Redis containers
- Create environment files
- Initialize the database

### Step 2: Configure Environment (First Time Only)

Edit `apps\api\.env` with minimum configuration:

```env
DATABASE_URL="postgresql://shanutechx:shanutechx_dev@localhost:5432/shanutechx?schema=public"
REDIS_URL="redis://localhost:6379"
SECRETS_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
PROJECT_AUTH_JWT_SECRET="your-secret-here"
```

Edit `apps\dashboard\.env`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### Step 3: Start Development Servers

```cmd
start-dev.cmd
```

Choose option **[3]** for API + Dashboard

### Step 4: Access the Application

- **Dashboard:** http://localhost:3000
- **API Health:** http://localhost:4000/api/health

---

## 📦 Alternative: Docker Compose (Easier)

### Start Infrastructure Only (Recommended)

```cmd
docker-compose -f docker-compose.local.yml up -d
```

This starts PostgreSQL and Redis. Then run dev servers:

```cmd
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:dashboard
```

### Start Everything with Docker

```cmd
cd infra\control-plane
copy .env.example .env
REM Edit .env with your configuration
docker-compose up --build
```

---

## 🔧 Common Commands

### Development

```cmd
# API Server (Port 4000)
npm run dev:api

# Dashboard (Port 3000)
npm run dev:dashboard

# Web Landing Page (Port 3001)
npm run dev:web

# Background Worker
npm run dev:worker

# WhatsApp Bot (Port 4100)
npm run dev:whatsapp

# Discord Bot (Port 4200)
npm run dev:discord

# Node Agent (Port 5000)
npm run dev:node-agent
```

### Database

```cmd
# Generate Prisma Client
npm run db:generate

# Run Migrations
npm run db:migrate

# View Database
npx prisma studio
```

### Docker

```cmd
# Start PostgreSQL + Redis
docker-compose -f docker-compose.local.yml up -d

# Stop all containers
docker-compose -f docker-compose.local.yml down

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Restart a service
docker restart shanutechx-postgres
```

---

## 🐛 Quick Fixes

### "Port already in use"

```cmd
# Find process using port 4000
netstat -ano | findstr :4000

# Kill the process (replace <PID>)
taskkill /PID <PID> /F
```

### "Cannot connect to database"

```cmd
# Check if PostgreSQL is running
docker ps | findstr postgres

# Start it if stopped
docker start shanutechx-postgres

# Check logs
docker logs shanutechx-postgres
```

### "Prisma Client not found"

```cmd
npm run db:generate
```

### "Module not found"

```cmd
npm install --legacy-peer-deps
```

### Reset Everything

```cmd
# Stop containers
docker-compose -f docker-compose.local.yml down -v

# Clean install
del /s /q node_modules
npm install --legacy-peer-deps

# Rebuild database
npm run db:generate
npm run db:migrate
```

---

## 📚 Project Structure

```
shanutechx/
├── apps/
│   ├── api/           # Express REST API (Port 4000)
│   ├── dashboard/     # Next.js Admin Dashboard (Port 3000)
│   └── web/           # Marketing Website (Port 3001)
├── services/
│   ├── node-agent/    # VPS Deployment Agent (Port 5000)
│   ├── whatsapp-bot/  # WhatsApp Support Bot (Port 4100)
│   └── discord-bot/   # Discord Notification Bot (Port 4200)
├── packages/
│   ├── db/            # Prisma Schema & Migrations
│   └── @shanutechx/*  # Custom SDK Packages
├── templates/         # 500+ App Templates
└── infra/            # Docker Compose Configs
```

---

## 🎯 What to Do Next?

### 1. Create Your First User

Visit: http://localhost:3000/login

Or use the API:

```cmd
curl -X POST http://localhost:4000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@test.com\",\"password\":\"password123\",\"name\":\"Admin\"}"
```

### 2. Explore the API

Check the health endpoint:
```cmd
curl http://localhost:4000/api/health
```

### 3. Browse the Template Catalog

The `templates/` folder contains 500+ YAML files for deployable apps:
- Supabase, n8n, Ghost, WordPress, Plausible
- Nextcloud, Gitea, Authentik, Grafana
- And many more!

### 4. Set Up Optional Services

**Firebase (for Auth):**
1. Create project at https://console.firebase.google.com
2. Add config to `apps/api/.env` and `apps/dashboard/.env`

**Leaseweb (for VPS Management):**
1. Get API key from https://www.leaseweb.com
2. Add to `apps/api/.env`

**Stripe (for Billing):**
1. Create account at https://stripe.com
2. Add keys to `apps/api/.env`

---

## 📖 Full Documentation

For detailed information, see:
- **LOCAL_SETUP_GUIDE.md** - Complete setup instructions
- **README.md** - Full project documentation
- **docs/** - Additional guides and documentation

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review `LOCAL_SETUP_GUIDE.md`
3. Check Docker logs: `docker logs <container-name>`
4. Review API logs in the terminal

---

**You're all set! Happy coding! 🚀**
