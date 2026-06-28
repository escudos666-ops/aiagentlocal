$BaseUrl = "http://127.0.0.1:3000"

Write-Host "`n=== Open WebUI Agentics model-with-tools installer ===" -ForegroundColor Cyan

$Token = Read-Host "Paste the same Open WebUI API key/JWT, or press Enter to sign in again"

if ([string]::IsNullOrWhiteSpace($Token)) {
    $Email = Read-Host "Open WebUI admin email"
    $SecurePassword = Read-Host "Open WebUI admin password" -AsSecureString
    $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
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

$Headers = @{
    Authorization = "Bearer $Token"
}

$ModelPayload = @{
    id            = "agentics-assistant-tools"
    name          = "Agentics Assistant + Tools"
    base_model_id = "agentics-assistant:latest"
    meta          = @{
        description  = "Agentics Assistant with Agentics Core Tools enabled by default."
        toolIds      = @("agentics_core_tools")
        capabilities = @{
            tools = $true
        }
        tags = @(
            @{ name = "agentics" },
            @{ name = "tools" },
            @{ name = "local" }
        )
    }
    params        = @{
        function_calling = "native"
        toolIds          = @("agentics_core_tools")
    }
    access_grants = @(
        @{
            principal_type = "user"
            principal_id   = "*"
            permission     = "read"
        }
    )
    is_active     = $true
} | ConvertTo-Json -Depth 50

$Exists = $false
try {
    Invoke-RestMethod `
        -Uri "$BaseUrl/api/v1/models/model?id=agentics-assistant-tools" `
        -Headers $Headers `
        -Method Get | Out-Null

    $Exists = $true
} catch {
    $Exists = $false
}

if ($Exists) {
    Write-Host "Updating model wrapper: agentics-assistant-tools" -ForegroundColor Yellow

    Invoke-RestMethod `
        -Uri "$BaseUrl/api/v1/models/model/update" `
        -Headers $Headers `
        -Method Post `
        -ContentType "application/json" `
        -Body $ModelPayload | Out-Null
} else {
    Write-Host "Creating model wrapper: agentics-assistant-tools" -ForegroundColor Green

    Invoke-RestMethod `
        -Uri "$BaseUrl/api/v1/models/create" `
        -Headers $Headers `
        -Method Post `
        -ContentType "application/json" `
        -Body $ModelPayload | Out-Null
}

Write-Host "`nModel ready: Agentics Assistant + Tools / agentics-assistant-tools" -ForegroundColor Green

Write-Host "`nCurrent models:" -ForegroundColor Cyan
Invoke-RestMethod `
    -Uri "$BaseUrl/api/v1/models/list" `
    -Headers $Headers `
    -Method Get | ConvertTo-Json -Depth 30
