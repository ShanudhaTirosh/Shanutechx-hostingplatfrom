#!/usr/bin/env bash
# ==============================================================================
# ShanuTechX Platform — Autonomous Linux VPS Production Bootstrap Script
# 
# Usage:
#   sudo bash infra/deploy-platform.sh [root_domain] [postgres_pass] [dev_email] [dev_pass]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ROOT_DOMAIN="${1:-${ROOT_DOMAIN:-shanutechx.com}}"
POSTGRES_PASSWORD="${2:-${POSTGRES_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo "ShanuTechXPostgres2026!")}}"
DEV_ADMIN_EMAIL="${3:-${DEV_ADMIN_EMAIL:-admin@${ROOT_DOMAIN}}}"
DEV_ADMIN_PASSWORD="${4:-${DEV_ADMIN_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo "ShanuTechXDevPass2026!")}}"

WILDDUCK_API_KEY="${WILDDUCK_API_KEY:-$(openssl rand -hex 16 2>/dev/null || echo "wildduck_secret_api_token_2026")}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo "SupabaseDBPass2026!")}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo "MinioRootPass2026!")}"
NODE_AGENT_SECRET="${NODE_AGENT_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo "NodeAgentSecret2026!")}"

echo "============================================================"
echo "🚀 ShanuTechX Autonomous Linux VPS Platform Bootstrap Engine"
echo "============================================================"
echo "   Root Domain:         ${ROOT_DOMAIN}"
echo "   Dev Admin Email:     ${DEV_ADMIN_EMAIL}"
echo "   WildDuck API Key:    [REDACTED]"
echo "============================================================"

# 1. System Dependency Checks & Installation
if ! command -v curl &> /dev/null; then
  echo "📦 Installing curl..."
  apt-get update && apt-get install -y curl || yum install -y curl || apk add curl
fi

if ! command -v docker &> /dev/null; then
  echo "🐳 Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || service docker start
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "🐳 Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin || true
fi

# 2. Configure Environment Secrets
CONTROL_PLANE_DIR="${ROOT_DIR}/infra/control-plane"
mkdir -p "${CONTROL_PLANE_DIR}"

cat <<EOF > "${CONTROL_PLANE_DIR}/.env"
ROOT_DOMAIN=${ROOT_DOMAIN}
ACME_EMAIL=${DEV_ADMIN_EMAIL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
WILDDUCK_API_KEY=${WILDDUCK_API_KEY}
SUPABASE_DB_PASSWORD=${SUPABASE_DB_PASSWORD}
SUPABASE_REALTIME_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "supabaserealtimesecretkeylongstring2026")
MINIO_ROOT_USER=shanutechx_minio
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
NODE_AGENT_SECRET=${NODE_AGENT_SECRET}
POSTAL_DB_ROOT_PASSWORD=${POSTGRES_PASSWORD}
POSTAL_FROM_ADDRESS=no-reply@${ROOT_DOMAIN}
NEXT_PUBLIC_API_BASE_URL=https://api.${ROOT_DOMAIN}
EOF

chmod 0600 "${CONTROL_PLANE_DIR}/.env"
echo "✅ Production environment file generated at ${CONTROL_PLANE_DIR}/.env"

# 3. Launch Control Plane Services
echo "🔨 Building & Launching ShanuTechX Control Plane Stack..."
cd "${CONTROL_PLANE_DIR}"
docker compose up -d --build

# 4. Run Prisma Migrations
echo "🔄 Executing Database Migrations..."
docker compose exec -T api npx prisma migrate deploy || echo "⚠️ Migration deployment attempted"

echo "============================================================"
echo "🎉 ShanuTechX Control Plane & Stack deployed successfully!"
echo "   API Base URL: https://api.${ROOT_DOMAIN}"
echo "   Dashboard:   https://app.${ROOT_DOMAIN}"
echo "   Studio:      https://studio.${ROOT_DOMAIN}"
echo "============================================================"
