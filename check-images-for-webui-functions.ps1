$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutDir = Join-Path $Root "webui-function-check-$Stamp"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Set-Location $Root

Write-Host "`n=== Docker images ===" -ForegroundColor Cyan
docker image ls | Tee-Object "$OutDir\docker-images.txt"

Write-Host "`n=== Docker containers ===" -ForegroundColor Cyan
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Tee-Object "$OutDir\docker-containers.txt"

$containers = docker ps -a --format "{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"
$images = docker image ls --format "{{.Repository}}:{{.Tag}}"

function Has-Match {
  param([string[]]$Items, [string]$Pattern)
  return [bool]($Items | Select-String -Pattern $Pattern -Quiet)
}

$functions = @(
  @{
    Name="Email Center"
    Capability="Inbox summary, draft replies, follow-ups, attachments"
    Backend="n8n + email adapter"
    Detected=(Has-Match $containers "n8n")
    Risk="High for send/delete; approval required"
  },
  @{
    Name="Calendar Center"
    Capability="Daily schedule, meeting prep, event drafts"
    Backend="n8n + calendar adapter"
    Detected=(Has-Match $containers "n8n")
    Risk="High for external invites; approval required"
  },
  @{
    Name="Local Files & Docs"
    Capability="Upload, parse, search, summarize local documents"
    Backend="minio + tika + chroma"
    Detected=((Has-Match $containers "minio") -and (Has-Match $containers "tika") -and (Has-Match $containers "chroma"))
    Risk="Medium; write/delete approval required"
  },
  @{
    Name="Browser Automation"
    Capability="Open sites, collect data, fill forms, download files"
    Backend="browser-use"
    Detected=(Has-Match $containers "browser-use|playwright|chrome")
    Risk="High for submit/send/purchase"
  },
  @{
    Name="WhatsApp Assistant"
    Capability="Summaries, draft replies, approved sends"
    Backend="WAHA"
    Detected=((Has-Match $containers "waha") -or (Has-Match $images "waha"))
    Risk="High for sending messages"
  },
  @{
    Name="Docker Stack Control"
    Capability="List containers, logs, health, restart with approval"
    Backend="agentics-tools-api"
    Detected=(Has-Match $containers "agentics-tools-api")
    Risk="High for restart/stop/rebuild"
  },
  @{
    Name="Terminal Workspace"
    Capability="Read files, grep, run sandboxed bash commands"
    Backend="open-terminal"
    Detected=(Has-Match $containers "open-terminal")
    Risk="High for shell/write commands"
  },
  @{
    Name="n8n Workflows"
    Capability="Run daily automations and workflow bridges"
    Backend="n8n"
    Detected=(Has-Match $containers "n8n")
    Risk="Medium/high depending workflow"
  },
  @{
    Name="Model Manager"
    Capability="List local models, pull/remove models with approval"
    Backend="ollama-gpu"
    Detected=(Has-Match $containers "ollama-gpu")
    Risk="Medium; pull/remove approval"
  },
  @{
    Name="MinIO File Browser"
    Capability="Browse stored files/artifacts"
    Backend="minio"
    Detected=(Has-Match $containers "minio")
    Risk="Medium; delete approval"
  },
  @{
    Name="Database Health"
    Capability="Check Postgres/Redis health and storage"
    Backend="postgres + redis"
    Detected=((Has-Match $containers "postgres") -and (Has-Match $containers "redis"))
    Risk="Low read-only; high for mutation"
  },
  @{
    Name="Monitoring Dashboard"
    Capability="Metrics/log dashboards"
    Backend="grafana/prometheus/loki/cadvisor"
    Detected=(Has-Match $images "grafana|prometheus|loki|cadvisor|node-exporter")
    Risk="Low read-only"
  },
  @{
    Name="Backups"
    Capability="Check backup status, start backup with approval"
    Backend="backup scripts + volumes"
    Detected=(Test-Path "$Root\backups")
    Risk="High for restore/delete"
  },
  @{
    Name="Approvals / Audit Log"
    Capability="Review pending actions and executed tool calls"
    Backend="Postgres pa_approvals + pa_tool_calls"
    Detected=(Has-Match $containers "postgres")
    Risk="Required safety function"
  }
)

$functions |
  ConvertTo-Json -Depth 8 |
  Set-Content "$OutDir\webui-functions-detected.json" -Encoding UTF8

$md = @()
$md += "# WebUI Functions From Docker Images"
$md += ""
$md += "Generated: $(Get-Date)"
$md += ""
$md += "| Function | Detected | Backend | Capability | Risk |"
$md += "|---|---:|---|---|---|"

foreach ($f in $functions) {
  $detected = if ($f.Detected) { "YES" } else { "NO" }
  $md += "| $($f.Name) | $detected | $($f.Backend) | $($f.Capability) | $($f.Risk) |"
}

$md | Set-Content "$OutDir\webui-functions-plan.md" -Encoding UTF8

$menu = @{
  title = "Personal Assistant"
  primary = "Email Center"
  functions = $functions | ForEach-Object {
    @{
      label = $_.Name
      enabled = $_.Detected
      backend = $_.Backend
      capability = $_.Capability
      risk = $_.Risk
    }
  }
}

$menu |
  ConvertTo-Json -Depth 8 |
  Set-Content "$Root\config\pa-webui-functions.menu.json" -Encoding UTF8

Write-Host "`n=== Function detection result ===" -ForegroundColor Cyan
Get-Content "$OutDir\webui-functions-plan.md"

Write-Host "`nCreated:"
Write-Host "$OutDir\webui-functions-plan.md"
Write-Host "$OutDir\webui-functions-detected.json"
Write-Host "$Root\config\pa-webui-functions.menu.json"
