# ShanuTechX - Complete Stack Startup Script
# This script sets up and runs the entire application with Docker Compose

Write-Host "🚀 ShanuTechX - Complete Stack Setup & Launch" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
$ErrorActionPreference = "SilentlyContinue"
$dockerVersion = docker --version 2>&1
$ErrorActionPreference = "Continue"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Docker not found! Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "  Download: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check Docker Compose
$ErrorActionPreference = "SilentlyContinue"
$composeVersion = docker compose version 2>&1
$ErrorActionPreference = "Continue"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker Compose found: $composeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Compose not found!" -ForegroundColor Red
    exit 1
}

# Check if Docker daemon is running
$ErrorActionPreference = "SilentlyContinue"
docker ps 2>&1 | Out-Null
$dockerRunning = $LASTEXITCODE
$ErrorActionPreference = "Continue"

if ($dockerRunning -eq 0) {
    Write-Host "✓ Docker daemon is running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker daemon is not running! Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check Node.js
$ErrorActionPreference = "SilentlyContinue"
$nodeVersion = node --version 2>&1
$ErrorActionPreference = "Continue"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js not found! Please install Node.js 22+ first." -ForegroundColor Red
    exit 1
}

# Verify configuration files
Write-Host "`n📝 Verifying configuration files..." -ForegroundColor Yellow

$requiredFiles = @(
    "apps/api/.env",
    "apps/dashboard/.env",
    "infra/control-plane/.env",
    "infra/control-plane/docker-compose.yml"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing!" -ForegroundColor Red
        exit 1
    }
}

# Check if node_modules exists
Write-Host "`n📦 Checking dependencies..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "⚠ Dependencies not installed. Installing now..." -ForegroundColor Yellow
    Write-Host "This may take several minutes..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

# Generate Prisma client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to generate Prisma client!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Prisma client generated" -ForegroundColor Green

# Stop any running containers
Write-Host "`n🛑 Stopping any existing containers..." -ForegroundColor Yellow
Set-Location infra/control-plane
docker compose down --remove-orphans 2>$null
Set-Location ../..

# Start the stack
Write-Host "`n🚀 Starting all services with Docker Compose..." -ForegroundColor Cyan
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  • Start PostgreSQL database" -ForegroundColor White
Write-Host "  • Start Redis for queues" -ForegroundColor White
Write-Host "  • Start Traefik reverse proxy" -ForegroundColor White
Write-Host "  • Build and start API server" -ForegroundColor White
Write-Host "  • Build and start Worker service" -ForegroundColor White
Write-Host "  • Build and start Dashboard (Next.js)" -ForegroundColor White
Write-Host "  • Build and start Web (Marketing site)" -ForegroundColor White
Write-Host "  • Build and start WhatsApp Bot" -ForegroundColor White
Write-Host "  • Build and start Discord Bot" -ForegroundColor White
Write-Host "  • Build and start Node Agent" -ForegroundColor White
Write-Host "  • Build and start BuildKit" -ForegroundColor White
Write-Host "  • Build and start LiveKit Server (optional)" -ForegroundColor White
Write-Host ""

Set-Location infra/control-plane

# Build images first
Write-Host "📦 Building Docker images (this may take 10-15 minutes on first run)..." -ForegroundColor Yellow
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to build Docker images!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# Start services
Write-Host "`n🎬 Starting all services..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start services!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Set-Location ../..

Write-Host "`n⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Run database migrations
Write-Host "`n🗄️  Running database migrations..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Migration failed, but services are running. You may need to run migrations manually." -ForegroundColor Yellow
} else {
    Write-Host "✓ Database migrations completed" -ForegroundColor Green
}

# Show service status
Write-Host "`n📊 Service Status:" -ForegroundColor Cyan
docker compose -f infra/control-plane/docker-compose.yml ps

Write-Host "`n✨ All services are starting up!" -ForegroundColor Green
Write-Host "`n🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "  • API:        http://localhost:4000" -ForegroundColor White
Write-Host "  • Dashboard:  http://localhost:3001" -ForegroundColor White
Write-Host "  • Web:        http://localhost:3000" -ForegroundColor White
Write-Host "  • API Health: http://localhost:4000/api/health" -ForegroundColor White

Write-Host "`n📝 Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:           docker compose -f infra/control-plane/docker-compose.yml logs -f" -ForegroundColor White
Write-Host "  View specific logs:  docker compose -f infra/control-plane/docker-compose.yml logs -f api" -ForegroundColor White
Write-Host "  Stop all:            .\STOP-ALL.ps1" -ForegroundColor White
Write-Host "  Check status:        .\STATUS.ps1" -ForegroundColor White
Write-Host "  View logs helper:    .\VIEW-LOGS.ps1 [service-name]" -ForegroundColor White

Write-Host "`n💡 Tips:" -ForegroundColor Cyan
Write-Host "  • First startup may take 5-10 minutes for all services to be ready" -ForegroundColor Yellow
Write-Host "  • Check logs if a service isn't responding: .\VIEW-LOGS.ps1 [service-name]" -ForegroundColor Yellow
Write-Host "  • Run .\STATUS.ps1 to check if everything is healthy" -ForegroundColor Yellow

Write-Host "`n🎉 Setup complete! Your ShanuTechX platform is running!" -ForegroundColor Green
Write-Host ""
