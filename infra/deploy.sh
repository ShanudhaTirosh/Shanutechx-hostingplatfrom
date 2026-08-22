#!/usr/bin/env bash
# ==============================================================================
# ShanuTechX Platform — Deployment Automation Script
#
# Usage:
#   ./infra/deploy.sh [--control-plane|--node|--all]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 ShanuTechX Deployment Automation"
echo "===================================="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting."; exit 1; }

DEPLOY_MODE="${1:---control-plane}"

if [ "${DEPLOY_MODE}" == "--control-plane" ] || [ "${DEPLOY_MODE}" == "--all" ]; then
    echo "📦 Deploying Control Plane Stack..."
    cd "${ROOT_DIR}/infra/control-plane"

    if [ ! -f .env ]; then
        echo "⚠️ .env not found in infra/control-plane/. Copying from .env.example..."
        cp .env.example .env
        echo "❗ Please edit infra/control-plane/.env with your production credentials before continuing."
    fi

    echo "🔨 Building control-plane images and starting stack..."
    docker compose up -d --build

    echo "🔄 Running Prisma Database Migrations..."
    docker compose exec api npx prisma migrate deploy

    echo "✅ Control Plane deployed successfully!"
fi

if [ "${DEPLOY_MODE}" == "--node" ] || [ "${DEPLOY_MODE}" == "--all" ]; then
    echo "📦 Deploying Node Stack..."
    cd "${ROOT_DIR}/infra/node-stack"

    if [ ! -f .env ]; then
        echo "⚠️ .env not found in infra/node-stack/. Copying from .env.example..."
        cp .env.example .env
        echo "❗ Please edit infra/node-stack/.env with your node secrets before continuing."
    fi

    echo "🔨 Starting node-stack services..."
    docker compose up -d

    echo "✅ Node Stack deployed successfully!"
fi

echo "===================================="
echo "🎉 ShanuTechX Deployment Complete!"
