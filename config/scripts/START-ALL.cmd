@echo off
REM ShanuTechX - Complete Stack Startup Script
echo.
echo ========================================
echo  ShanuTechX - Complete Stack Setup
echo ========================================
echo.

REM Check Docker
echo Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker not found! Please install Docker Desktop.
    echo Download: https://www.docker.com/products/docker-desktop
    exit /b 1
)
echo Docker: OK

REM Check Docker Compose
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose not found!
    exit /b 1
)
echo Docker Compose: OK

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found! Please install Node.js 22+
    exit /b 1
)
echo Node.js: OK

echo.
echo ========================================
echo  Installing Dependencies
echo ========================================
echo.

if not exist "node_modules" (
    echo Installing npm packages... This may take several minutes...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        exit /b 1
    )
)

echo.
echo ========================================
echo  Generating Prisma Client
echo ========================================
echo.

call npm run db:generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client!
    exit /b 1
)

echo.
echo ========================================
echo  Stopping Existing Containers
echo ========================================
echo.

cd infra\control-plane
docker compose down --remove-orphans >nul 2>&1
cd ..\..

echo.
echo ========================================
echo  Building Docker Images
echo ========================================
echo  This may take 10-15 minutes on first run...
echo.

cd infra\control-plane
docker compose build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Docker images!
    cd ..\..
    exit /b 1
)

echo.
echo ========================================
echo  Starting All Services
echo ========================================
echo.

docker compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Failed to start services!
    cd ..\..
    exit /b 1
)

cd ..\..

echo.
echo Waiting for services to initialize...
timeout /t 15 /nobreak >nul

echo.
echo ========================================
echo  Running Database Migrations
echo ========================================
echo.

call npm run db:migrate
if %errorlevel% neq 0 (
    echo WARNING: Migration failed. You may need to run it manually.
)

echo.
echo ========================================
echo  Service Status
echo ========================================
echo.

docker compose -f infra\control-plane\docker-compose.yml ps

echo.
echo ========================================
echo  SUCCESS! Platform is Running
echo ========================================
echo.
echo Access URLs:
echo   - API:        http://localhost:4000
echo   - Dashboard:  http://localhost:3001
echo   - Web:        http://localhost:3000
echo   - API Health: http://localhost:4000/api/health
echo.
echo Useful Commands:
echo   - View logs:     docker compose -f infra\control-plane\docker-compose.yml logs -f
echo   - Stop all:      docker compose -f infra\control-plane\docker-compose.yml down
echo   - Check status:  docker compose -f infra\control-plane\docker-compose.yml ps
echo.
echo Tips:
echo   - First startup may take 5-10 minutes for all services to be ready
echo   - Check logs if a service isn't responding
echo   - Wait a few minutes before accessing the URLs
echo.
pause
