# 🏠 Local Development - ShanuTechX Platform

Welcome to the ShanuTechX local development environment! This guide will help you get the platform running on your Windows machine in minutes.

---

## 📚 Documentation Quick Links

Choose your path based on your needs:

| Document | Best For | Time Required |
|----------|----------|---------------|
| **[QUICK_START.md](QUICK_START.md)** | "Just get it running NOW!" | ⚡ 5 minutes |
| **[LOCAL_SETUP_GUIDE.md](LOCAL_SETUP_GUIDE.md)** | Complete setup with explanations | 📖 15-20 minutes |
| **[README.md](README.md)** | Understanding the full platform | 📚 30+ minutes |

---

## ⚡ Super Quick Start

### For the Impatient Developer

**1. Run the setup script:**
```cmd
setup-local.cmd
```

**2. Edit configuration:**
- `apps\api\.env` - Set database URL
- `apps\dashboard\.env` - Set API URL

**3. Start the servers:**
```cmd
start-dev.cmd
```
Choose option **3** (API + Dashboard)

**4. Open your browser:**
- Dashboard: http://localhost:3000
- API: http://localhost:4000

**Done! ✅**

---

## 🎯 What Gets Installed?

### Infrastructure (Docker Containers)
- **PostgreSQL 16** - Main database (Port 5432)
- **Redis 7** - Queue & caching (Port 6379)

### Applications (Node.js)
- **API Server** - Express REST API (Port 4000)
- **Dashboard** - Next.js admin interface (Port 3000)
- **Web** - Marketing website (Port 3001)
- **Worker** - Background job processor
- **WhatsApp Bot** - Customer support (Port 4100)
- **Discord Bot** - Team notifications (Port 4200)
- **Node Agent** - Deployment handler (Port 5000)

---

## 🛠️ Development Workflow

### Daily Workflow

```cmd
# Morning: Start infrastructure
docker-compose -f docker-compose.local.yml up -d

# Start your work
npm run dev:api        # In Terminal 1
npm run dev:dashboard  # In Terminal 2

# Make changes, test, repeat...

# Evening: Stop everything
docker-compose -f docker-compose.local.yml down
```

### Quick Commands

```cmd
# Check what's running
docker ps
tasklist | findstr node

# Restart database
docker restart shanutechx-postgres

# View logs
docker logs -f shanutechx-postgres
docker logs -f shanutechx-redis

# Reset database
npm run db:migrate

# View database in browser
npx prisma studio
```

---

## 🗂️ Project Structure

```
shanutechx/
│
├── 📄 QUICK_START.md          ← Start here (5 min)
├── 📄 LOCAL_SETUP_GUIDE.md    ← Detailed guide
├── 📄 README.md               ← Full documentation
│
├── 🚀 setup-local.cmd         ← Automated setup script
├── 🎮 start-dev.cmd           ← Server launcher
├── 🐳 docker-compose.local.yml ← Local Docker setup
│
├── 📁 apps/
│   ├── api/                   ← REST API Server
│   │   ├── .env              ← API configuration
│   │   └── src/              ← Source code
│   │
│   ├── dashboard/            ← Admin Dashboard
│   │   ├── .env              ← Dashboard config
│   │   └── app/              ← Next.js pages
│   │
│   └── web/                  ← Marketing site
│
├── 📁 services/
│   ├── node-agent/           ← Deployment engine
│   ├── whatsapp-bot/         ← WhatsApp support
│   └── discord-bot/          ← Discord alerts
│
├── 📁 packages/
│   ├── db/                   ← Prisma database
│   └── @shanutechx/          ← Custom SDK
│
├── 📁 templates/             ← 500+ app templates
│   ├── n8n.yaml
│   ├── supabase.yaml
│   └── ... 500 more
│
└── 📁 infra/
    ├── control-plane/        ← Production setup
    └── node-stack/           ← VPS node setup
```

---

## 🔌 Service Dependencies

```
┌─────────────────────────────────────────────┐
│  Dashboard (Port 3000)                      │
│  Next.js Web Interface                      │
└────────────────┬────────────────────────────┘
                 │ HTTP Requests
                 │
┌────────────────▼────────────────────────────┐
│  API Server (Port 4000)                     │
│  Express + Prisma + JWT Auth                │
└───┬──────────┬──────────┬───────────────────┘
    │          │          │
    │          │          │
┌───▼────┐ ┌──▼─────┐ ┌──▼──────┐
│ PostgreSQL│ │  Redis   │ │ Services  │
│ (5432)  │ │ (6379) │ │ (Bots)  │
└─────────┘ └────────┘ └─────────┘
```

---

## ⚙️ Configuration Checklist

