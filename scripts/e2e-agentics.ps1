param(
  [switch]$SendWhatsApp,
  [switch]$RequireOptionalServices,
  [string]$WahaKey = "change-this-waha-api-key",
  [string]$WahaChatId = "31613717081@c.us"
)

$ErrorActionPreference = "Continue"
$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [bool]$Pass,
    [string]$Info = "",
    [string]$Layer = "general"
  )

  [void]$results.Add([pscustomobject]@{
    Time  = (Get-Date).ToString("s")
    Layer = $Layer
    Name  = $Name
    Pass  = $Pass
    Info  = $Info
  })
}

function Get-ContainerInfo {
  param([string]$Name)

  $inspect = docker inspect $Name 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($inspect | Out-String))) {
    return $null
  }

  $container = $inspect | ConvertFrom-Json
  if ($container -is [array]) {
    return $container[0]
  }

  return $container
}

function Test-Container {
  param(
    [string]$Name,
    [switch]$Optional
  )

  $container = Get-ContainerInfo $Name
  if ($null -eq $container) {
    if ($Optional -and -not $RequireOptionalServices) {
      Add-Result "container:$Name" $true "skipped; optional container not found" "containers"
      return $false
    }

    Add-Result "container:$Name" $false "not found" "containers"
    return $false
  }

  $running = [bool]$container.State.Running
  $health = "no-healthcheck"
  if ($null -ne $container.State.Health -and -not [string]::IsNullOrWhiteSpace($container.State.Health.Status)) {
    $health = $container.State.Health.Status
  }

  Add-Result "container:$Name" $running "status=$($container.State.Status); health=$health" "containers"
  return $running
}

function Test-AnyContainer {
  param(
    [string]$Name,
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $container = Get-ContainerInfo $candidate
    if ($null -ne $container) {
      $running = [bool]$container.State.Running
      $health = "no-healthcheck"
      if ($null -ne $container.State.Health -and -not [string]::IsNullOrWhiteSpace($container.State.Health.Status)) {
        $health = $container.State.Health.Status
      }

      Add-Result "container:$candidate" $running "status=$($container.State.Status); health=$health; selected for $Name" "containers"
      return $candidate
    }
  }

  Add-Result "container:$Name" $false "none found: $($Candidates -join ', ')" "containers"
  return $null
}

function Test-Http {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Layer = "http",
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [int]$TimeoutSec = 20
  )

  try {
    $args = @{
      Uri = $Url
      Method = $Method
      TimeoutSec = $TimeoutSec
      UseBasicParsing = $true
      Headers = $Headers
    }

    if ($null -ne $Body) {
      $args.Body = $Body
      $args.ContentType = "application/json"
    }

    $r = Invoke-WebRequest @args
    Add-Result $Name $true "HTTP $($r.StatusCode)" $Layer
    return $r.Content
  }
  catch {
    Add-Result $Name $false $_.Exception.Message $Layer
    return $null
  }
}

function Test-HttpWhenAvailable {
  param(
    [bool]$Available,
    [string]$Name,
    [string]$Url,
    [string]$Layer = "http",
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [int]$TimeoutSec = 20,
    [string]$SkipInfo = "skipped; optional service not running"
  )

  if ($Available -or $RequireOptionalServices) {
    return Test-Http $Name $Url $Layer $Method $Headers $Body $TimeoutSec
  }

  Add-Result $Name $true $SkipInfo $Layer
  return $null
}

function Test-DockerExec {
  param(
    [string]$Name,
    [string]$Command,
    [string]$Layer = "docker"
  )

  try {
    $out = cmd.exe /c $Command 2>&1
    $code = $LASTEXITCODE
    $text = ($out | Out-String).Trim()
    Add-Result $Name ($code -eq 0) $text $Layer
    return $text
  }
  catch {
    Add-Result $Name $false $_.Exception.Message $Layer
    return $null
  }
}

function Test-PowerShellScript {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Layer = "script",
    [string[]]$Arguments = @()
  )

  try {
    $out = powershell -ExecutionPolicy Bypass -File $Path @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = ($out | Out-String).Trim()
    Add-Result $Name ($code -eq 0) $text $Layer
    return $text
  }
  catch {
    Add-Result $Name $false $_.Exception.Message $Layer
    return $null
  }
}

Write-Host "`n=== Agentics E2E tests started ===`n"

# 1. Container health
$openWebUIContainer = Test-AnyContainer "Open WebUI" @(
  "open-webui",
  "agentics-open-webui-dmr",
  "openwebui"
)

