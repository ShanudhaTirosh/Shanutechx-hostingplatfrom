@echo off
REM ShanuTechX - Health Check Script
echo.
echo ========================================
echo  ShanuTechX Health Check
echo ========================================
echo.

echo Docker Status:
docker compose -f infra\control-plane\docker-compose.yml ps
echo.

echo ========================================
echo  Testing Endpoints
echo ========================================
echo.

echo Testing API Health...
curl -s http://localhost:4000/api/health
if %errorlevel% equ 0 (
    echo [OK] API is responding
) else (
    echo [FAIL] API is not responding
)
echo.

echo Testing Dashboard...
curl -s -I http://localhost:3001 | findstr "HTTP"
if %errorlevel% equ 0 (
    echo [OK] Dashboard is responding
) else (
    echo [FAIL] Dashboard is not responding
)
echo.

echo Testing Web...
curl -s -I http://localhost:3000 | findstr "HTTP"
if %errorlevel% equ 0 (
    echo [OK] Web is responding
) else (
    echo [FAIL] Web is not responding
)
echo.

echo ========================================
echo  Access URLs
echo ========================================
echo   API:        http://localhost:4000
echo   Dashboard:  http://localhost:3001
echo   Web:        http://localhost:3000
echo   Health:     http://localhost:4000/api/health
echo.
pause
