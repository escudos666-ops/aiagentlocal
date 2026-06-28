param(
  [switch]$Repair,
  [switch]$Wait,
  [string[]]$ComposeFile = @(),
  [string[]]$ComposeService = @("agentics-mcp", "open-webui", "gateway"),
  [string]$ContainerName = "open-webui",
  [string]$ExpectedProject = "agentics",
  [string]$ExpectedService = "open-webui",
  [string]$ExpectedVolume = "agentics_open-webui_data",
  [string]$ExpectedNetwork = "agentics_agentnet",
  [string]$BackupDir = "C:\DeerpShit\Agentics\backups\openwebui",
  [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
if ($ComposeFile.Count -eq 0) {
  $ComposeFile = @(
    (Join-Path $RepoRoot "docker-compose.agentics.unified.gpu.yml"),
    (Join-Path $RepoRoot "docker-compose.openwebui-dmr.yml")
  )
}

function Write-Guard {
  param(
    [string]$Level,
    [string]$Message
  )

  $color = "Gray"
  if ($Level -eq "OK") { $color = "Green" }
  elseif ($Level -eq "FAIL") { $color = "Red" }
  elseif ($Level -eq "WARN") { $color = "Yellow" }
  elseif ($Level -eq "INFO") { $color = "Cyan" }

  Write-Host ("{0,-5} {1}" -f $Level, $Message) -ForegroundColor $color
}

function Get-ContainerInspect {
  param([string]$Name)

  $json = & docker inspect $Name 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($json | Out-String))) {
    return $null
  }

  try {
    $parsed = ($json -join "`n") | ConvertFrom-Json
    if ($parsed -is [array]) {
      return $parsed[0]
    }
    return $parsed
  }
  catch {
    return $null
  }
}

function Get-ObjectPropertyValue {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Test-DockerAvailable {
  $version = & docker version --format "{{.Server.Version}}" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($version | Out-String))) {
    Write-Guard "FAIL" "Docker daemon is not reachable."
    return $false
  }

  Write-Guard "OK" "Docker daemon reachable (server $($version | Select-Object -First 1))."
  return $true
}

function Show-ExtensionWarning {
  $extensionList = & docker extension ls 2>$null
  if ($LASTEXITCODE -eq 0) {
    $extensionHit = $extensionList | Select-String -SimpleMatch "rw4lll/openwebui-docker-extension" | Select-Object -First 1
    if ($extensionHit) {
      Write-Guard "WARN" "Docker Desktop extension rw4lll/openwebui-docker-extension is installed; it can recreate an empty open-webui container."
      Write-Guard "INFO" "Remove it with: docker extension rm rw4lll/openwebui-docker-extension"
    }
  }

  $extensionContainers = & docker ps --filter "name=openwebui-docker-extension" --format "{{.Names}} {{.Image}}" 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($extensionContainers | Out-String))) {
    foreach ($line in $extensionContainers) {
      Write-Guard "WARN" "Conflicting Open WebUI Docker Desktop extension container is running: $line"
    }
  }
}

function Test-PositiveCount {
  param(
    [object]$Counts,
    [string]$TableName
  )

  $rawValue = Get-ObjectPropertyValue $Counts $TableName
  if ($null -eq $rawValue) {
    return $false
  }

  try {
    return ([int]$rawValue -gt 0)
  }
  catch {
    return $false
  }
}

