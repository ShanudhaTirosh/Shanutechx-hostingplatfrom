# ShanuTechX Host Node Engine Server & VPS Management Guide

This guide details the production deployment, security configuration, systemd service units, sudoers rules, and Nginx reverse proxy setup for the ShanuTechX Host Node Engine Management System.

---

## 1. Systemd Service Configuration

Save the following file as `/etc/systemd/system/shanutechx-node-agent.service`:

```ini
[Unit]
Description=ShanuTechX Node Agent & Host Node Engine Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=shanutechx-agent
Group=shanutechx-agent
WorkingDirectory=/opt/shanutechx/services/node-agent
EnvironmentFile=/etc/shanutechx-agent.env
Environment=NODE_ENV=production
Environment=AGENT_PORT=5000
Environment=AGENT_WORKSPACES_DIR=/var/lib/shanutechx/workspaces
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

---

## 2. Sudoers Rule Configuration

To allow `shanutechx-agent` to manage system services, users, and UFW firewall rules without full root privileges, create `/etc/sudoers.d/shanutechx-agent`:

```sudoers
# ShanuTechX Node Agent narrowly-scoped sudo privileges
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

Set appropriate file permissions:
```bash
chmod 0440 /etc/sudoers.d/shanutechx-agent
visudo -cf /etc/sudoers.d/shanutechx-agent
```

---

## 3. Node Engine Architecture Overview

- **Host Node Telemetry**: Real-time CPU, RAM, Disk, Load Average, and 30 TB Monthly Bandwidth Quota tracker.
- **Web SSH Terminal**: Integrated xterm.js terminal with direct root shell gateway.
- **System & OS Packages**: Systemd unit management, service logs (`journalctl`), 1-click system upgrades (`apt update && apt upgrade -y`), and custom package installation (`apt install -y <pkg>`).
- **Networking & Firewall**: Active listening ports detector (`ss -tulpn`) and UFW firewall rules manager.
- **Docker Container Engine & Compose**: Full container lifecycle controls, 1-click container creation modal, `docker-compose.yml` stack deployment, Docker network manager, and resource pruning.
- **Linux User Accounts**: User creation, password reset, and group permissions.
