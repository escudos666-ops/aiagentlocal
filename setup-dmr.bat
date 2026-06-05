@echo off
REM Docker Model Runner - Windows Setup (Simple)
REM No PowerShell encoding issues, just simple batch

echo.
echo ============================================================
echo Docker Model Runner - Setup
echo ============================================================
echo.

REM Step 1: Check Python
echo Step 1: Checking Python...
python3 --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python 3 not found
    echo Please install Python 3 from python.org
    pause
    exit /b 1
)
echo OK: Python 3 found
echo.

REM Step 2: Run Python setup
echo Step 2: Running setup...
python3 scripts/setup-simple.py
if errorlevel 1 (
    echo Setup failed
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo Open: http://localhost:3000
echo Start chatting - Smart Router picks best model
echo.
pause
