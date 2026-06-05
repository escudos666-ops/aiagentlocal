# Register Personal Agent with Open WebUI (Windows PowerShell)

$OPENWEBUI_URL = "http://localhost:3000"
$PA_API_URL = "http://localhost:8000"
$N8N_URL = "http://localhost:5678"

Write-Host "Registering Martin's Personal Agent with Open WebUI..." -ForegroundColor Cyan

# 1. Register PA as a tool in Open WebUI
Write-Host "`nStep 1: Registering PA Tool..." -ForegroundColor Yellow

$toolData = @{
    name = "personal_agent"
    displayName = "Martin Personal Agent"
    description = "Martins Personal Agent - Execute commands, manage tasks, send messages, and more"
    enabled = $true
    model = "neural-chat:latest"
    endpoint = $PA_API_URL
    auth_required = $false
    tags = @("agent", "personal", "tools")
    icon = "🤖"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$OPENWEBUI_URL/api/tools" `
      -Method POST `
      -ContentType "application/json" `
      -Body $toolData `
      -ErrorAction SilentlyContinue
    Write-Host "OK PA tool registered" -ForegroundColor Green
} catch {
    Write-Host "INFO Tool registration skipped (may already exist)" -ForegroundColor Gray
}

# 2. Test PA connectivity
Write-Host "`nStep 2: Testing PA Connectivity..." -ForegroundColor Yellow

try {
    $healthResponse = Invoke-WebRequest -Uri "$PA_API_URL/health" -ErrorAction Stop | ConvertFrom-Json
    if ($healthResponse.status -eq "healthy") {
        Write-Host "OK PA Service is healthy" -ForegroundColor Green
    } else {
        Write-Host "WARN PA Service status: $($healthResponse.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR PA Service not responding. Make sure it's running:" -ForegroundColor Red
    Write-Host "  docker compose up -d pa-service" -ForegroundColor Red
}

# 3. Test n8n connectivity
Write-Host "`nStep 3: Testing n8n Connectivity..." -ForegroundColor Yellow

try {
    $n8nResponse = Invoke-WebRequest -Uri "$N8N_URL/api/v1/workflows" -ErrorAction Stop | ConvertFrom-Json
    Write-Host "OK n8n is accessible" -ForegroundColor Green
} catch {
    Write-Host "WARN n8n not fully accessible (may still be starting)" -ForegroundColor Yellow
}

# 4. Test Open WebUI connectivity
Write-Host "`nStep 4: Testing Open WebUI Connectivity..." -ForegroundColor Yellow

try {
    $webUIResponse = Invoke-WebRequest -Uri "$OPENWEBUI_URL" -ErrorAction Stop
    Write-Host "OK Open WebUI is accessible" -ForegroundColor Green
} catch {
    Write-Host "WARN Open WebUI not responding" -ForegroundColor Yellow
}

# 5. Display summary
Write-Host "`n" + ("="*70) -ForegroundColor Cyan
Write-Host "Integration Status" -ForegroundColor Green
Write-Host ("="*70) -ForegroundColor Cyan

Write-Host "`nPersonal Agent Endpoints:" -ForegroundColor Yellow
Write-Host "  API: $PA_API_URL"
Write-Host "  Health: $PA_API_URL/health"
Write-Host "  Status: $PA_API_URL/status"
Write-Host "  Process: $PA_API_URL/process"

Write-Host "`nn8n:" -ForegroundColor Yellow
Write-Host "  URL: $N8N_URL"
Write-Host "  Workflows: $N8N_URL/workflows"

Write-Host "`nOpen WebUI:" -ForegroundColor Yellow
Write-Host "  URL: http://localhost:3000"

Write-Host "`nQuick Tests:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:8000/health"
Write-Host "  curl http://localhost:3000"
Write-Host "  docker compose logs pa-service -f"

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in your browser"
Write-Host "  2. Start a chat with neural-chat:latest"
Write-Host "  3. Type: What is your status?"

Write-Host ""
