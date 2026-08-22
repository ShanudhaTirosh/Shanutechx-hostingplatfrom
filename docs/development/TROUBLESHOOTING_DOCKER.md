# 🔧 Docker Connectivity Issue - Troubleshooting Guide

## ⚠️ Current Issue

Docker cannot connect to Docker Hub to download base images. This is preventing the build process.

**Error:** `failed to fetch oauth token: Post "https://auth.docker.io/token": dial tcp: lookup auth.docker.io: no such host`

OR

**Error:** `TLS handshake timeout` when pulling images

## 🔍 Possible Causes

1. **VPN/Proxy blocking Docker Hub**
2. **Firewall blocking Docker traffic**
3. **DNS issues in Docker Desktop**
4. **Network restrictions (corporate/ISP)**
5. **Docker Desktop network driver issues**

## ✅ Solutions to Try

### Solution 1: Restart Docker Desktop

1. **Right-click Docker Desktop icon** in system tray
2. **Select "Quit Docker Desktop"**
3. **Wait 30 seconds**
4. **Start Docker Desktop again**
5. **Wait for it to fully start**
6. **Try again:** `START-ALL.cmd`

### Solution 2: Configure Docker DNS

Docker Desktop might be using a DNS server that's blocking or timing out.

1. **Open Docker Desktop**
2. **Click Settings (gear icon)**
3. **Go to "Docker Engine"**
4. **Add DNS configuration:**

```json
{
  "dns": ["8.8.8.8", "1.1.1.1"],
  "registry-mirrors": [],
  "debug": false,
  "experimental": false
}
```

5. **Click "Apply & Restart"**
6. **Try again:** `START-ALL.cmd`

### Solution 3: Disable VPN Temporarily

If you're using a VPN:

1. **Disconnect VPN**
2. **Restart Docker Desktop**
3. **Try building:** `START-ALL.cmd`
4. **Re-enable VPN after images are downloaded**

Note: Once images are cached, VPN shouldn't be an issue.

### Solution 4: Check Windows Firewall

1. **Open Windows Defender Firewall**
2. **Click "Allow an app through firewall"**
3. **Find "Docker Desktop Backend"**
4. **Ensure both Private and Public are checked**
5. **Click OK**
6. **Restart Docker Desktop**

### Solution 5: Reset Docker Network

1. **Open PowerShell as Administrator**
2. **Run:**
   ```powershell
   wsl --shutdown
   ```
3. **Restart Docker Desktop**
4. **Try again:** `START-ALL.cmd`

### Solution 6: Use Different Network

Try switching to a different network (WiFi/Ethernet/mobile hotspot) to see if it's network-specific.

### Solution 7: Pre-pull Images Manually

Try pulling the required base images one by one:

```cmd
docker pull node:20-alpine
docker pull node:20-bookworm-slim
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull traefik:v3.1
docker pull moby/buildkit:latest
docker pull livekit/livekit-server:latest
```

If any of these succeed, the build might work.

## 🏃 Alternative: Run Without Docker (Development Mode)

If Docker connectivity continues to fail, you can run the services locally for development:

### 1. Install PostgreSQL Locally

Download and install: https://www.postgresql.org/download/windows/

Create database:
```sql
CREATE DATABASE shanutechx;
CREATE USER shanutechx WITH PASSWORD 'shanutechx';
GRANT ALL PRIVILEGES ON DATABASE shanutechx TO shanutechx;
```

### 2. Install Redis Locally

Download: https://github.com/microsoftarchive/redis/releases

Or use WSL:
```bash
wsl sudo service redis-server start
```

### 3. Update Connection Strings

Edit `apps/api/.env`:
```env
DATABASE_URL=postgresql://shanutechx:shanutechx@localhost:5432/shanutechx
REDIS_URL=redis://localhost:6379
```

### 4. Run Services Locally

```cmd
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Dashboard
npm run dev:dashboard

# Terminal 3 - Web
npm run dev:web

# Terminal 4 - Worker
npm run dev:worker
```

Access:
- Dashboard: http://localhost:3000 (development port)
- API: http://localhost:4000

## 📊 Check Docker Network Status

Run these commands to diagnose:

```cmd
# Test Docker connectivity
docker run hello-world

# Check Docker version
docker version

# Check Docker info
docker info

# Test DNS from inside Docker
docker run --rm alpine ping -c 4 google.com

# Test registry access
docker run --rm alpine wget -q -O- https://registry-1.docker.io/v2/
```

## 🔄 Nuclear Option: Reset Docker Desktop

If nothing works:

1. **Open Docker Desktop**
2. **Settings → Troubleshoot**
3. **Click "Clean / Purge data"**
4. **Click "Reset to factory defaults"**
5. **Restart computer**
6. **Start Docker Desktop**
7. **Try again:** `START-ALL.cmd`

⚠️ **Warning:** This deletes all Docker images, containers, and volumes!

## 📝 Check These Logs

If issues persist, check:

```cmd
# Docker Desktop logs
%LOCALAPPDATA%\Docker\log.txt

# Windows Event Viewer
eventvwr.msc → Windows Logs → Application
```

Look for Docker-related errors.

## 🌐 Corporate Network Issues

If you're on a corporate network:

1. **Contact IT** - They may need to whitelist Docker Hub domains:
   - `auth.docker.io`
   - `registry-1.docker.io`
   - `production.cloudflare.docker.com`

2. **Configure Corporate Proxy** in Docker Desktop:
   - Settings → Resources → Proxies
   - Add your proxy settings

3. **Use Corporate Registry Mirror** if available:
   ```json
   {
     "registry-mirrors": ["https://your-corporate-registry.com"]
   }
   ```

## ✅ Next Steps

Once Docker connectivity is fixed:

1. **Run:** `START-ALL.cmd`
2. **Wait** for build (10-15 minutes first time)
3. **Access:** http://localhost:3001

## 🆘 Still Not Working?

If you've tried everything:

1. **Use local development mode** (see Alternative section above)
2. **Check if Docker Hub is down:** https://status.docker.com/
3. **Try a different machine/network**
4. **Share error logs** for further debugging

## 📞 Get Docker Support

- Docker Forums: https://forums.docker.com/
- Docker Desktop Issues: https://github.com/docker/for-win/issues
- Docker Community Slack: https://dockr.ly/comm-slack

---

**Most Common Fix:** Restart Docker Desktop and try again!
