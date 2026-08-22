#!/usr/bin/env pwsh
# ShanuTechX - View Logs Script

param(
    [string]$Service = ""
)

Write-Host "📋 ShanuTechX Logs Viewer" -ForegroundColor Cyan

Set-Location infra/control-plane

if ($Service -eq "") {
    Write-Host "Showing logs for all services (Ctrl+C to exit)..." -ForegroundColor Yellow
    docker compose logs -f --tail=100
} else {
    Write-Host "Showing logs for: $Service (Ctrl+C to exit)..." -ForegroundColor Yellow
    docker compose logs -f --tail=100 $Service
}

Set-Location ../..
