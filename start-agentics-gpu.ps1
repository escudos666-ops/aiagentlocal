Set-Location "C:\DeerpShit\Agentics"

$ComposeBase = "C:\DeerpShit\Agentics\docker-compose.agentics.unified.gpu.yml"
$ComposeDmr = "C:\DeerpShit\Agentics\docker-compose.openwebui-dmr.yml"

powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1" `
  -Repair `
  -Wait `
  -ComposeFile $ComposeBase $ComposeDmr

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

docker compose `
  -f $ComposeBase `
  -f $ComposeDmr `
  up -d

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1" `
  -Repair `
  -Wait `
  -ComposeFile $ComposeBase $ComposeDmr

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

powershell -ExecutionPolicy Bypass -File "C:\DeerpShit\Agentics\check-agentics-unified-gpu.ps1"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "`nDocker Model Runner models:" -ForegroundColor Cyan
Invoke-RestMethod `
  -Uri "http://127.0.0.1:12434/engines/v1/models" `
  -Method Get | ConvertTo-Json -Depth 20

Write-Host "`nOpen WebUI model backends:" -ForegroundColor Cyan
docker exec open-webui printenv | Select-String "OLLAMA|OPENAI|MODEL"
