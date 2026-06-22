$ErrorActionPreference = "Continue"

$checks = @(
  @{ Name = "gateway"; Urls = @("http://127.0.0.1:8088/health") },
  @{ Name = "personal-assistant-webui"; Urls = @("http://127.0.0.1:8787/") },
  @{ Name = "open-webui"; Urls = @("http://127.0.0.1:3000/health") },
  @{ Name = "ollama"; Urls = @("http://127.0.0.1:11434/api/tags") },
  @{ Name = "agentics-mcp"; Urls = @("http://127.0.0.1:8766/health") },
  @{ Name = "agentics-tools-api"; Urls = @("http://127.0.0.1:8765/health", "http://127.0.0.1:8765/docs", "http://127.0.0.1:8765/openapi.json") },
  @{ Name = "n8n"; Urls = @("http://127.0.0.1:5678/healthz/readiness", "http://127.0.0.1:5678/healthz") },
  @{ Name = "minio"; Urls = @("http://127.0.0.1:9000/minio/health/live") },
  @{ Name = "chroma"; Urls = @("http://127.0.0.1:8001/api/v2/heartbeat", "http://127.0.0.1:8001/api/v1/heartbeat") },
  @{ Name = "tika"; Urls = @("http://127.0.0.1:9998/tika") },
  @{ Name = "postgraphile"; Urls = @("http://127.0.0.1:5000/graphiql") },
  @{ Name = "open-terminal"; Urls = @("http://127.0.0.1:8000/health", "http://127.0.0.1:8000/") },
  @{ Name = "pytorch-service"; Urls = @("http://127.0.0.1:8888/health") }
)

$failed = 0
foreach ($check in $checks) {
  $ok = $false
  $lastError = $null
  foreach ($url in $check.Urls) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host ("OK   {0,-28} {1} {2}" -f $check.Name, $response.StatusCode, $url)
        $ok = $true
        break
      }
    } catch {
      $lastError = $_.Exception.Message
    }
  }
  if (-not $ok) {
    Write-Host ("FAIL {0,-28} {1}" -f $check.Name, ($check.Urls -join ", ")) -ForegroundColor Red
    if ($lastError) { Write-Host ("     {0}" -f $lastError) -ForegroundColor DarkGray }
    $failed++
  }
}

Write-Host ""
Write-Host "GPU container requests:"
docker inspect ollama --format "ollama -> {{json .HostConfig.DeviceRequests}}"
docker inspect pytorch-service --format "pytorch-service -> {{json .HostConfig.DeviceRequests}}"

if ($failed -gt 0) {
  Write-Host ""
  Write-Host "$failed health check(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "All host-side HTTP checks passed." -ForegroundColor Green
