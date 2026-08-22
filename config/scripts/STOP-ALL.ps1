#!/usr/bin/env pwsh
# ShanuTechX - Stop All Services Script

Write-Host "🛑 Stopping ShanuTechX Stack..." -ForegroundColor Yellow

Set-Location infra/control-plane

# Stop all containers
docker compose down --remove-orphans

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ All services stopped successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to stop some services" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Set-Location ../..

Write-Host ""
Write-Host "To restart: .\START-ALL.ps1" -ForegroundColor Cyan
