# Docker Sandboxes Setup Validation Script
# Simple quick-check after running setup

function Test-SbxSetup {
    param(
        [switch]$Detailed
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     Docker Sandboxes Setup Validation                      ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    $passed = 0
    $failed = 0
    $warnings = 0
    
    # Check 1: HypervisorPlatform
    Write-Host "Check 1: HypervisorPlatform Status" -ForegroundColor Magenta
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -ErrorAction SilentlyContinue
        if ($feature.State -eq "Enabled") {
            Write-Host "  ✓ HypervisorPlatform is enabled" -ForegroundColor Green
            $passed++
        }
        else {
            Write-Host "  ✗ HypervisorPlatform is NOT enabled" -ForegroundColor Red
            Write-Host "    Run: Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All" -ForegroundColor Yellow
            $failed++
        }
    }
    catch {
        Write-Host "  ⚠ Could not check HypervisorPlatform: $_" -ForegroundColor Yellow
        $warnings++
    }
    Write-Host ""
    
    # Check 2: sbx in PATH
    Write-Host "Check 2: sbx CLI Available" -ForegroundColor Magenta
    $sbxPath = Get-Command sbx -ErrorAction SilentlyContinue
    if ($sbxPath) {
        Write-Host "  ✓ sbx found at: $($sbxPath.Source)" -ForegroundColor Green
        $passed++
    }
    else {
        Write-Host "  ✗ sbx not found in PATH" -ForegroundColor Red
        Write-Host "    Try: Open a new PowerShell window or reinstall with: winget install Docker.sbx" -ForegroundColor Yellow
        $failed++
    }
    Write-Host ""
    
    # Check 3: sbx Version
    if ($sbxPath) {
        Write-Host "Check 3: sbx Version" -ForegroundColor Magenta
        try {
            $version = & sbx version 2>&1
            Write-Host "  ✓ $version" -ForegroundColor Green
            $passed++
        }
        catch {
            Write-Host "  ✗ Could not get sbx version: $_" -ForegroundColor Red
            $failed++
        }
        Write-Host ""
    }
    
    # Check 4: Docker Authentication
    Write-Host "Check 4: Docker Authentication" -ForegroundColor Magenta
    try {
        $output = & sbx version 2>&1
        if ($output -match "not authenticated") {
            Write-Host "  ✗ Not authenticated with Docker" -ForegroundColor Red
            Write-Host "    Run: sbx login" -ForegroundColor Yellow
            $failed++
        }
        else {
            Write-Host "  ✓ Authenticated with Docker" -ForegroundColor Green
            $passed++
        }
    }
    catch {
        Write-Host "  ⚠ Could not check authentication: $_" -ForegroundColor Yellow
        $warnings++
    }
    Write-Host ""
    
    # Check 5: Sandboxes List
    Write-Host "Check 5: Sandbox Daemon" -ForegroundColor Magenta
    try {
        $sandboxes = & sbx ls 2>&1
        if ($sandboxes -match "NAME|No sandboxes") {
            Write-Host "  ✓ Sandbox daemon is running" -ForegroundColor Green
            $passed++
            
            if ($Detailed) {
                $count = ($sandboxes | Measure-Object -Line).Lines
                Write-Host "    Sandboxes: $(($count - 1) / 2) active" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "  ⚠ Sandbox list output unexpected" -ForegroundColor Yellow
            $warnings++
        }
    }
    catch {
        Write-Host "  ✗ Sandbox daemon error: $_" -ForegroundColor Red
        $failed++
    }
    Write-Host ""
    
    # Check 6: Network Policy
    Write-Host "Check 6: Network Policy" -ForegroundColor Magenta
    try {
        $policy = & sbx policy ls 2>&1 | Select-Object -First 1
        if ($policy) {
            Write-Host "  ✓ Network policy configured: $policy" -ForegroundColor Green
            $passed++
            
            if ($Detailed) {
                Write-Host "    Run 'sbx policy ls' for full policy details" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "  ⚠ Network policy not configured" -ForegroundColor Yellow
            Write-Host "    Run: sbx policy reset" -ForegroundColor Yellow
            $warnings++
        }
    }
    catch {
        Write-Host "  ⚠ Could not check network policy: $_" -ForegroundColor Yellow
        $warnings++
    }
    Write-Host ""
    
    # Check 7: Git Ignore
    Write-Host "Check 7: Git Global Ignore" -ForegroundColor Magenta
    try {
        $gitIgnorePath = & git config --global core.excludesFile 2>&1
        if (-not $gitIgnorePath) {
            $gitIgnorePath = "$env:USERPROFILE\.config\git\ignore"
        }
        
        if (Test-Path $gitIgnorePath) {
            $content = Get-Content $gitIgnorePath -Raw
            if ($content -match "\.sbx/") {
                Write-Host "  ✓ .sbx/ in global gitignore at: $gitIgnorePath" -ForegroundColor Green
                $passed++
            }
            else {
                Write-Host "  ⚠ .sbx/ not found in gitignore" -ForegroundColor Yellow
                Write-Host "    Add: echo '.sbx/' >> '$gitIgnorePath'" -ForegroundColor Yellow
                $warnings++
            }
        }
        else {
            Write-Host "  ⚠ Git ignore file not found: $gitIgnorePath" -ForegroundColor Yellow
            Write-Host "    Create it with: echo '.sbx/' > '$gitIgnorePath'" -ForegroundColor Yellow
            $warnings++
        }
    }
    catch {
        Write-Host "  ⚠ Could not check git configuration: $_" -ForegroundColor Yellow
        $warnings++
    }
    Write-Host ""
    
    # Summary
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                     SUMMARY                               ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "  ✓ Passed:   $passed" -ForegroundColor Green
    Write-Host "  ⚠ Warnings: $warnings" -ForegroundColor Yellow
    Write-Host "  ✗ Failed:   $failed" -ForegroundColor Red
    Write-Host ""
    
    if ($failed -eq 0 -and $warnings -eq 0) {
        Write-Host "  🎉 All checks passed! Docker Sandboxes is ready to use." -ForegroundColor Green
        Write-Host ""
        Write-Host "  Quick start:" -ForegroundColor Cyan
        Write-Host "    cd C:\your\project" -ForegroundColor Gray
        Write-Host "    sbx run claude" -ForegroundColor Gray
        Write-Host ""
        return $true
    }
    elseif ($failed -eq 0) {
        Write-Host "  ⚠ Setup is mostly working, but some configurations are recommended." -ForegroundColor Yellow
        Write-Host ""
        return $true
    }
    else {
        Write-Host "  ✗ Setup has errors. Please fix the issues above." -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

# Export the function
Export-ModuleMember -Function Test-SbxSetup

# If run directly, execute the test
if ($MyInvocation.InvocationName -eq ".") {
    Write-Host "To run validation, use: Test-SbxSetup"
    Write-Host "For detailed output:   Test-SbxSetup -Detailed"
}
else {
    # Run if script is executed directly
    Test-SbxSetup -Detailed
}