function Get-WebUIDatabaseCounts {
  param([string]$Name)

  $python = @'
import json
import os
import sqlite3
import sys

db = '/app/backend/data/webui.db'
tables = ['user', 'tool', 'function', 'skill', 'prompt', 'config']

if not os.path.exists(db):
    print(json.dumps({'error': 'missing /app/backend/data/webui.db'}))
    sys.exit(2)

result = {}
with sqlite3.connect(db) as con:
    for table in tables:
        try:
            result[table] = con.execute('select count(*) from {}'.format(table)).fetchone()[0]
        except Exception as exc:
            result[table] = 'error: {}'.format(exc)

print(json.dumps(result, sort_keys=True))
'@

  $output = & docker exec $Name python -c $python 2>&1
  $code = $LASTEXITCODE
  $text = ($output | Out-String).Trim()

  if ($code -ne 0) {
    return [pscustomobject]@{
      Ok     = $false
      Counts = $null
      Text   = $text
    }
  }

  try {
    return [pscustomobject]@{
      Ok     = $true
      Counts = ($text | ConvertFrom-Json)
      Text   = $text
    }
  }
  catch {
    return [pscustomobject]@{
      Ok     = $false
      Counts = $null
      Text   = $text
    }
  }
}

function Test-HttpFromContainer {
  param(
    [string]$FromContainer,
    [string]$Url,
    [string]$Name
  )

  $python = @"
import sys
import urllib.request

try:
    response = urllib.request.urlopen('$Url', timeout=8)
    sys.stdout.write(str(response.status))
except Exception as exc:
    sys.stderr.write(str(exc))
    sys.exit(1)
"@

  $output = & docker exec $FromContainer python -c $python 2>&1
  $text = ($output | Out-String).Trim()
  if ($LASTEXITCODE -eq 0 -and $text -match "2\d\d") {
    Write-Guard "OK" "$Name reachable from $FromContainer ($text)."
    return $true
  }

  Write-Guard "FAIL" "$Name is not reachable from ${FromContainer}: $text"
  return $false
}

function Wait-ForContainerReady {
  param(
    [string]$Name,
    [int]$Seconds
  )

  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    $inspect = Get-ContainerInspect $Name
    if ($null -ne $inspect -and [bool]$inspect.State.Running) {
      if ($null -eq $inspect.State.Health -or $inspect.State.Health.Status -eq "healthy") {
        return $true
      }
    }

    Start-Sleep -Seconds 3
  }

  return $false
}

function Backup-CurrentWebUIData {
  param([string]$Name)

  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $copied = 0

  foreach ($fileName in @("webui.db", "webui.db-wal", "webui.db-shm")) {
    $target = Join-Path $BackupDir ("webui-conflict-{0}-{1}" -f $stamp, $fileName)
    & docker cp "${Name}:/app/backend/data/$fileName" $target 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $copied++
      Write-Guard "INFO" "Backed up conflicting $fileName to $target"
    }
  }

  if ($copied -eq 0) {
    Write-Guard "WARN" "No webui.db files were copied from the conflicting container."
  }
}

function Invoke-AgenticsComposeUp {
  $composeArgs = @()
  foreach ($file in $ComposeFile) {
    if (-not (Test-Path -LiteralPath $file)) {
      Write-Guard "FAIL" "Compose file is missing: $file"
      return $false
    }
    $composeArgs += @("-f", $file)
  }

  $composeArgs += @("up", "-d")
  $composeArgs += $ComposeService

  Push-Location $RepoRoot
  try {
    Write-Guard "INFO" "Running docker compose $($composeArgs -join ' ')"
    & docker compose @composeArgs
    if ($LASTEXITCODE -ne 0) {
      Write-Guard "FAIL" "docker compose up failed."
      return $false
    }
  }
  finally {
    Pop-Location
  }

  return $true
}