### Minimum Required (apps/api/.env)
- [x] `DATABASE_URL` - PostgreSQL connection
- [x] `REDIS_URL` - Redis connection
- [x] `SECRETS_ENCRYPTION_KEY` - For encrypting credentials
- [x] `PROJECT_AUTH_JWT_SECRET` - For JWT tokens

### Optional but Recommended
- [ ] `FIREBASE_*` - For authentication
- [ ] `LEASEWEB_API_KEY` - For VPS management
- [ ] `STRIPE_*` - For billing features
- [ ] `CLOUDFLARE_*` - For DNS management
- [ ] `GEMINI_API_KEY` - For AI features

### Dashboard (apps/dashboard/.env)
- [x] `NEXT_PUBLIC_API_BASE_URL` - API endpoint
- [ ] `NEXT_PUBLIC_FIREBASE_*` - Firebase config

---

## 🧪 Testing Your Setup

### 1. Test Database Connection
```cmd
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx -c "SELECT version();"
```

### 2. Test API Health
```cmd
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Test Dashboard
Open: http://localhost:3000

You should see the login page.

### 4. Create a Test User
```cmd
curl -X POST http://localhost:4000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"password123\",\"name\":\"Test User\"}"
```

---

## 🐛 Common Issues & Solutions

### Issue: "Port 4000 is already in use"

**Solution:**
```cmd
# Find what's using the port
netstat -ano | findstr :4000

# Kill it (replace <PID> with actual number)
taskkill /PID <PID> /F
```

### Issue: "Cannot connect to database"

**Solution:**
```cmd
# Check if PostgreSQL is running
docker ps | findstr postgres

# If not running, start it
docker start shanutechx-postgres

# Wait 5 seconds, then test connection
timeout /t 5 /nobreak
docker exec -it shanutechx-postgres pg_isready -U shanutechx
```

### Issue: "Prisma Client not generated"

**Solution:**
```cmd
npm run db:generate
```

### Issue: "Module not found" errors

**Solution:**
```cmd
# Clean reinstall
rmdir /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

### Issue: Docker won't start

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Try again

---

## 📊 Monitoring Your Local Setup

### View Running Containers
```cmd
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Container Logs
```cmd
# PostgreSQL
docker logs -f shanutechx-postgres

# Redis
docker logs -f shanutechx-redis
```

### Check Node Processes
```cmd
tasklist | findstr node
```

### Database GUI (Prisma Studio)
```cmd
npx prisma studio
```
Opens at: http://localhost:5555

---

## 🎓 Learning Path

### Day 1: Get it Running
1. ✅ Follow QUICK_START.md
2. ✅ Start API + Dashboard
3. ✅ Create a test user
4. ✅ Explore the dashboard

### Day 2: Understand the Code
1. Read the main README.md
2. Explore the API routes in `apps/api/src/routes/`
3. Check the database schema in `packages/db/prisma/schema.prisma`

### Day 3: Make Changes
1. Modify a route
2. Add a new API endpoint
3. Update the dashboard UI

### Day 4: Deploy Something
1. Look at templates in `templates/`
2. Set up the Node Agent
3. Deploy a template locally

---

## 🚀 Ready for Production?

When you're ready to deploy:

1. **Read:** `docs/deployment/` for deployment guides
2. **Configure:** Environment variables for production
3. **Use:** `infra/control-plane/docker-compose.yml`
4. **Set up:** SSL certificates with Let's Encrypt
5. **Monitor:** Set up logging and monitoring

---

## 🔗 Useful Links

| Resource | URL |
|----------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:4000 |
| API Health | http://localhost:4000/api/health |
| Prisma Studio | http://localhost:5555 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## 💡 Pro Tips

1. **Use separate terminals** for each service so you can see logs
2. **Keep Docker Desktop running** - everything depends on it
3. **Use Prisma Studio** for quick database inspection
4. **Check logs first** when something breaks
5. **Commit `.env.example`** but never `.env`

---

## 🆘 Getting Help

1. **Check the logs** - most errors are visible there
2. **Read error messages** - they usually tell you what's wrong
3. **Check PORT availability** - make sure nothing else is using 4000, 3000, 5432, 6379
4. **Restart Docker** - sometimes that's all you need
5. **Clean reinstall** - when in doubt, `npm install` again

---

## 📝 Next Steps

1. ✅ Set up your local environment
2. ✅ Create a test user
3. ✅ Explore the dashboard
4. 📖 Read the API documentation
5. 🔧 Set up optional services (Firebase, Stripe, etc.)
6. 🎨 Customize the dashboard
7. 🚀 Deploy your first template
8. 📦 Build something awesome!

---

<div align="center">
  <strong>Happy Coding! 🎉</strong><br/>
  <em>Questions? Check LOCAL_SETUP_GUIDE.md for detailed explanations</em>
</div>
