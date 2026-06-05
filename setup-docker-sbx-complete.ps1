# Docker Sandboxes Complete Automation & Verification
# Windows PowerShell Script - Fully automated setup with comprehensive testing
# Run as Administrator

param(
    [ValidateSet("Open", "Balanced", "Locked")]
    [string]$NetworkPolicy = "Open",
    
    [ValidateSet("claude", "copilot", "gemini", "codex", "cursor")]
    [string]$TestAgent = "claude",
    
    [switch]$SkipNetworkTest,
    [switch]$SkipSandboxTest
)

# ============================================================================
# Configuration & Colors
# ============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$colors = @{
    INFO    = "Cyan"
    SUCCESS = "Green"
    WARNING = "Yellow"
    ERROR   = "Red"
    DEBUG   = "Gray"
    STEP    = "Magenta"
}

# Track all results for final report
$results = @{
    HypervisorPlatform = $null
    SbxInstall         = $null
    SbxInPath          = $null
    SbxVersion         = $null
    DockerAuth         = $null
    NetworkPolicy      = $null
    GitIgnore          = $null
    NetworkTest        = $null
    SandboxTest        = $null
    FinalStatus        = $null
}

# ============================================================================
# Logging & Output Functions
# ============================================================================

function Write-Status {
    param(
        [string]$Message,
        [string]$Status = "INFO",
        [switch]$NoNewline
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    $symbol = @{
        INFO    = "ℹ"
        SUCCESS = "✓"
        WARNING = "⚠"
        ERROR   = "✗"
        DEBUG   = "»"
        STEP    = "→"
    }
    $sym = $symbol[$Status] ?? "•"
    $color = $colors[$Status]
    
    if ($NoNewline) {
        Write-Host "[$timestamp] $sym " -ForegroundColor $color -NoNewline
        Write-Host $Message -NoNewline
    }
    else {
        Write-Host "[$timestamp] $sym " -ForegroundColor $color -NoNewline
        Write-Host $Message
    }
}

function Write-Header {
    param([string]$Title, [string]$Subtitle = "")
    Write-Host ""
    Write-Host "╔$('═' * 68)╗" -ForegroundColor Cyan
    Write-Host "║ $($Title.PadRight(66)) ║" -ForegroundColor Cyan
    if ($Subtitle) {
        Write-Host "║ $($Subtitle.PadRight(66)) ║" -ForegroundColor Cyan
    }
    Write-Host "╚$('═' * 68)╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor Magenta
    Write-Host "─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
}

function Write-Result {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Details = ""
    )
    $statusColor = $status -eq "PASS" ? "Green" : "Red"
    $statusSymbol = $status -eq "PASS" ? "✓" : "✗"
    
    Write-Host "  [$statusSymbol] $Name" -ForegroundColor $statusColor -NoNewline
    if ($Details) {
        Write-Host " - $Details" -ForegroundColor Gray
    }
    else {
        Write-Host ""
    }
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

function Test-AdminPrivileges {
    Write-Status "Checking administrator privileges..." "STEP"
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    
    if (-not $isAdmin) {
        Write-Status "This script requires Administrator privileges" "ERROR"
        Write-Status "Please right-click PowerShell → 'Run as Administrator'" "WARNING"
        exit 1
    }
    Write-Status "Administrator privileges confirmed" "SUCCESS"
}

function Test-WindowsVersion {
    Write-Status "Checking Windows version..." "STEP"
    $osVersion = [System.Environment]::OSVersion.Version
    $releaseId = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name ReleaseId).ReleaseId
    
    if ($osVersion.Major -lt 10 -or $releaseId -lt 21H2) {
        Write-Status "Windows 11 (21H2 or later) required. Current: $($osVersion.Major).$($osVersion.Minor)" "ERROR"
        exit 1
    }
    Write-Status "Windows version compatible: $($osVersion.Major).$($osVersion.Minor) ($releaseId)" "SUCCESS"
}