function Test-AgenticsOpenWebUI {
  $failures = New-Object System.Collections.Generic.List[object]
  $containerRepairable = $false
  $replaceContainer = $false

  function Add-Failure {
    param(
      [string]$Message,
      [bool]$Repairable = $false
    )

    Write-Guard "FAIL" $Message
    [void]$failures.Add([pscustomobject]@{
      Message    = $Message
      Repairable = $Repairable
    })
  }

  Write-Guard "INFO" "Checking $ContainerName ownership and Agentics WebUI content."
  $inspect = Get-ContainerInspect $ContainerName

  if ($null -eq $inspect) {
    Add-Failure "$ContainerName container does not exist." $true
    $containerRepairable = $true
    return [pscustomobject]@{
      Passed           = $false
      Failures         = $failures
      ReplaceContainer = $false
      Repairable       = $true
    }
  }

  if (-not [bool]$inspect.State.Running) {
    Add-Failure "$ContainerName is not running (state: $($inspect.State.Status))." $true
    $containerRepairable = $true
  }
  else {
    Write-Guard "OK" "$ContainerName is running."
  }

  $labels = $inspect.Config.Labels
  $project = Get-ObjectPropertyValue $labels "com.docker.compose.project"
  $service = Get-ObjectPropertyValue $labels "com.docker.compose.service"

  if ($project -ne $ExpectedProject -or $service -ne $ExpectedService) {
    Add-Failure "$ContainerName is not the Agentics compose service (project=$project service=$service)." $true
    $containerRepairable = $true
    $replaceContainer = $true
  }
  else {
    Write-Guard "OK" "$ContainerName belongs to compose project $ExpectedProject service $ExpectedService."
  }

  $volumeMount = @($inspect.Mounts | Where-Object {
    $_.Type -eq "volume" -and
    $_.Name -eq $ExpectedVolume -and
    $_.Destination -eq "/app/backend/data"
  })

  if ($volumeMount.Count -eq 0) {
    $actualMounts = @($inspect.Mounts | ForEach-Object { "$($_.Name):$($_.Destination)" }) -join ", "
    Add-Failure "$ContainerName is not mounted on $ExpectedVolume at /app/backend/data (actual: $actualMounts)." $true
    $containerRepairable = $true
    $replaceContainer = $true
  }
  else {
    Write-Guard "OK" "$ContainerName uses $ExpectedVolume for /app/backend/data."
  }

  $networkNames = @($inspect.NetworkSettings.Networks.PSObject.Properties.Name)
  if ($networkNames -notcontains $ExpectedNetwork) {
    Add-Failure "$ContainerName is not attached to $ExpectedNetwork (actual: $($networkNames -join ', '))." $true
    $containerRepairable = $true
    $replaceContainer = $true
  }
  else {
    Write-Guard "OK" "$ContainerName is attached to $ExpectedNetwork."
  }

  $envLines = @($inspect.Config.Env)
  $hasOllama = @($envLines | Where-Object { $_ -eq "OLLAMA_BASE_URL=http://ollama:11434" }).Count -gt 0
  $hasMcp = @($envLines | Where-Object { $_ -like "TOOL_SERVER_CONNECTIONS=*agentics-mcp*" }).Count -gt 0
  $signupDisabled = @($envLines | Where-Object { $_ -eq "ENABLE_SIGNUP=false" -or $_ -eq "ENABLE_SIGNUP=False" }).Count -gt 0

  if (-not $hasOllama) {
    Add-Failure "$ContainerName is missing OLLAMA_BASE_URL=http://ollama:11434." $true
    $containerRepairable = $true
  }
  else {
    Write-Guard "OK" "$ContainerName is wired to Ollama inside the Agentics network."
  }

  if (-not $hasMcp) {
    Add-Failure "$ContainerName is missing TOOL_SERVER_CONNECTIONS for agentics-mcp." $true
    $containerRepairable = $true
  }
  else {
    Write-Guard "OK" "$ContainerName has the Agentics MCP tool server configured."
  }

  if (-not $signupDisabled) {
    Add-Failure "$ContainerName does not have ENABLE_SIGNUP=false." $true
    $containerRepairable = $true
  }
  else {
    Write-Guard "OK" "$ContainerName keeps public signup disabled."
  }

  $db = Get-WebUIDatabaseCounts $ContainerName
  if (-not $db.Ok) {
    Add-Failure "$ContainerName database counts could not be read: $($db.Text)" $containerRepairable
  }
  else {
    $summary = "user=$((Get-ObjectPropertyValue $db.Counts 'user')) tool=$((Get-ObjectPropertyValue $db.Counts 'tool')) function=$((Get-ObjectPropertyValue $db.Counts 'function')) skill=$((Get-ObjectPropertyValue $db.Counts 'skill')) prompt=$((Get-ObjectPropertyValue $db.Counts 'prompt')) config=$((Get-ObjectPropertyValue $db.Counts 'config'))"
    if (
      (Test-PositiveCount $db.Counts "tool") -and
      (Test-PositiveCount $db.Counts "function") -and
      (Test-PositiveCount $db.Counts "skill") -and
      (Test-PositiveCount $db.Counts "prompt")
    ) {
      Write-Guard "OK" "Agentics Open WebUI database content is present ($summary)."
    }
    else {
      Add-Failure "Agentics Open WebUI database content is missing or empty ($summary)." $containerRepairable
    }
  }

  if ($networkNames -contains $ExpectedNetwork) {
    $mcpOk = Test-HttpFromContainer $ContainerName "http://agentics-mcp:8766/health" "Agentics MCP health"
    if (-not $mcpOk) {
      Add-Failure "Agentics MCP is not reachable from $ContainerName." $true
    }
  }

  $gateway = Get-ContainerInspect "agentics-gateway"
  if ($null -ne $gateway -and [bool]$gateway.State.Running) {
    $gatewayProbe = & docker exec agentics-gateway wget -qO- http://open-webui:8080/api/version 2>&1
    $gatewayText = ($gatewayProbe | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $gatewayText -match "version") {
      Write-Guard "OK" "agentics-gateway resolves and reaches open-webui."
    }
    else {
      Add-Failure "agentics-gateway cannot reach open-webui: $gatewayText" $false
    }
  }
  else {
    Add-Failure "agentics-gateway is not running, so ai.localhost cannot be verified." $true
  }

  return [pscustomobject]@{
    Passed           = ($failures.Count -eq 0)
    Failures         = $failures
    ReplaceContainer = $replaceContainer
    Repairable       = ($failures.Count -gt 0 -and @($failures | Where-Object { -not $_.Repairable }).Count -eq 0)
  }
}

