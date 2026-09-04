import { env } from '../env';

/**
 * Returns the one-line bash node bootstrap provisioning script (install-agent.sh)
 * used for onboarding compute VPS nodes into ShanuTechX control plane.
 */
export function generateNodeBootstrapScript(customApiUrl?: string): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  const apiUrl = customApiUrl || `https://api.${rootDomain}`;

  return `#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# ShanuTechX Compute Node Automated Provisioning & Onboarding Script
# Autonomous Container Infrastructure Engine
# ------------------------------------------------------------------------------
set -euo pipefail

API_URL="\${1:-${apiUrl}}"
SECRET="\${2:?"Error: Cluster secret is required. Usage: bash install.sh <api_url> <cluster_secret> [label] [role_tags]"}"
LABEL="\${3:-node-$(date +%s)}"
ROLE_TAGS="\${4:-web-hosting,node-hosting,python-hosting}"

echo "============================================================"
echo "🚀 Starting ShanuTechX Compute Node Onboarding..."
echo "============================================================"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script as root (e.g., sudo bash)"
  exit 1
fi

# 1. Install Docker & Curl if missing
if ! command -v curl &> /dev/null; then
  echo "📦 Installing curl..."
  apt-get update && apt-get install -y curl || yum install -y curl || apk add curl
fi

if ! command -v docker &> /dev/null; then
  echo "🐳 Docker not found. Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || service docker start
else
  echo "✅ Docker Engine is already installed."
fi

mkdir -p /srv/compose /var/lib/shanutechx /var/log/shanutechx

# 2. Collect Hardware Specs
CPU_CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 2)
RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 2048)
DISK_GB=$(df -BG / 2>/dev/null | awk 'NR==2 {print $2}' | tr -d 'G' || echo 40)
HOST_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo "📊 Detected Hardware Configuration:"
echo "   - Host IP:    $HOST_IP"
echo "   - CPU Cores:  $CPU_CORES"
echo "   - RAM Memory: \${RAM_MB} MB"
echo "   - Disk Space: \${DISK_GB} GB"
echo "   - Role Tags:  $ROLE_TAGS"

# 3. Self-Register with Control Plane API
echo "🔗 Registering Compute Node with Control Plane ($API_URL)..."
TAG_JSON=$(echo "$ROLE_TAGS" | tr ',' '\n' | sed 's/^/"/' | sed 's/$/"/' | paste -sd, -)

RESPONSE=$(curl -s -X POST "$API_URL/api/nodes/register" \
  -H "Content-Type: application/json" \
  -d "{
    \\"label\\": \\"$LABEL\\",
    \\"ip\\": \\"$HOST_IP\\",
    \\"secret\\": \\"$SECRET\\",
    \\"cpuCores\\": $CPU_CORES,
    \\"ramMb\\": $RAM_MB,
    \\"diskGb\\": $DISK_GB,
    \\"roleTags\\": [$TAG_JSON]
  }")

echo "✅ Registration Response: $RESPONSE"

# 4. Start ShanuTechX Production Node Agent Container
echo "🐳 Launching ShanuTechX Node Agent Service on Port 5000..."
docker stop shanutechx-agent &>/dev/null || true
docker rm shanutechx-agent &>/dev/null || true

if docker pull ghcr.io/shanutechx/node-agent:latest &>/dev/null; then
  AGENT_IMAGE="ghcr.io/shanutechx/node-agent:latest"
else
  AGENT_IMAGE="node:20-alpine"
fi

docker run -d \
  --name shanutechx-agent \
  --restart always \
  -p 5000:5000 \
  -e AGENT_PORT=5000 \
  -e NODE_AGENT_SECRET="$SECRET" \
  -e API_URL="$API_URL" \
  -e ROOT_DOMAIN="${rootDomain}" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /srv/compose:/srv/compose \
  -v /var/lib/shanutechx:/var/lib/shanutechx \
  "$AGENT_IMAGE" sh -c "if [ -f /opt/shanutechx/services/node-agent/src/index.js ]; then node /opt/shanutechx/services/node-agent/src/index.js; elif [ -f /repo/services/node-agent/src/index.js ]; then node /repo/services/node-agent/src/index.js; else echo 'Node Agent entry file not found'; exit 1; fi"

echo "============================================================"
echo "🎉 SUCCESS: Compute Node is onboarded & ONLINE in ShanuTechX!"
echo "============================================================"
`;
}