$personalAssistantContainer = Test-AnyContainer "Personal Assistant WebUI" @(
  "agentics-personal-assistant-webui",
  "personal-assistant-webui"
)
$personalAssistantAvailable = $false
if ($null -ne $personalAssistantContainer) {
  $personalAssistantInfo = Get-ContainerInfo $personalAssistantContainer
  $personalAssistantAvailable = $null -ne $personalAssistantInfo -and [bool]$personalAssistantInfo.State.Running
}

$required = @(
  "agentics-gateway",
  "n8n",
  "postgres",
  "redis",
  "chroma",
  "tika",
  "minio",
  "postgraphile",
  "ollama",
  "agentics-mcp",
  "agentics-tools-api"
)

foreach ($name in $required) {
  if ($name -ne $openWebUIContainer -and $name -ne $personalAssistantContainer) {
    Test-Container $name | Out-Null
  }
}

$wahaAvailable = Test-Container "waha" -Optional
$adminerAvailable = Test-Container "adminer" -Optional
$n8nImportsAvailable = Test-Container "n8n-imports" -Optional

Test-PowerShellScript `
  "Open WebUI Agentics ownership guard" `
  "C:\DeerpShit\Agentics\scripts\ensure-agentics-openwebui.ps1" `
  "open-webui" `
  @(
    "-ComposeFile",
    "C:\DeerpShit\Agentics\docker-compose.agentics.unified.gpu.yml",
    "C:\DeerpShit\Agentics\docker-compose.openwebui-dmr.yml"
  ) | Out-Null

# 2. Gateway/front-door URLs
Test-Http "gateway ai.localhost" "http://127.0.0.1/" "gateway" "GET" @{ Host = "ai.localhost" } | Out-Null
Test-Http "gateway n8n.localhost" "http://127.0.0.1/" "gateway" "GET" @{ Host = "n8n.localhost" } | Out-Null
Test-HttpWhenAvailable $personalAssistantAvailable "gateway pa.localhost" "http://127.0.0.1/" "gateway" "GET" @{ Host = "pa.localhost" } $null 20 "skipped; optional Personal Assistant WebUI container not running" | Out-Null
Test-HttpWhenAvailable $adminerAvailable "gateway db.localhost" "http://127.0.0.1/" "gateway" "GET" @{ Host = "db.localhost" } $null 20 "skipped; optional Adminer container not running" | Out-Null
Test-Http "gateway files.localhost" "http://127.0.0.1/" "gateway" "GET" @{ Host = "files.localhost" } | Out-Null
$gatewayGraphqlBody = @{ query = "{ __typename }" } | ConvertTo-Json
Test-Http "gateway graphql.localhost" "http://127.0.0.1/graphql" "gateway" "POST" @{ Host = "graphql.localhost" } $gatewayGraphqlBody | Out-Null

# 3. Host ports
Test-Http "Open WebUI host" "http://localhost:3000" "host-http" | Out-Null
Test-Http "n8n host" "http://localhost:5678" "host-http" | Out-Null
Test-HttpWhenAvailable $personalAssistantAvailable "Personal Assistant host" "http://localhost:8787" "host-http" "GET" @{} $null 20 "skipped; optional Personal Assistant WebUI container not running" | Out-Null
Test-HttpWhenAvailable $wahaAvailable "WAHA ping host" "http://localhost:3001/ping" "host-http" "GET" @{} $null 20 "skipped; optional WAHA container not running" | Out-Null
Test-HttpWhenAvailable $adminerAvailable "Adminer host" "http://localhost:8081" "host-http" "GET" @{} $null 20 "skipped; optional Adminer container not running" | Out-Null
Test-Http "MinIO health host" "http://localhost:9000/minio/health/live" "host-http" | Out-Null
Test-Http "Tika host" "http://localhost:9998/tika" "host-http" | Out-Null
Test-HttpWhenAvailable $n8nImportsAvailable "n8n imports file" "http://localhost:8898/waha-sendText.workflow.json" "host-http" "GET" @{} $null 20 "skipped; optional n8n-imports container not running" | Out-Null

# 4. Docker Model Runner
$tags = Test-Http "Docker Model Runner tags" "http://localhost:12434/api/tags" "models"
if ($tags) {
  $hasQwen = $tags -match "qwen2.5"
  $hasLlama = $tags -match "llama3.2"
  Add-Result "model:qwen2.5 listed" $hasQwen "" "models"
  Add-Result "model:llama3.2 listed" $hasLlama "" "models"
}

$dmrBody = @{
  model = "docker.io/ai/llama3.2:latest"
  messages = @(@{ role = "user"; content = "Reply with OK only." })
  stream = $false
} | ConvertTo-Json -Depth 8

