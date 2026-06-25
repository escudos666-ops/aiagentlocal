$ErrorActionPreference = "Continue"

Write-Host "`n=== Docker Compose services ===" -ForegroundColor Cyan
docker compose ps

Write-Host "`n=== Running containers and ports ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n=== Unhealthy or exited containers ===" -ForegroundColor Cyan
docker ps -a --filter "health=unhealthy" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

Write-Host "`n=== Core service health endpoints ===" -ForegroundColor Cyan

$checks = @(
  @{ Name="Gateway"; Url="http://127.0.0.1:8088" },
  @{ Name="Open WebUI"; Url="http://127.0.0.1:3000" },
  @{ Name="PA WebUI"; Url="http://127.0.0.1:8787" },
  @{ Name="Tools API"; Url="http://127.0.0.1:8765/health" },
  @{ Name="MCP"; Url="http://127.0.0.1:8766/health" },
  @{ Name="Open Terminal"; Url="http://127.0.0.1:8000/health" },
  @{ Name="Chroma"; Url="http://127.0.0.1:8001/api/v1/heartbeat" },
  @{ Name="Tika"; Url="http://127.0.0.1:9998/tika" },
  @{ Name="n8n"; Url="http://127.0.0.1:5678/healthz" },
  @{ Name="MinIO"; Url="http://127.0.0.1:9000/minio/health/live" },
  @{ Name="Ollama CPU"; Url="http://127.0.0.1:11434/api/tags" },
  @{ Name="Ollama GPU"; Url="http://127.0.0.1:11435/api/tags" }
)

foreach ($c in $checks) {
  try {
    $r = Invoke-WebRequest -Uri $c.Url -UseBasicParsing -TimeoutSec 5
    Write-Host ("OK   {0,-18} {1}" -f $c.Name, $c.Url) -ForegroundColor Green
  } catch {
    Write-Host ("FAIL {0,-18} {1}" -f $c.Name, $c.Url) -ForegroundColor Red
  }
}

Write-Host "`n=== Open WebUI Ollama / MCP / Tool config, secrets hidden ===" -ForegroundColor Cyan
docker inspect open-webui --format '{{range .Config.Env}}{{println .}}{{end}}' |
  Select-String "OLLAMA_BASE_URL|RAG_OLLAMA_BASE_URL|MCP_INITIALIZE_TIMEOUT|TOOL_SERVER_CONNECTIONS|ENABLE_OLLAMA_API" |
  Where-Object { $_ -notmatch "KEY|PASSWORD|SECRET|TOKEN" }

Write-Host "`n=== Ollama GPU models ===" -ForegroundColor Cyan
try {
  Invoke-RestMethod "http://127.0.0.1:11435/api/tags" |
    ConvertTo-Json -Depth 10
} catch {
  Write-Host "Could not query Ollama GPU on 127.0.0.1:11435" -ForegroundColor Red
}

Write-Host "`n=== Browser-use public port exposure check ===" -ForegroundColor Cyan
$browserPorts = docker ps --format "{{.Names}} {{.Ports}}" | Select-String "browser|5901|6080|7788|9222"
$browserPorts

if ($browserPorts -match "0.0.0.0|\[::\]") {
  Write-Host "WARNING: Browser automation ports are exposed on all interfaces." -ForegroundColor Yellow
  Write-Host "Expected: 127.0.0.1:5901, 6080, 7788, 9222 only." -ForegroundColor Yellow
} else {
  Write-Host "OK: Browser automation ports appear localhost-only." -ForegroundColor Green
}

Write-Host "`n=== Open Terminal API endpoints ===" -ForegroundColor Cyan
try {
  $api = Invoke-RestMethod "http://127.0.0.1:8000/openapi.json" -TimeoutSec 5
  $api.paths.PSObject.Properties.Name
} catch {
  Write-Host "Could not query open-terminal OpenAPI." -ForegroundColor Red
}

Write-Host "`n=== PA database tables ===" -ForegroundColor Cyan
$pgEnv = docker inspect postgres --format '{{range .Config.Env}}{{println .}}{{end}}'
$pgUser = ($pgEnv | Select-String "^POSTGRES_USER=").ToString().Split("=",2)[1]
$pgDb = ($pgEnv | Select-String "^POSTGRES_DB=").ToString().Split("=",2)[1]

if (!$pgUser) { $pgUser = "postgres" }
if (!$pgDb) { $pgDb = $pgUser }

docker exec postgres psql -U $pgUser -d $pgDb -c "\dt pa_*"

Write-Host "`n=== n8n workflow names ===" -ForegroundColor Cyan
try {
  docker exec n8n n8n list:workflow
} catch {
  Write-Host "n8n list:workflow failed. Use export command if needed." -ForegroundColor Yellow
}

Write-Host "`n=== Recent important logs ===" -ForegroundColor Cyan
foreach ($name in @("open-webui","agentics-mcp","agentics-tools-api","open-terminal","n8n","ollama-gpu")) {
  Write-Host "`n--- $name ---" -ForegroundColor Magenta
  docker logs --tail 20 $name
}

Write-Host "`nStack check complete." -ForegroundColor Cyan