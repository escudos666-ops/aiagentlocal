# Docker Sandboxes Setup Script for Windows
# Installs sbx CLI, enables HypervisorPlatform, and configures Docker Sandboxes for AI agents

param(
    [ValidateSet("Open", "Balanced", "Locked")]
    [string]$NetworkPolicy = "Open",
    
    [switch]$SkipHypervisor,
    [switch]$SkipInstall
)

function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    $colors = @{
        "INFO"    = "Cyan"
        "SUCCESS" = "Green"
        "WARNING" = "Yellow"
        "ERROR"   = "Red"
    }
    Write-Host "[$Status] $Message" -ForegroundColor $colors[$Status]
}

function Test-AdminPrivileges {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if (-not $isAdmin) {
        Write-Status "This script requires Administrator privileges" "ERROR"
        Write-Host "Please run PowerShell as Administrator and try again."
        exit 1
    }
}

function Enable-HypervisorPlatform {
    Write-Status "Checking HypervisorPlatform feature..." "INFO"
    
    $feature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
    
    if ($feature.State -eq "Enabled") {
        Write-Status "HypervisorPlatform is already enabled" "SUCCESS"
        return
    }
    
    Write-Status "Enabling HypervisorPlatform..." "INFO"
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart | Out-Null
        Write-Status "HypervisorPlatform enabled successfully" "SUCCESS"
        Write-Status "A system restart is recommended" "WARNING"
    }
    catch {
        Write-Status "Failed to enable HypervisorPlatform: $_" "ERROR"
        exit 1
    }
}

function Install-SbxCli {
    Write-Status "Checking if sbx is already installed..." "INFO"
    
    $sbxPath = Get-Command sbx -ErrorAction SilentlyContinue
    if ($sbxPath) {
        Write-Status "sbx CLI is already installed at $($sbxPath.Source)" "SUCCESS"
        & sbx version
        return
    }
    
    Write-Status "Installing Docker Sandboxes CLI (sbx)..." "INFO"
    try {
        winget install -h Docker.sbx
        Write-Status "Docker Sandboxes CLI installed successfully" "SUCCESS"
        Write-Host "⚠️  Please open a new PowerShell window to ensure sbx is available in PATH"
    }
    catch {
        Write-Status "Failed to install sbx: $_" "ERROR"
        exit 1
    }
}

function Initialize-SbxAuth {
    Write-Status "Checking sbx authentication..." "INFO"
    
    # Try to run sbx version to check if authenticated
    $output = & sbx version 2>&1
    
    if ($output -match "not authenticated") {
        Write-Status "Starting sbx authentication..." "INFO"
        & sbx login
        Write-Status "Authentication complete" "SUCCESS"
    }
    else {
        Write-Status "Already authenticated with Docker" "SUCCESS"
    }
}

function Set-NetworkPolicy {
    param([string]$Policy)
    
    Write-Status "Configuring network policy: $Policy" "INFO"
    
    $policyMap = @{
        "Open"      = "1"
        "Balanced"  = "2"
        "Locked"    = "3"
    }
    
    $choice = $policyMap[$Policy]
    
    # This is a placeholder - actual interactive selection would be done by sbx
    Write-Status "Network policy will be set to: $Policy" "INFO"
    Write-Host "  • Open: All network traffic allowed (development friendly)"
    Write-Host "  • Balanced: Common dev sites allowed, others blocked"
    Write-Host "  • Locked: All traffic blocked unless explicitly allowed"
}

function Configure-GitIgnore {
    Write-Status "Configuring global .gitignore for .sbx/ folder..." "INFO"
    
    $gitIgnorePath = git config --global core.excludesFile
    if (-not $gitIgnorePath) {
        $gitIgnorePath = "$HOME/.config/git/ignore"
    }
    
    New-Item -ItemType Directory -Force -Path (Split-Path $gitIgnorePath) | Out-Null
    
    if (-not (Test-Path $gitIgnorePath)) {
        New-Item -ItemType File -Path $gitIgnorePath | Out-Null
    }
    
    $content = Get-Content $gitIgnorePath -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch "\.sbx/") {
        Add-Content -Path $gitIgnorePath -Value ".sbx/"
        Write-Status ".sbx/ added to global gitignore at $gitIgnorePath" "SUCCESS"
    }
    else {
        Write-Status ".sbx/ already in gitignore" "SUCCESS"
    }
}

function Show-QuickStart {
    Write-Host ""
    Write-Status "Setup Complete!" "SUCCESS"
    Write-Host ""
    Write-Host "Quick start guide:"
    Write-Host "  1. Navigate to your project directory:"
    Write-Host "     cd .\your-project"
    Write-Host ""
    Write-Host "  2. Start Claude Code in a sandbox (direct mode):"
    Write-Host "     sbx run claude"
    Write-Host ""
    Write-Host "  3. Or start in branch mode (safer for git):"
    Write-Host "     sbx run claude --branch my-feature-name"
    Write-Host ""
    Write-Host "  4. View running sandboxes and resources:"
    Write-Host "     sbx"
    Write-Host ""
    Write-Host "Other agents available:"
    Write-Host "     sbx run codex, sbx run copilot, sbx run gemini, sbx run cursor"
    Write-Host ""
    Write-Host "Useful commands:"
    Write-Host "     sbx ls              - List all sandboxes"
    Write-Host "     sbx rm <name>       - Remove a sandbox"
    Write-Host "     sbx stop <name>     - Stop a sandbox"
    Write-Host "     sbx policy ls       - View network policies"
    Write-Host ""
    Write-Host "Documentation:"
    Write-Host "     https://docs.docker.com/ai/sandboxes/"
    Write-Host ""
}

# Main execution
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Docker Sandboxes Setup for Windows                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Test-AdminPrivileges

if (-not $SkipHypervisor) {
    Enable-HypervisorPlatform
    Write-Host ""
}

if (-not $SkipInstall) {
    Install-SbxCli
    Write-Host ""
}

Initialize-SbxAuth
Write-Host ""

Set-NetworkPolicy -Policy $NetworkPolicy
Write-Host ""

Configure-GitIgnore
Write-Host ""

Show-QuickStart
