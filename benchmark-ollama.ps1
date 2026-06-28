$models = @(
  "llama3.2:3b",
  "agentics-assistant:latest",
  "llama3.1:latest",
  "qwen2.5-coder:7b"
)

$prompts = @(
  "Reply with a short checklist for checking Docker containers.",
  "Write a PowerShell command to show Docker containers using port 3000.",
  "Explain in 5 bullet points how this local AI stack works."
)

$results = @()

foreach ($model in $models) {
  Write-Host "`n=== Testing $model ==="

  docker exec ollama ollama stop llama3.2:3b 2>$null
  docker exec ollama ollama stop agentics-assistant:latest 2>$null
  docker exec ollama ollama stop llama3.1:latest 2>$null
  docker exec ollama ollama stop qwen2.5-coder:7b 2>$null

  Start-Sleep -Seconds 2

  foreach ($prompt in $prompts) {
    $body = @{
      model = $model
      prompt = $prompt
      stream = $false
      options = @{
        temperature = 0.2
        num_ctx = 4096
        num_predict = 300
      }
    } | ConvertTo-Json -Depth 10

    $start = Get-Date
    $response = Invoke-RestMethod `
      -Uri "http://127.0.0.1:11434/api/generate" `
      -Method Post `
      -ContentType "application/json" `
      -Body $body
    $end = Get-Date

    $wallSeconds = [math]::Round(($end - $start).TotalSeconds, 2)
    $evalSeconds = [math]::Round($response.eval_duration / 1000000000, 2)
    $tokensPerSecond = if ($evalSeconds -gt 0) {
      [math]::Round($response.eval_count / $evalSeconds, 2)
    } else {
      0
    }

    $loaded = docker exec ollama ollama ps

    $row = [PSCustomObject]@{
      Model = $model
      WallSeconds = $wallSeconds
      EvalTokens = $response.eval_count
      EvalSeconds = $evalSeconds
      TokensPerSecond = $tokensPerSecond
      PromptTokens = $response.prompt_eval_count
      TotalDurationSeconds = [math]::Round($response.total_duration / 1000000000, 2)
      LoadDurationSeconds = [math]::Round($response.load_duration / 1000000000, 2)
      ResponsePreview = $response.response.Substring(0, [Math]::Min(120, $response.response.Length))
    }

    $results += $row
    $row | Format-List

    Write-Host "`nOllama loaded model:"
    $loaded
  }
}

$results | Export-Csv ".\ollama-benchmark-results.csv" -NoTypeInformation -Encoding UTF8
$results | Sort-Object TokensPerSecond -Descending | Format-Table -AutoSize

Write-Host "`nSaved benchmark:"
Write-Host "C:\DeerpShit\Agentics\ollama-benchmark-results.csv"