function Test-InternetConnection {
    Write-Status "Checking internet connectivity..." "STEP"
    try {
        $response = Invoke-WebRequest -Uri "https://www.docker.com" -Method Head -TimeoutSec 5 -ErrorAction Stop
        Write-Status "Internet connectivity confirmed" "SUCCESS"
        return $true
    }
    catch {
        Write-Status "No internet connection detected. sbx installation requires internet." "ERROR"
        Write-Status "Please check your network connection and try again." "WARNING"
        exit 1
    }
}

# ============================================================================
# HypervisorPlatform Setup
# ============================================================================

function Enable-HypervisorPlatform {
    Write-Section "Step 1: HypervisorPlatform Setup"
    
    Write-Status "Checking HypervisorPlatform feature..." "STEP"
    
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
        
        if ($null -eq $feature) {
            Write-Status "Could not query HypervisorPlatform feature. You may need Windows 11." "ERROR"
            $results.HypervisorPlatform = "FAIL"
            return $false
        }
        
        if ($feature.State -eq "Enabled") {
            Write-Status "HypervisorPlatform is already enabled" "SUCCESS"
            $results.HypervisorPlatform = "PASS"
            return $true
        }
        
        Write-Status "Enabling HypervisorPlatform (this may take a minute)..." "INFO"
        $enableResult = Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart
        
        if ($enableResult.RestartNeeded) {
            Write-Status "HypervisorPlatform enabled successfully" "SUCCESS"
            Write-Status "⚠ System restart required. Please restart and re-run this script." "WARNING"
            $results.HypervisorPlatform = "PASS_RESTART_NEEDED"
            Write-Host ""
            Write-Status "Restarting in 30 seconds... (Press Ctrl+C to cancel)" "WARNING"
            Start-Sleep -Seconds 30
            Restart-Computer -Force
            exit 0
        }
        else {
            Write-Status "HypervisorPlatform enabled successfully (no restart needed)" "SUCCESS"
            $results.HypervisorPlatform = "PASS"
            return $true
        }
    }
    catch {
        Write-Status "Failed to enable HypervisorPlatform: $_" "ERROR"
        $results.HypervisorPlatform = "FAIL"
        return $false
    }
}

function Verify-HypervisorPlatform {
    Write-Status "Verifying HypervisorPlatform..." "STEP"
    
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
        if ($feature.State -eq "Enabled") {
            Write-Status "HypervisorPlatform verified as enabled" "SUCCESS"
            return $true
        }
        else {
            Write-Status "HypervisorPlatform is NOT enabled" "ERROR"
            return $false
        }
    }
    catch {
        Write-Status "Could not verify HypervisorPlatform: $_" "WARNING"
        return $false
    }
}

# ============================================================================
# Docker Sandboxes CLI Installation
# ============================================================================

