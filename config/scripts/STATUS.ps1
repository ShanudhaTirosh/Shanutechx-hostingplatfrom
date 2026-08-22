#!/usr/bin/env pwsh
# ShanuTechX - Check Status Script

Write-Host "📊 ShanuTechX Service Status" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

Set-Location infra/control-plane

Write-Host "`nContainer Status:" -ForegroundColor Yellow
docker compose ps

Write-Host "`n🌐 Service URLs:" -ForegroundColor Cyan
Write-Host "  • API:        http://localhost:4000" -ForegroundColor White
Write-Host "  • Dashboard:  http://localhost:3001" -ForegroundColor White
Write-Host "  • Web:        http://localhost:3000" -ForegroundColor White
Write-Host "  • Health:     http://localhost:4000/api/health" -ForegroundColor White

Write-Host "`n🔍 Quick Health Checks:" -ForegroundColor Cyan

# Check API health
try {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -TimeoutSec 5 -UseBasicParsing
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "  ✓ API is responding" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ API returned status: $($apiResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ API is not responding" -ForegroundColor Red
}

# Check Dashboard
try {
    $dashResponse = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
    if ($dashResponse.StatusCode -eq 200) {
        Write-Host "  ✓ Dashboard is responding" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Dashboard returned status: $($dashResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Dashboard is not responding" -ForegroundColor Red
}

# Check Web
try {
    $webResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    if ($webResponse.StatusCode -eq 200) {
        Write-Host "  ✓ Web is responding" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Web returned status: $($webResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Web is not responding" -ForegroundColor Red
}

Set-Location ../..

Write-Host "`n📝 View detailed logs: .\VIEW-LOGS.ps1 [service-name]" -ForegroundColor Cyan
Write-Host ""
