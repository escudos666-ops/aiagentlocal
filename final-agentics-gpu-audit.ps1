Set-Location "C:\DeerpShit\Agentics"

$ComposeFile = "C:\DeerpShit\Agentics\docker-compose.agentics.unified.gpu.yml"
$Pass = 0
$Fail = 0

function OK($msg) {
  $script:Pass++
  Write-Host "OK   $msg" -ForegroundColor Green
}

function BAD($msg) {
  $script:Fail++
  Write-Host "FAIL $msg" -ForegroundColor Red
}

function Test-Http {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int[]]$Expected = @(200)
  )

  try {
    if ($Body) {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method $Method -Headers $Headers -ContentType "application/json" -Body $Body -TimeoutSec 12
    } else {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method $Method -Headers $Headers -TimeoutSec 12
    }

    if ($Expected -contains [int]$r.StatusCode) {
      OK "$Name -> $Url [$($r.StatusCode)]"
    } else {
      BAD "$Name -> $Url unexpected status [$($r.StatusCode)]"
    }
  } catch {
    BAD "$Name -> $Url :: $($_.Exception.Message)"
  }
}

Write-Host "`n=== 1. Start unified GPU stack ===" -ForegroundColor Cyan
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -eq 0) { OK "Unified compose up" } else { BAD "Unified compose up" }

Write-Host "`n=== 2. Compose syntax/services ===" -ForegroundColor Cyan
docker compose -f $ComposeFile config --services
if ($LASTEXITCODE -eq 0) { OK "Compose config valid" } else { BAD "Compose config invalid" }

Write-Host "`n=== 2b. Open WebUI ownership guard ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1" `
  -ComposeFile $ComposeFile "C:\DeerpShit\Agentics\docker-compose.openwebui-dmr.yml"
if ($LASTEXITCODE -eq 0) { OK "Open WebUI Agentics ownership guard" } else { BAD "Open WebUI Agentics ownership guard" }

Write-Host "`n=== 3. Frontends ===" -ForegroundColor Cyan
Test-Http "Open WebUI" "http://127.0.0.1:3000"
Test-Http "n8n" "http://127.0.0.1:5678"
Test-Http "Open Terminal docs" "http://127.0.0.1:8000/docs"
Test-Http "MinIO Console" "http://127.0.0.1:9001"
Test-Http "Adminer" "http://127.0.0.1:8088"
Test-Http "Grafana" "http://127.0.0.1:3002"

Write-Host "`n=== 4. Backends ===" -ForegroundColor Cyan
Test-Http "Ollama tags" "http://127.0.0.1:11434/api/tags"
Test-Http "Chroma heartbeat" "http://127.0.0.1:8001/api/v2/heartbeat"
Test-Http "Tika" "http://127.0.0.1:9998/tika"
Test-Http "MinIO health" "http://127.0.0.1:9000/minio/health/live"

Write-Host "`n=== 5. PostGraphile GraphQL POST ===" -ForegroundColor Cyan
$pgBody = '{"query":"{ __schema { queryType { name } } }"}'
Test-Http "PostGraphile GraphQL" "http://127.0.0.1:5000/graphql" "POST" @{} $pgBody @(200)

Write-Host "`n=== 6. WAHA authenticated API ===" -ForegroundColor Cyan
$wahaEnv = docker inspect waha --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null
$wahaKeyLine = $wahaEnv | Select-String "^WAHA_API_KEY=" | Select-Object -First 1
if ($wahaKeyLine) {
  $wahaKey = ($wahaKeyLine.ToString() -split "=", 2)[1]
  Test-Http "WAHA sessions" "http://127.0.0.1:3001/api/sessions" "GET" @{ "X-Api-Key" = $wahaKey } $null @(200)
} else {
  BAD "Could not read WAHA_API_KEY from container"
}

Write-Host "`n=== 7. Internal Docker checks ===" -ForegroundColor Cyan
$redis = docker exec redis redis-cli ping 2>$null
if ($redis -eq "PONG") { OK "Redis PONG" } else { BAD "Redis ping failed: $redis" }

$pgReady = docker exec postgres pg_isready -U admin -d project_db 2>$null
if ($pgReady -match "accepting connections") { OK "Postgres accepting connections" } else { BAD "Postgres not ready: $pgReady" }

$webuiEnv = docker exec open-webui printenv 2>$null | Select-String "^OLLAMA_BASE_URL=http://ollama:11434"
if ($webuiEnv) { OK "Open WebUI wired to Ollama backend" } else { BAD "Open WebUI OLLAMA_BASE_URL is wrong/missing" }

Write-Host "`n=== 8. Ollama model + GPU smoke test ===" -ForegroundColor Cyan
$ollamaModels = docker exec ollama ollama list 2>$null
if ($ollamaModels -match "llama3.2:3b") { OK "llama3.2:3b model exists" } else { BAD "llama3.2:3b model missing" }

$reply = docker exec ollama ollama run llama3.2:3b "Reply exactly: AGENTICS_GPU_OK" 2>$null
if ($reply -match "AGENTICS_GPU_OK") { OK "Ollama inference response OK" } else { BAD "Ollama inference response unexpected: $reply" }

$nvidia = docker exec ollama nvidia-smi 2>$null
if ($nvidia -match "NVIDIA GeForce RTX 4070") { OK "Ollama container sees RTX 4070 GPU" } else { BAD "Ollama container does not show RTX 4070" }

Write-Host "`n=== 9. Current containers ===" -ForegroundColor Cyan
docker compose -f $ComposeFile ps

Write-Host "`n=== FINAL RESULT ===" -ForegroundColor Cyan
Write-Host "Passed: $Pass" -ForegroundColor Green
Write-Host "Failed: $Fail" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Red" })

if ($Fail -eq 0) {
  Write-Host "`nFINAL: Agentics unified GPU stack is fully verified." -ForegroundColor Green
  exit 0
} else {
  Write-Host "`nFINAL: Some checks failed. Paste this output back before removing orphans." -ForegroundColor Red
  exit 1
}