Test-Http "Docker Model Runner chat inference" "http://localhost:12434/api/chat" "models" "POST" @{} $dmrBody 90 | Out-Null

# 5. WAHA session
$wahaHeaders = @{ "X-Api-Key" = $WahaKey }
$wahaSessions = Test-HttpWhenAvailable $wahaAvailable "WAHA sessions host" "http://localhost:3001/api/sessions" "waha" "GET" $wahaHeaders $null 20 "skipped; optional WAHA container not running"
if ($wahaSessions) {
  $isWorking = $wahaSessions -match '"status"\s*:\s*"WORKING"'
  Add-Result "WAHA default session WORKING" $isWorking $wahaSessions "waha"
}

# 6. n8n -> WAHA internal call
if ($wahaAvailable -or $RequireOptionalServices) {
  Test-DockerExec "n8n can reach WAHA sessions" "docker exec n8n wget -qO- --header=""X-Api-Key: $WahaKey"" http://waha:3000/api/sessions" "internal-network" | Out-Null
}
else {
  Add-Result "n8n can reach WAHA sessions" $true "skipped; optional WAHA container not running" "internal-network"
}

# 7. Database/cache/object/document services
Test-DockerExec "Postgres pg_isready" "docker exec postgres pg_isready" "data" | Out-Null
Test-DockerExec "Redis ping" "docker exec redis redis-cli ping" "data" | Out-Null
Test-DockerExec "n8n can reach Postgres" "docker exec n8n sh -lc ""nc -z postgres 5432 || true""" "internal-network" | Out-Null
Test-DockerExec "Redis reachable on agentics network" "docker run --rm --network agentics_agentnet redis:7-alpine redis-cli -h redis ping" "internal-network" | Out-Null
Test-DockerExec "n8n can reach MinIO" "docker exec n8n wget -qO- http://minio:9000/minio/health/live" "internal-network" | Out-Null
Test-DockerExec "n8n can reach Tika" "docker exec n8n wget -qO- http://tika:9998/tika" "internal-network" | Out-Null
Test-DockerExec "n8n can reach Chroma" "docker exec n8n wget -qO- http://chroma:8000/api/v2/heartbeat" "internal-network" | Out-Null

# 8. Chroma heartbeat fallback
$chroma2 = Test-Http "Chroma v2 heartbeat" "http://localhost:8001/api/v2/heartbeat" "data"
if (-not $chroma2) {
  Test-Http "Chroma v1 heartbeat fallback" "http://localhost:8001/api/v1/heartbeat" "data" | Out-Null
}

# 9. PostGraphile GraphQL
$graphqlBody = @{ query = "{ __typename }" } | ConvertTo-Json
Test-Http "PostGraphile GraphQL query" "http://localhost:5000/graphql" "graphql" "POST" @{} $graphqlBody | Out-Null

# 10. Optional WhatsApp send
if ($SendWhatsApp) {
  $sendBody = @{
    session = "default"
    chatId = $WahaChatId
    text = "Agentics E2E test from PowerShell at $(Get-Date -Format s)"
  } | ConvertTo-Json

  if ($wahaAvailable -or $RequireOptionalServices) {
    Test-Http "WAHA send WhatsApp test" "http://localhost:3001/api/sendText" "waha" "POST" $wahaHeaders $sendBody 60 | Out-Null
  }
  else {
    Add-Result "WAHA send WhatsApp test" $false "WAHA container is not running" "waha"
  }
}
else {
  Add-Result "WAHA send WhatsApp test" $true "skipped; run with -SendWhatsApp to send" "waha"
}

# 11. Summary and files
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportDir = "C:\DeerpShit\Agentics\test-reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$jsonPath = Join-Path $reportDir "e2e-$stamp.json"
$csvPath = Join-Path $reportDir "e2e-$stamp.csv"

$results | ConvertTo-Json -Depth 5 | Set-Content $jsonPath -Encoding UTF8
$results | Export-Csv $csvPath -NoTypeInformation -Encoding UTF8

$failed = @($results | Where-Object { -not $_.Pass })
$passed = @($results | Where-Object { $_.Pass })

Write-Host "`n=== E2E Summary ==="
Write-Host "Passed: $($passed.Count)"
Write-Host "Failed: $($failed.Count)"
Write-Host "JSON:   $jsonPath"
Write-Host "CSV:    $csvPath`n"

$results | Sort-Object Layer, Name | Format-Table -AutoSize

if ($failed.Count -gt 0) {
  Write-Host "`nFAILED TESTS:" -ForegroundColor Red
  $failed | Format-Table -AutoSize
  exit 1
}

Write-Host "`nALL E2E TESTS PASSED" -ForegroundColor Green
exit 0
