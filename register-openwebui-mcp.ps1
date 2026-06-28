param(
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [string]$McpUrl = "http://agentics-mcp:8766/mcp",
    [string]$ServerId = "agentics_mcp",
    [string]$Email = $env:OPENWEBUI_ADMIN_EMAIL,
    [string]$Password = $env:OPENWEBUI_ADMIN_PASSWORD
)

Write-Host "`n=== Register Agentics MCP in Open WebUI ===" -ForegroundColor Cyan

$Token = $env:OPENWEBUI_API_KEY
if ([string]::IsNullOrWhiteSpace($Token)) {
    $Token = Read-Host "Paste an Open WebUI API key/JWT, or press Enter to sign in"
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    if (-not [string]::IsNullOrWhiteSpace($Email) -and -not [string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "Signing in with provided Open WebUI admin credentials" -ForegroundColor Yellow
    } else {
        $Email = Read-Host "Open WebUI admin email"
        $SecurePassword = Read-Host "Open WebUI admin password" -AsSecureString
        $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
        try {
            $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }
    }

    $signinBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $signin = Invoke-RestMethod `
        -Uri "$BaseUrl/api/v1/auths/signin" `
        -Method Post `
        -ContentType "application/json" `
        -Body $signinBody

    $Token = $signin.token
}

$Headers = @{ Authorization = "Bearer $Token" }

$current = Invoke-RestMethod `
    -Uri "$BaseUrl/api/v1/configs/tool_servers" `
    -Headers $Headers `
    -Method Get

$connections = @()
if ($current.TOOL_SERVER_CONNECTIONS) {
    $connections = @($current.TOOL_SERVER_CONNECTIONS | Where-Object {
        $_.info.id -ne $ServerId -and $_.url -ne $McpUrl
    })
}

$agenticsMcp = [ordered]@{
    url       = $McpUrl
    path      = ""
    type      = "mcp"
    auth_type = "none"
    headers   = @{}
    key       = ""
    config    = [ordered]@{
        enable        = $true
        access_grants = @(
            [ordered]@{
                principal_type = "user"
                principal_id   = "*"
                permission     = "read"
            }
        )
    }
    info      = [ordered]@{
        id          = $ServerId
        name        = "Agentics MCP"
        description = "Local Agentics MCP tools for service health checks and Agentics automations."
    }
}

$connections += $agenticsMcp

$body = @{
    TOOL_SERVER_CONNECTIONS = $connections
} | ConvertTo-Json -Depth 50

Invoke-RestMethod `
    -Uri "$BaseUrl/api/v1/configs/tool_servers" `
    -Headers $Headers `
    -Method Post `
    -ContentType "application/json" `
    -Body $body | Out-Null

Write-Host "Registered MCP server: Agentics MCP" -ForegroundColor Green
Write-Host "Open WebUI container URL: $McpUrl" -ForegroundColor Green
Write-Host "Local health check: http://127.0.0.1:8766/health" -ForegroundColor Cyan