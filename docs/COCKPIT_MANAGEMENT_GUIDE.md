# ShanuTechX Cockpit-Style Server & VPS Management Guide

This guide details the production deployment, security configuration, systemd service units, sudoers rules, and Nginx reverse proxy setup for the ShanuTechX Cockpit Server Management System.

---

## 🛠️ 1. Required System Packages

The Node Agent (`services/node-agent`) interacts directly with Linux OS subsystems. Ensure the following tools are installed on your Ubuntu / Debian server:

```bash
# Update package list and install system management utilities
sudo apt-get update
sudo apt-get install -y \
  systemd \
  systemd-sysv \
  ufw \
  docker.io \
  curl \
  unzip \
  tar \
  util-linux
```

---

## 🛡️ 2. Non-Root Sudoers Security Configuration

**Security Directive**: Never run the Node Agent process as full `root`. Create a dedicated system user `shanutechx-agent` and grant narrowly-scoped sudoers privileges for required management commands.

### Step 1: Create Dedicated System User
```bash
sudo useradd -r -s /bin/false -d /var/lib/shanutechx shanutechx-agent
sudo mkdir -p /var/lib/shanutechx/workspaces
sudo chown -R shanutechx-agent:shanutechx-agent /var/lib/shanutechx
```

### Step 2: Configure Scoped Sudoers Rules
Create `/etc/sudoers.d/shanutechx-agent`:

```sudoers
# Narrowly-scoped sudo privileges for ShanuTechX Node Agent
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl list-units *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl start *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl enable *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl disable *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/useradd *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/userdel *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/usermod *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/passwd *
shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/ufw *
```

Set correct permissions:
```bash
sudo chmod 0440 /etc/sudoers.d/shanutechx-agent
```

---

## ⚙️ 3. Node Agent Systemd Service Setup

Create `/etc/systemd/system/shanutechx-node-agent.service`:

```ini
[Unit]
Description=ShanuTechX Node Agent & Cockpit Management Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=shanutechx-agent
Group=shanutechx-agent
WorkingDirectory=/opt/shanutechx/services/node-agent
Environment=NODE_ENV=production
Environment=AGENT_PORT=5000
Environment=NODE_AGENT_SECRET=your_secure_agent_secret_here
Environment=AGENT_WORKSPACES_DIR=/var/lib/shanutechx/workspaces
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shanutechx-node-agent
```

---

## 🔒 4. Nginx Reverse Proxy & HTTPS TLS Configuration

To securely serve the API and Node Agent behind Nginx with SSL termination:

`/etc/nginx/sites-available/shanutechx-cockpit`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 445 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Rate limiting zone for authentication endpoints
    limit_req zone=login_limit burst=10 nodelay;

    # Platform API proxy
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Interactive Terminal WebSockets (/ws/vps-ssh)
    location /ws/vps-ssh {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

---

## 🔍 5. Security Audit Verification Checklist

- [x] **No Shell String Concatenation**: All OS commands use `execFile` or `spawn` with explicit argument arrays.
- [x] **Regex Whitelisting**:
  - Service names: `/^[a-zA-Z0-9_\-\.]+\.service$|^[a-zA-Z0-9_\-\.]+$/`
  - Linux Usernames: `/^[a-zA-Z0-9_-]{1,32}$/`
  - Port Numbers: `1 <= port <= 65535`
  - Firewall Protocols: `tcp` | `udp`
- [x] **RBAC Enforcement**: All mutating actions require `admin` or `dev` role or verified VPS ownership.
- [x] **Audit Trail**: Every service action, user creation, password reset, container action, and firewall rule change is logged to `prisma.auditLog`.