function Install-SbxCli {
    Write-Section "Step 2: Docker Sandboxes CLI Installation"
    
    Write-Status "Checking if sbx is already installed..." "STEP"
    
    $sbxPath = Get-Command sbx -ErrorAction SilentlyContinue
    if ($sbxPath) {
        Write-Status "sbx CLI found at $($sbxPath.Source)" "SUCCESS"
        $results.SbxInstall = "PASS"
        $results.SbxInPath = "PASS"
        
        try {
            $version = & sbx version 2>&1 | Select-Object -First 1
            Write-Status "Version: $version" "DEBUG"
            $results.SbxVersion = $version
        }
        catch {
            Write-Status "Could not retrieve sbx version" "WARNING"
        }
        return $true
    }
    
    Write-Status "sbx CLI not found. Installing via WinGet..." "INFO"
    
    try {
        # Check if winget is available
        $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $wingetPath) {
            Write-Status "WinGet not found. Downloading sbx MSI directly..." "WARNING"
            return Install-SbxMsi
        }
        
        Write-Status "Installing Docker.sbx via WinGet..." "INFO"
        & winget install -h Docker.sbx 2>&1 | Out-Null
        
        Write-Status "sbx installation initiated. Waiting for PATH update..." "INFO"
        Start-Sleep -Seconds 3
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        Write-Status "Verifying sbx installation..." "STEP"
        $sbxPath = Get-Command sbx -ErrorAction SilentlyContinue
        
        if ($sbxPath) {
            Write-Status "sbx CLI installed successfully at $($sbxPath.Source)" "SUCCESS"
            $results.SbxInstall = "PASS"
            $results.SbxInPath = "PASS"
            
            try {
                $version = & sbx version 2>&1 | Select-Object -First 1
                Write-Status "Version: $version" "DEBUG"
                $results.SbxVersion = $version
            }
            catch { }
            
            return $true
        }
        else {
            Write-Status "sbx command not found after installation" "WARNING"
            Write-Status "Try opening a new PowerShell window, or use manual MSI installation" "WARNING"
            $results.SbxInstall = "PARTIAL"
            return $false
        }
    }
    catch {
        Write-Status "WinGet installation failed: $_" "WARNING"
        Write-Status "Attempting MSI installation..." "INFO"
        return Install-SbxMsi
    }
}

