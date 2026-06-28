param(
  [int]$Workers = 4,
  [int]$RequestsPerWorker = 5,
  [int]$MaxTokens = 768,
  [string]$Model = "docker.io/ai/qwen2.5:latest"
)

$ErrorActionPreference = "Stop"

$ApiUrl = "http://localhost:12434/engines/llama.cpp/v1/chat/completions"
$ReportDir = "C:\DeerpShit\Agentics\test-reports"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$GpuLog = Join-Path $ReportDir "gpu-stress-$stamp-nvidia-smi.csv"
$ResultLog = Join-Path $ReportDir "gpu-stress-$stamp-results.json"

Write-Host "Starting GPU monitor..."
$monitor = Start-Job -ScriptBlock {
  param($GpuLog)
  nvidia-smi --query-gpu=timestamp,index,name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv -l 1 | Tee-Object -FilePath $GpuLog
} -ArgumentList $GpuLog

Start-Sleep -Seconds 2

Write-Host "Starting Docker Model Runner stress test..."
Write-Host "Workers: $Workers"
Write-Host "Requests per worker: $RequestsPerWorker"
Write-Host "Model: $Model"
Write-Host "Max tokens: $MaxTokens"
Write-Host ""

$jobs = 1..$Workers | ForEach-Object {
  $workerId = $_

  Start-Job -ScriptBlock {
    param($workerId, $RequestsPerWorker, $ApiUrl, $Model, $MaxTokens)

    $results = @()

    for ($i = 1; $i -le $RequestsPerWorker; $i++) {
      $prompt = @"
You are running a GPU stress test.
Write a detailed technical explanation of how a local AI automation stack works with Postgres, PostGraphile, n8n, WAHA, Tika, MinIO, Chroma, Redis, and Docker Model Runner.
Include a step-by-step architecture, failure modes, and test plan.
Worker: $workerId
Request: $i
"@

      $body = @{
        model = $Model
        messages = @(
          @{
            role = "user"
            content = $prompt
          }
        )
        max_tokens = $MaxTokens
        temperature = 0.2
        stream = $false
      } | ConvertTo-Json -Depth 10

      $sw = [System.Diagnostics.Stopwatch]::StartNew()

      try {
        $response = Invoke-RestMethod `
          -Uri $ApiUrl `
          -Method POST `
          -ContentType "application/json" `
          -Body $body `
          -TimeoutSec 300

        $sw.Stop()

        $results += [pscustomobject]@{
          worker = $workerId
          request = $i
          ok = $true
          seconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
          model = $Model
          usage = $response.usage
          error = $null
        }
      }
      catch {
        $sw.Stop()

        $results += [pscustomobject]@{
          worker = $workerId
          request = $i
          ok = $false
          seconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
          model = $Model
          usage = $null
          error = $_.Exception.Message
        }
      }
    }

    return $results
  } -ArgumentList $workerId, $RequestsPerWorker, $ApiUrl, $Model, $MaxTokens
}

$allResults = @()

foreach ($job in $jobs) {
  $allResults += Receive-Job -Job $job -Wait
}

Stop-Job $monitor -ErrorAction SilentlyContinue
Remove-Job $monitor -Force -ErrorAction SilentlyContinue
$jobs | Remove-Job -Force -ErrorAction SilentlyContinue

$allResults | ConvertTo-Json -Depth 20 | Set-Content -Path $ResultLog -Encoding UTF8

$ok = @($allResults | Where-Object { $_.ok -eq $true }).Count
$fail = @($allResults | Where-Object { $_.ok -eq $false }).Count
$avg = ($allResults | Where-Object { $_.ok -eq $true } | Measure-Object -Property seconds -Average).Average

Write-Host ""
Write-Host "GPU stress test complete."
Write-Host "OK: $ok"
Write-Host "Failed: $fail"
Write-Host "Average seconds: $([math]::Round($avg, 2))"
Write-Host ""
Write-Host "GPU log:"
Write-Host $GpuLog
Write-Host ""
Write-Host "Result log:"
Write-Host $ResultLog
