# 🚀 DEPLOY NOW - Quick Start Guide

## ✅ Everything is Ready!

Your environment is fully configured with:
- ✅ Firebase credentials
- ✅ Cloudflare API token
- ✅ All security secrets
- ✅ VPS IP: 13.229.204.128
- ✅ SSH key: LightsailDefaultKey-ap-southeast-1.pem
- ✅ 40 new features ready to deploy

---

## 🎯 One-Command Deployment

### Option 1: PowerShell Script (Recommended)

```powershell
.\deploy-direct.ps1
```

This will:
1. ✅ Commit your changes
2. ✅ Push to GitHub
3. ✅ SSH to your VPS (13.229.204.128)
4. ✅ Pull latest code
5. ✅ Install dependencies
6. ✅ Run database migrations
7. ✅ Build Docker containers
8. ✅ Start all services
9. ✅ Verify deployment

**Time:** ~5-10 minutes

---

### Option 2: Manual SSH (If script fails)

```powershell
# Connect to VPS
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@13.229.204.128
```

Then run on VPS:

```bash
cd /home/ubuntu/shanutechx

# Pull latest code
git pull origin main

# Install dependencies
npm install --legacy-peer-deps

# Generate Prisma client
npm run db:generate

# Navigate to deployment directory
cd infra/control-plane

# Build and start services
docker compose up -d --build

# Wait for database
sleep 30

# Run migrations
cd /home/ubuntu/shanutechx
npm run db:migrate:deploy

# Check status
cd infra/control-plane
docker compose ps
```

---

## 🔍 Verify Deployment

After deployment completes, run:

```powershell
.\verify-deployment.ps1
```

This checks:
- ✅ API health (https://api.shanutechx.com/api/health)
- ✅ Dashboard (https://app.shanutechx.com)
- ✅ Website (https://shanutechx.com)
- ✅ Docker services status
- ✅ Database connectivity
- ✅ New endpoints accessibility

---

## 🌐 Your Platform URLs

After deployment:

| Service | URL |
|---------|-----|
| **API** | https://api.shanutechx.com |
| **Dashboard** | https://app.shanutechx.com |
| **Website** | https://shanutechx.com |
| **Status Page** | https://app.shanutechx.com/status |

---

## 🎉 New Features Available

Once deployed, you'll have access to:

### 1. **Catalog Management**
- Browse 361+ app templates at `/catalog`
- YAML editor with syntax highlighting
- Create/edit/delete templates (admin/dev only)

### 2. **Custom Domain Management**
- Attach domains to deployments
- Automatic DNS verification
- SSL provisioning via Cloudflare
- Background certificate renewal

### 3. **Deployment Enhancements**
- Real-time resource monitoring (CPU, RAM, disk)
- Live log streaming with filtering
- Environment variable editor
- Resource limits configuration

### 4. **Public Pages**
- Status page at `/status`
- Terms of Service at `/terms`
- Privacy Policy at `/privacy`

### 5. **Mail Account Management**
- Create email accounts with quotas
- Integration with mail server
- Two-phase operations with rollback

### 6. **User Role Management**
- Admin user list at `/admin/users`
- Change user roles (customer/dev/support/admin)
- Search and filter by role
- Audit logging

---

## 👤 Create Your First Admin User

### Step 1: Sign Up
1. Go to https://app.shanutechx.com
2. Click "Sign Up"
3. Enter your email and password
4. Firebase will create your account

### Step 2: Promote to Admin

```bash
# SSH to VPS
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@13.229.204.128

# Access PostgreSQL
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx

# View users
SELECT id, email, "firebaseUid", role FROM "User";

# Promote your user to dev (highest access)
UPDATE "User" SET role = 'dev' WHERE email = 'your-email@example.com';

# Verify
SELECT email, role FROM "User";

# Exit
\q
```

### Step 3: Refresh Dashboard
- Log out and log back in
- You now have full admin/dev access!

---

## 📊 Monitoring Commands

### View All Services
```bash
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@13.229.204.128
cd /home/ubuntu/shanutechx/infra/control-plane
docker compose ps
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f dashboard
docker compose logs -f worker
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api
```

### Check Database
```bash
docker exec shanutechx-postgres pg_isready -U shanutechx
```

---

## 🐛 Troubleshooting

### Issue: Services not starting

```bash
# Check logs
docker compose logs

# Restart services
docker compose down
docker compose up -d --build
```

### Issue: Database migrations fail

```bash
# Check database is ready
docker exec shanutechx-postgres pg_isready -U shanutechx

# Retry migrations
npm run db:migrate:deploy
```

### Issue: API not responding

```bash
# Check API logs
docker compose logs api

# Check if API is running
docker compose ps api

# Restart API
docker compose restart api
```

### Issue: SSL not working

Wait 1-2 minutes for Let's Encrypt to issue certificates.

```bash
# Check Traefik logs
docker logs traefik
```

---

## 🔒 Security Reminder

**IMPORTANT**: Your SSH key was shared in conversation history.

After deployment, **immediately**:

1. Go to AWS Lightsail Console
2. Delete key: `LightsailDefaultKey-ap-southeast-1`
3. Create new key pair
4. Download new `.pem` file
5. Update scripts with new key path

---

## 📚 Documentation

- **Full Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **New Features**: `NEW_FEATURES.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Spec Documentation**: `.kiro/specs/platform-admin-catalog-system/`

---

## ✅ Pre-Flight Checklist

Before running deployment:

- [x] Environment files configured
- [x] SSH key available
- [x] VPS IP confirmed (13.229.204.128)
- [x] DNS records configured
- [x] Cloudflare API token set
- [x] Firebase credentials set
- [x] All 40 tasks completed
- [x] 92 tests passing

---

## 🎯 Ready to Deploy?

Run this command now:

```powershell
.\deploy-direct.ps1
```

Then verify with:

```powershell
.\verify-deployment.ps1
```

---

## 📞 Need Help?

If you encounter issues:

1. Check the logs: `docker compose logs -f`
2. Review `DEPLOYMENT_GUIDE.md` troubleshooting section
3. Run verification script: `.\verify-deployment.ps1`
4. Check service status: `docker compose ps`

---

**Your platform is ready for production deployment! 🚀**

**Estimated deployment time: 5-10 minutes**

**Good luck! 🎉**