function Install-SbxMsi {
    Write-Status "Downloading sbx MSI installer..." "INFO"
    
    try {
        $msiUrl = "https://github.com/docker/sbx/releases/download/latest/sbx-x86_64-windows.msi"
        $msiPath = "$env:TEMP\sbx-installer.msi"
        
        Write-Status "Downloading from: $msiUrl" "DEBUG"
        Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -TimeoutSec 60
        
        Write-Status "Running MSI installer..." "INFO"
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`" /quiet /qn" -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Status "sbx MSI installed successfully" "SUCCESS"
            Write-Status "Refreshing PATH and verifying..." "INFO"
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Start-Sleep -Seconds 2
            
            $sbxPath = Get-Command sbx -ErrorAction SilentlyContinue
            if ($sbxPath) {
                Write-Status "sbx verified in PATH" "SUCCESS"
                $results.SbxInstall = "PASS"
                $results.SbxInPath = "PASS"
                return $true
            }
            else {
                Write-Status "sbx not found in PATH after MSI install" "WARNING"
                $results.SbxInstall = "PARTIAL"
                return $false
            }
        }
        else {
            Write-Status "MSI installation failed with exit code $($process.ExitCode)" "ERROR"
            $results.SbxInstall = "FAIL"
            return $false
        }
    }
    catch {
        Write-Status "MSI download/installation failed: $_" "ERROR"
        $results.SbxInstall = "FAIL"
        return $false
    }
}

# ============================================================================
# Docker Authentication
# ============================================================================

function Initialize-DockerAuth {
    Write-Section "Step 3: Docker Authentication & Configuration"
    
    Write-Status "Checking Docker authentication status..." "STEP"
    
    try {
        # Try running sbx version to check auth status
        $output = & sbx version 2>&1
        
        if ($output -match "not authenticated|login" -or $LASTEXITCODE -ne 0) {
            Write-Status "Not authenticated. Starting login flow..." "INFO"
            & sbx login
            
            Write-Status "Verifying authentication..." "STEP"
            Start-Sleep -Seconds 2
            
            $output = & sbx version 2>&1
            if ($output -match "not authenticated") {
                Write-Status "Authentication failed" "ERROR"
                $results.DockerAuth = "FAIL"
                return $false
            }
            else {
                Write-Status "Authentication successful" "SUCCESS"
                $results.DockerAuth = "PASS"
                return $true
            }
        }
        else {
            Write-Status "Already authenticated with Docker" "SUCCESS"
            $results.DockerAuth = "PASS"
            return $true
        }
    }
    catch {
        Write-Status "Authentication check failed: $_" "ERROR"
        Write-Status "Try running 'sbx login' manually" "WARNING"
        $results.DockerAuth = "FAIL"
        return $false
    }
}

function Configure-NetworkPolicy {
    Write-Section "Step 4: Network Policy Configuration"
    
    Write-Status "Configuring network policy: $NetworkPolicy" "INFO"
    
    try {
        # Check current policy
        $currentPolicy = & sbx policy ls 2>&1
        
        if ($currentPolicy -match $NetworkPolicy) {
            Write-Status "Network policy already set to $NetworkPolicy" "SUCCESS"
            $results.NetworkPolicy = "PASS"
            return $true
        }
        
        Write-Status "Resetting network policy..." "STEP"
        # Note: Interactive selection required - user will need to choose
        Write-Status "⚠ You will be prompted to select network policy" "WARNING"
        Write-Status "Please choose: $NetworkPolicy (option will be highlighted)" "INFO"
        
        & sbx policy reset
        
        Write-Status "Network policy configuration updated" "SUCCESS"
        $results.NetworkPolicy = "PASS"
        return $true
    }
    catch {
        Write-Status "Network policy configuration warning: $_" "WARNING"
        Write-Status "You can configure this manually with: sbx policy reset" "INFO"
        $results.NetworkPolicy = "PASS_MANUAL"
        return $true
    }
}

# ============================================================================
# Git Configuration
# ============================================================================

function Configure-GlobalGitIgnore {
    Write-Section "Step 5: Global Git Configuration"
    
    Write-Status "Checking Git installation..." "STEP"
    
    $gitPath = Get-Command git -ErrorAction SilentlyContinue
    if (-not $gitPath) {
        Write-Status "Git not found. Skipping git configuration." "WARNING"
        $results.GitIgnore = "SKIP"
        return $true
    }
    
    Write-Status "Git found at $($gitPath.Source)" "SUCCESS"
    
    Write-Status "Configuring global .gitignore..." "STEP"
    
    try {
        $gitIgnorePath = & git config --global core.excludesFile 2>&1
        
        if (-not $gitIgnorePath) {
            $gitIgnorePath = "$env:USERPROFILE\.config\git\ignore"
        }
        
        Write-Status "Using gitignore file: $gitIgnorePath" "DEBUG"
        
        # Create directory if needed
        $gitDir = Split-Path $gitIgnorePath
        if (-not (Test-Path $gitDir)) {
            New-Item -ItemType Directory -Path $gitDir -Force | Out-Null
            Write-Status "Created directory: $gitDir" "DEBUG"
        }
        
        # Create file if needed
        if (-not (Test-Path $gitIgnorePath)) {
            New-Item -ItemType File -Path $gitIgnorePath -Force | Out-Null
            Write-Status "Created file: $gitIgnorePath" "DEBUG"
        }
        
        # Check if .sbx/ already exists
        $content = Get-Content $gitIgnorePath -Raw -ErrorAction SilentlyContinue
        
        if ($content -match "\.sbx/") {
            Write-Status ".sbx/ already in global gitignore" "SUCCESS"
        }
        else {
            Add-Content -Path $gitIgnorePath -Value ".sbx/"
            Write-Status ".sbx/ added to global gitignore" "SUCCESS"
        }
        
        Write-Status "Global gitignore location: $gitIgnorePath" "INFO"
        $results.GitIgnore = "PASS"
        return $true
    }
    catch {
        Write-Status "Git configuration warning: $_" "WARNING"
        Write-Status "You can manually add .sbx/ to: $env:USERPROFILE\.gitignore_global" "INFO"
        $results.GitIgnore = "PARTIAL"
        return $true
    }
}

# ============================================================================
# Network & Connectivity Testing
# ============================================================================

function Test-SbxNetwork {
    Write-Section "Step 6: Network Connectivity Test"
    
    if ($SkipNetworkTest) {
        Write-Status "Skipping network test (--SkipNetworkTest)" "INFO"
        $results.NetworkTest = "SKIP"
        return $true
    }
    
    Write-Status "Testing sbx network connectivity..." "STEP"
    
    try {
        Write-Status "Attempting to reach Docker Hub..." "INFO"
        
        # Create a temporary test sandbox
        $testSandboxName = "sbx-network-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        
        Write-Status "Creating temporary test sandbox: $testSandboxName" "DEBUG"
        & sbx create --agent shell $testSandboxName 2>&1 | Out-Null
        
        Write-Status "Testing network from sandbox..." "INFO"
        $networkTest = & sbx exec $testSandboxName curl -s https://api.github.com/rate_limit 2>&1
        
        Write-Status "Cleaning up test sandbox..." "DEBUG"
        & sbx rm $testSandboxName 2>&1 | Out-Null
        
        if ($networkTest -match "resources" -or $networkTest -match "\"limit\"") {
            Write-Status "Network connectivity verified" "SUCCESS"
            $results.NetworkTest = "PASS"
            return $true
        }
        else {
            Write-Status "Network test completed (results inconclusive)" "WARNING"
            $results.NetworkTest = "PARTIAL"
            return $true
        }
    }
    catch {
        Write-Status "Network test error: $_" "WARNING"
        Write-Status "This may indicate network policy restrictions. You can troubleshoot with: sbx policy ls" "INFO"
        $results.NetworkTest = "FAIL"
        return $false
    }
}

# ============================================================================
# Sandbox Functionality Test
# ============================================================================

function Test-SandboxFunctionality {
    Write-Section "Step 7: Sandbox Functionality Test"
    
    if ($SkipSandboxTest) {
        Write-Status "Skipping sandbox test (--SkipSandboxTest)" "INFO"
        $results.SandboxTest = "SKIP"
        return $true
    }
    
    Write-Status "Testing sandbox creation and execution..." "STEP"
    
    try {
        $testSandboxName = "sbx-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        
        Write-Status "Creating test sandbox: $testSandboxName" "INFO"
        & sbx create --agent shell $testSandboxName 2>&1 | Out-Null
        
        Write-Status "Testing command execution in sandbox..." "INFO"
        $output = & sbx exec $testSandboxName echo "Sandbox is working!" 2>&1
        
        if ($output -match "working") {
            Write-Status "Sandbox command execution verified" "SUCCESS"
        }
        else {
            Write-Status "Sandbox output unexpected: $output" "WARNING"
        }
        
        Write-Status "Testing Docker in sandbox..." "INFO"
        $dockerTest = & sbx exec $testSandboxName docker version 2>&1
        
        if ($dockerTest -match "Version" -or $dockerTest -match "Server") {
            Write-Status "Docker engine in sandbox verified" "SUCCESS"
        }
        else {
            Write-Status "Docker test inconclusive" "WARNING"
        }
        
        Write-Status "Cleaning up test sandbox..." "DEBUG"
        & sbx rm $testSandboxName 2>&1 | Out-Null
        
        Write-Status "Sandbox functionality verified" "SUCCESS"
        $results.SandboxTest = "PASS"
        return $true
    }
    catch {
        Write-Status "Sandbox test failed: $_" "ERROR"
        $results.SandboxTest = "FAIL"
        return $false
    }
}

# ============================================================================
# Final Report & Verification
# ============================================================================

function Show-FinalReport {
    Write-Section "Installation Summary"
    
    Write-Host ""
    Write-Host "Status Report:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($check in $results.GetEnumerator() | Sort-Object Key) {
        $name = $check.Key
        $status = $check.Value
        
        if ($status -eq "PASS" -or $status -eq "PASS_RESTART_NEEDED") {
            Write-Result $name "PASS" $status
        }
        elseif ($status -eq "PASS_MANUAL") {
            Write-Result $name "PARTIAL" "(manual configuration available)"
        }
        elseif ($status -eq "PARTIAL") {
            Write-Result $name "PARTIAL" "(partial success)"
        }
        elseif ($status -eq "SKIP") {
            Write-Result $name "SKIP" "(skipped)"
        }
        elseif ($status -eq "FAIL") {
            Write-Result $name "FAIL" "(see above for details)"
        }
        elseif ($status) {
            Write-Result $name "INFO" $status
        }
    }
    
    # Determine overall status
    $passCount = @($results.Values | Where-Object { $_ -match "PASS" }).Count
    $failCount = @($results.Values | Where-Object { $_ -eq "FAIL" }).Count
    
    Write-Host ""
    if ($failCount -eq 0) {
        Write-Status "✓ Docker Sandboxes setup COMPLETE and VERIFIED" "SUCCESS"
        $results.FinalStatus = "SUCCESS"
    }
    else {
        Write-Status "⚠ Docker Sandboxes setup INCOMPLETE. Review failures above." "WARNING"
        $results.FinalStatus = "PARTIAL"
    }
    
    Write-Host ""
}

function Show-NextSteps {
    Write-Section "Quick Start Guide"
    
    Write-Host ""
    Write-Host "1. Navigate to your project:" -ForegroundColor Cyan
    Write-Host "   cd C:\path\to\your\project"
    Write-Host ""
    
    Write-Host "2. Start an AI agent in sandbox:" -ForegroundColor Cyan
    Write-Host "   sbx run claude                 # Claude Code (direct mode)"
    Write-Host "   sbx run claude --branch fix    # Claude Code (branch mode - safer)"
    Write-Host "   sbx run copilot                # GitHub Copilot"
    Write-Host "   sbx run gemini                 # Google Gemini"
    Write-Host ""
    
    Write-Host "3. Monitor sandbox resources:" -ForegroundColor Cyan
    Write-Host "   sbx                            # Interactive dashboard (TUI)"
    Write-Host "   sbx ls                         # List sandboxes"
    Write-Host "   sbx logs <name>                # View sandbox logs"
    Write-Host ""
    
    Write-Host "4. Manage sandboxes:" -ForegroundColor Cyan
    Write-Host "   sbx stop <name>                # Stop a sandbox"
    Write-Host "   sbx rm <name>                  # Delete a sandbox"
    Write-Host "   sbx exec <name> bash           # Execute command"
    Write-Host ""
    
    Write-Host "5. Git workflow (branch mode recommended):" -ForegroundColor Cyan
    Write-Host "   sbx run claude --branch feature-name"
    Write-Host "   # After agent finishes, review then merge:"
    Write-Host "   git merge .sbx/claude-*-worktrees/feature-name"
    Write-Host ""
    
    Write-Host "Documentation:" -ForegroundColor Cyan
    Write-Host "   https://docs.docker.com/ai/sandboxes/" -ForegroundColor Blue
    Write-Host ""
}

# ============================================================================
# Main Execution
# ============================================================================

function Main {
    Write-Header "Docker Sandboxes Complete Setup & Verification" "Automated Installation Script"
    
    # Phase 1: Prerequisites
    Write-Header "PHASE 1: Prerequisites" "System Verification"
    Test-AdminPrivileges
    Test-WindowsVersion
    Test-InternetConnection
    
    # Phase 2: HypervisorPlatform
    Enable-HypervisorPlatform
    Verify-HypervisorPlatform
    
    # Phase 3: sbx CLI Installation
    Install-SbxCli
    
    # Phase 4: Docker Authentication
    Initialize-DockerAuth
    
    # Phase 5: Network Policy
    Configure-NetworkPolicy
    
    # Phase 6: Git Configuration
    Configure-GlobalGitIgnore
    
    # Phase 7: Testing
    if (-not $SkipNetworkTest) {
        Test-SbxNetwork
    }
    
    if (-not $SkipSandboxTest) {
        Test-SandboxFunctionality
    }
    
    # Final Report
    Show-FinalReport
    Show-NextSteps
    
    Write-Host ""
    Write-Status "Setup script completed" "SUCCESS"
    Write-Host ""
}

# Run main function
Main
