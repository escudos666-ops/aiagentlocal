Set-Location "C:\DeerpShit\Agentics"

$ComposeFile = "C:\DeerpShit\Agentics\docker-compose.agentics.unified.gpu.yml"
$ComposeDmr = "C:\DeerpShit\Agentics\docker-compose.openwebui-dmr.yml"

function Test-Url {
  param(
    [string]$Name,
    [string]$Url
  )

  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 8
    Write-Host "OK   $Name -> $Url [$($r.StatusCode)]" -ForegroundColor Green
  } catch {
    Write-Host "FAIL $Name -> $Url" -ForegroundColor Red
    Write-Host "     $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

Write-Host "`n=== Unified compose services ===" -ForegroundColor Cyan
docker compose -f $ComposeFile config --services

Write-Host "`n=== Unified compose containers ===" -ForegroundColor Cyan
docker compose -f $ComposeFile ps

Write-Host "`n=== Open WebUI ownership guard ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1" `
  -ComposeFile $ComposeFile $ComposeDmr
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL Open WebUI is not the Agentics compose-owned instance. Run scripts\ensure-agentics-openwebui.ps1 -Repair." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "`n=== Frontend checks ===" -ForegroundColor Cyan
Test-Url "Open WebUI" "http://127.0.0.1:3000"
Test-Url "n8n" "http://127.0.0.1:5678"
Test-Url "Open Terminal" "http://127.0.0.1:8000"
Test-Url "MinIO Console" "http://127.0.0.1:9001"
Test-Url "Adminer" "http://127.0.0.1:8088"
Test-Url "Grafana" "http://127.0.0.1:3002"
Test-Url "WAHA" "http://127.0.0.1:3001"

Write-Host "`n=== Backend checks ===" -ForegroundColor Cyan
Test-Url "Ollama" "http://127.0.0.1:11434/api/tags"
Test-Url "Chroma" "http://127.0.0.1:8001/api/v2/heartbeat"
Test-Url "Tika" "http://127.0.0.1:9998/tika"
Test-Url "MinIO Health" "http://127.0.0.1:9000/minio/health/live"

Write-Host "`n=== PostGraphile POST check ===" -ForegroundColor Cyan
try {
  $body = '{"query":"{ __schema { queryType { name } } }"}'
  $pg = Invoke-RestMethod -Uri "http://127.0.0.1:5000/graphql" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 8
  Write-Host "OK   PostGraphile GraphQL POST -> http://127.0.0.1:5000/graphql" -ForegroundColor Green
  $pg | ConvertTo-Json -Depth 10
} catch {
  Write-Host "FAIL PostGraphile GraphQL POST" -ForegroundColor Red
  Write-Host "     $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "`n=== Internal service checks ===" -ForegroundColor Cyan
docker exec redis redis-cli ping
docker exec postgres pg_isready -U admin -d project_db
docker exec ollama ollama list
docker exec ollama nvidia-smi

Write-Host "`n=== Open WebUI backend env ===" -ForegroundColor Cyan
docker exec open-webui printenv | Select-String "OLLAMA|OPENAI|WEBUI|MODEL"

Write-Host "`n=== Port owners ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Ports}}"
