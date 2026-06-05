# Docker Model Runner - Windows Setup Check
# Run from the Agentics folder in PowerShell.

$ErrorActionPreference = "Stop"

function Get-EnvOrDefault {
    param(
        [string]$Name,
        [string]$Default
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }
    return $value
}

function Test-HttpEndpoint {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
        Write-Host "[OK] $Name" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$OpenWebUIHost = Get-EnvOrDefault -Name "OPENWEBUI_HOST" -Default "localhost"
$OpenWebUIPort = Get-EnvOrDefault -Name "OPENWEBUI_PORT" -Default "3000"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Docker Model Runner - Integration Check" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Checking Docker Model Runner..." -ForegroundColor Yellow
try {
    docker model status
    $modelsJson = docker model ls --openai | ConvertFrom-Json
    $models = @($modelsJson.data)

    if ($models.Count -eq 0) {
        Write-Host "[FAIL] No Docker Model Runner models found" -ForegroundColor Red
        Write-Host "Open Docker Desktop > Models and pull at least one model." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "[OK] Found $($models.Count) model(s)" -ForegroundColor Green
    foreach ($model in $models) {
        Write-Host "  - $($model.id)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[FAIL] Docker Model Runner check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "Step 2: Creating required directories..." -ForegroundColor Yellow
@(
    "config/webui/pipelines",
    "n8n-workflows",
    "monitoring",
    "data/postgres",
    "data/redis",
    "data/loki",
    "data/grafana"
) | ForEach-Object {
    if (!(Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Host "  Created: $_" -ForegroundColor Green
    }
}
Write-Host "[OK] Directories are present" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Checking project files..." -ForegroundColor Yellow
@(
    "config/webui/pipelines/smart_model_router.py",
    "n8n-workflows/dmr-smart-ai-processing.json",
    "monitoring/dmr-dashboard.json"
) | ForEach-Object {
    if (Test-Path $_) {
        Write-Host "[OK] $_" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Missing $_" -ForegroundColor Yellow
    }
}
Write-Host ""

Write-Host "Step 4: Restarting Open WebUI to pick up mounted pipeline changes..." -ForegroundColor Yellow
try {
    docker compose restart openwebui | Out-Null
    Write-Host "[OK] Open WebUI restarted" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not restart Open WebUI: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Step 5: Verifying services..." -ForegroundColor Yellow
Test-HttpEndpoint -Name "Open WebUI" -Url "http://${OpenWebUIHost}:${OpenWebUIPort}/api/health" | Out-Null
Test-HttpEndpoint -Name "Ollama" -Url "http://localhost:11434/api/tags" | Out-Null
Test-HttpEndpoint -Name "N8N" -Url "http://localhost:5678" | Out-Null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Integration check complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open WebUI: http://localhost:3000"
Write-Host "Smart Router: config/webui/pipelines/smart_model_router.py"
Write-Host "Container DMR endpoint: http://model-runner.docker.internal/v1"
