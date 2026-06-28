Set-Location "C:\DeerpShit\Agentics"

$Compose = @(
  "-f", "C:\DeerpShit\Agentics\docker-compose.yml",
  "-f", "C:\DeerpShit\Agentics\docker-compose.gpu.yml"
)

function Test-Url {
  param(
    [string]$Name,
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $Headers -TimeoutSec 8
    Write-Host "OK   $Name -> $Url [$($r.StatusCode)]" -ForegroundColor Green
  } catch {
    Write-Host "FAIL $Name -> $Url" -ForegroundColor Red
    Write-Host "     $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

Write-Host "`n=== Compose services ===" -ForegroundColor Cyan
docker compose @Compose config --services

Write-Host "`n=== Running containers ===" -ForegroundColor Cyan
docker compose @Compose ps

Write-Host "`n=== Open WebUI ownership guard ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL Open WebUI is not the Agentics compose-owned instance. Run scripts\ensure-agentics-openwebui.ps1 -Repair." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "`n=== Port owners ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Ports}}"

Write-Host "`n=== Frontend checks ===" -ForegroundColor Cyan
Test-Url "Open WebUI frontend" "http://127.0.0.1:3000"
Test-Url "n8n frontend" "http://127.0.0.1:5678"
Test-Url "MinIO console" "http://127.0.0.1:9001"
Test-Url "Grafana frontend" "http://127.0.0.1:3002"

Write-Host "`n=== Backend checks ===" -ForegroundColor Cyan
Test-Url "Ollama backend" "http://127.0.0.1:11434/api/tags"
Test-Url "Chroma backend" "http://127.0.0.1:8001/api/v2/heartbeat"
Test-Url "Tika backend" "http://127.0.0.1:9998/tika"
Test-Url "MinIO health" "http://127.0.0.1:9000/minio/health/live"
Test-Url "PostGraphile GraphQL" "http://127.0.0.1:5000/graphql"

Write-Host "`n=== Docker-internal backend wiring ===" -ForegroundColor Cyan
docker exec ollama ollama list
docker exec ollama nvidia-smi

Write-Host "`nRedis:" -ForegroundColor Cyan
docker exec redis redis-cli ping

Write-Host "`nPostgres:" -ForegroundColor Cyan
docker exec postgres pg_isready -U admin -d project_db

Write-Host "`nOpen WebUI -> Ollama env:" -ForegroundColor Cyan
docker exec open-webui printenv | Select-String "OLLAMA|OPENAI|WEBUI|MODEL"

Write-Host "`n=== Final verdict ===" -ForegroundColor Cyan
Write-Host "If Ollama, Open WebUI, Redis, Postgres, Chroma, Tika, MinIO and n8n show OK, the stack is wired." -ForegroundColor Green
