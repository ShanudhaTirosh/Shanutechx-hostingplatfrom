#!/usr/bin/env pwsh
# ShanuTechX - Rebuild and Restart Script

param(
    [string]$Service = ""
)

Write-Host "🔄 ShanuTechX Rebuild & Restart" -ForegroundColor Cyan

Set-Location infra/control-plane

if ($Service -eq "") {
    Write-Host "Rebuilding all services..." -ForegroundColor Yellow
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    Write-Host "✓ All services rebuilt and restarted" -ForegroundColor Green
} else {
    Write-Host "Rebuilding: $Service..." -ForegroundColor Yellow
    docker compose stop $Service
    docker compose build --no-cache $Service
    docker compose up -d $Service
    Write-Host "✓ $Service rebuilt and restarted" -ForegroundColor Green
}

Set-Location ../..

Write-Host "`nCheck status: .\STATUS.ps1" -ForegroundColor Cyan
