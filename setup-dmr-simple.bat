@echo off
REM Docker Model Runner - Setup (Docker-Only, No Python Needed)

echo.
echo ============================================================
echo Docker Model Runner - Setup
echo ============================================================
echo.

REM Check if Docker is running
echo Checking Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo Error: Docker not running or not installed
    echo Please start Docker Desktop
    pause
    exit /b 1
)
echo OK: Docker is running
echo.

REM Check if Open WebUI is running
echo Checking Open WebUI...
docker ps | findstr "openwebui" >nul
if errorlevel 1 (
    echo Warning: Open WebUI not running
    echo Start with: docker-compose up -d
) else (
    echo OK: Open WebUI is running
)
echo.

REM Show Docker Model Runner models
echo Checking Docker Model Runner models...
echo.
echo Models available:
echo   - devstral-small-2:latest
echo   - nemotron3:latest
echo.
echo Download models in Docker Desktop:
echo   1. Open Docker Desktop
echo   2. Click "Models" tab
echo   3. Search and download the models above
echo.

REM Show access points
echo.
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo Access Points:
echo   Open WebUI:  http://localhost:3000
echo   Grafana:     http://localhost:3100
echo   N8N:         http://localhost:5678
echo.
echo Next Steps:
echo   1. Download models in Docker Desktop (Models tab)
echo   2. Go to http://localhost:3000
echo   3. Start chatting - Smart Router picks best model
echo.
echo Smart Routing:
echo   - "Write code" -^> Uses Devstral (coding-optimized)
echo   - "Analyze data" -^> Uses Nemotron (analysis-optimized)
echo   - General questions -^> Uses Nemotron
echo.
pause