Write-Host "`n=== Agentics Open WebUI Guard ===" -ForegroundColor Cyan

if (-not (Test-DockerAvailable)) {
  exit 1
}

Show-ExtensionWarning

if ($Wait) {
  Write-Guard "INFO" "Waiting up to $TimeoutSec seconds for $ContainerName to become ready."
  [void](Wait-ForContainerReady $ContainerName $TimeoutSec)
}

$state = Test-AgenticsOpenWebUI
if ($state.Passed) {
  Write-Guard "OK" "Agentics Open WebUI guard passed."
  exit 0
}

if (-not $Repair) {
  Write-Guard "INFO" "Run with -Repair to recreate the compose-managed Open WebUI container when the failure is repairable."
  exit 1
}

if (-not $state.Repairable) {
  Write-Guard "FAIL" "At least one failure is not safe to repair automatically. Inspect the database/backups before continuing."
  exit 1
}

Write-Guard "INFO" "Repair mode enabled."

if ($state.ReplaceContainer) {
  Backup-CurrentWebUIData $ContainerName
  Write-Guard "INFO" "Removing conflicting $ContainerName container."
  & docker rm -f $ContainerName
  if ($LASTEXITCODE -ne 0) {
    Write-Guard "FAIL" "Could not remove conflicting $ContainerName container."
    exit 1
  }
}

if (-not (Invoke-AgenticsComposeUp)) {
  exit 1
}

Write-Guard "INFO" "Waiting up to $TimeoutSec seconds for repaired Open WebUI to become ready."
if (-not (Wait-ForContainerReady $ContainerName $TimeoutSec)) {
  Write-Guard "FAIL" "$ContainerName did not become ready within $TimeoutSec seconds."
  exit 1
}

$postRepair = Test-AgenticsOpenWebUI
if ($postRepair.Passed) {
  Write-Guard "OK" "Agentics Open WebUI repair completed and verified."
  exit 0
}

Write-Guard "FAIL" "Repair ran, but the guard still found failures."
exit 1
