# Docker Sandboxes: Complete Troubleshooting & Verification Guide

## Verification Checklist

### ✓ System Requirements Met?

```powershell
# Windows: Verify HypervisorPlatform
Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform
# Expected: State = "Enabled"

# macOS: Verify architecture
uname -m
# Expected: arm64
```

### ✓ sbx CLI Installed and in PATH?

```powershell
# Windows / macOS
which sbx          # macOS/Linux
where sbx          # Windows PowerShell
sbx version        # Should print version info
```

### ✓ Docker Authentication Working?

```powershell
sbx version
# Expected: Shows version, not "not authenticated"

# If not authenticated:
sbx login
```

### ✓ Network Policy Configured?

```powershell
sbx policy ls
# Expected: Shows "default" policies with allowed domains
```

### ✓ Git Ignore Configured?

```bash
git config --global core.excludesFile
# If empty, check default location:
# macOS/Linux: ~/.config/git/ignore
# Windows: %APPDATA%\.gitignore_global

# Verify .sbx/ is listed:
cat ~/.config/git/ignore | grep sbx
```

---

## Run Automated Verification

### Windows (PowerShell)

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\setup-docker-sbx-complete.ps1

# With custom options:
.\setup-docker-sbx-complete.ps1 -NetworkPolicy "Open" -TestAgent "claude" -SkipNetworkTest -SkipSandboxTest
```

### macOS (Bash)

```bash
chmod +x setup-docker-sbx-complete.sh
./setup-docker-sbx-complete.sh

# With custom options:
./setup-docker-sbx-complete.sh "Open" "claude"
SKIP_NETWORK_TEST=true ./setup-docker-sbx-complete.sh
```

---

## Common Issues & Solutions

### Issue: "sbx: command not found"

**Cause**: sbx not in PATH after installation

**Solutions**:
1. **Windows**: Open a NEW PowerShell window (PATH is only updated for new shells)
2. **Windows**: Manually refresh PATH:
   ```powershell
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
   sbx version
   ```
3. **macOS**: Refresh shell:
   ```bash
   eval "$(brew shellenv)"
   sbx version
   ```

### Issue: "HypervisorPlatform is not enabled"

**Cause**: Windows feature not enabled or system restart required

**Solutions**:
1. **Enable manually** (Admin PowerShell):
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
   ```
2. **Restart required**:
   ```powershell
   Restart-Computer
   ```
3. **Verify after restart**:
   ```powershell
   Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform
   ```

### Issue: "sbx not authenticated"

**Cause**: Not logged in to Docker

**Solution**:
```powershell
sbx login
# Follow the web browser authentication flow
```

### Issue: "Network policy not configured"

**Cause**: Missing network policy selection

**Solution**:
```powershell
sbx policy reset
# Choose: 1 (Open), 2 (Balanced), or 3 (Locked)
```

### Issue: "Cannot reach external URLs from sandbox"

**Cause**: Network policy too restrictive

**Solutions**:
1. **View current policy**:
   ```powershell
   sbx policy ls
   ```
2. **Switch to Open mode** (for development):
   ```powershell
   sbx policy reset
   # Select: 1 (Open)
   ```
3. **View allowed domains**:
   ```powershell
   sbx policy ls --show-rules
   ```
4. **Troubleshoot specific URL**:
   ```powershell
   sbx exec <sandbox-name> curl -v https://example.com
   ```

### Issue: ".sbx folder showing in git status"

**Cause**: .sbx not in gitignore

**Solution**:
```bash
# Add globally (recommended)
echo ".sbx/" >> ~/.config/git/ignore

# Or add to project .gitignore
echo ".sbx/" >> .gitignore

# Verify
git status  # Should not show .sbx/
```

### Issue: "Sandbox creation fails with disk space error"

**Cause**: Insufficient disk space for VM images

**Solution**:
```powershell
# Check disk space
Get-Volume
# Free up space or increase disk

# Clean up unused sandboxes
sbx ls
sbx rm <old-sandbox-names>

# Clean Docker cache
sbx reset  # Warning: removes all sandboxes
```

### Issue: "Sandbox runs very slowly"

**Cause**: Host machine resource contention or I/O latency

**Solutions**:
1. **Check host resources**:
   ```powershell
   Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 5
   ```
2. **Limit sandbox memory**:
   ```powershell
   sbx run claude --memory 4GB
   ```
3. **Close other applications** to free RAM
4. **Use SSD** instead of HDD
5. **Check network latency**:
   ```powershell
   sbx exec <name> ping -c 3 8.8.8.8
   ```

### Issue: "Commits from agent are unsigned"

**Cause**: SSH agent not forwarded to sandbox

**Status**: Known limitation - signature forwarding not yet supported

**Workaround**:
```bash
# After merging agent's commits, sign them:
git rebase --exec 'git commit --amend --no-edit -S' main

# Or manually sign specific commits:
git commit --amend -S
git rebase --continue
```

### Issue: "WinGet not found" (Windows)

**Cause**: Windows Package Manager not installed

**Solutions**:
1. **Update Windows** to latest version
2. **Or install manually** from Microsoft Store
3. **Or use MSI installer**:
   ```powershell
   # Download sbx MSI from:
   # https://github.com/docker/sbx/releases
   
   # Then run:
   msiexec.exe /i sbx-x86_64-windows.msi /quiet
   ```

### Issue: "Git not found" (macOS/Linux)

**Cause**: Git not installed

**Solution**:
```bash
# macOS
brew install git

# Linux
sudo apt-get install git  # Debian/Ubuntu
sudo yum install git      # RHEL/CentOS
```

---

## Verification Tests

### Test 1: Basic Connectivity

```powershell
# Create test sandbox
sbx create --agent shell test-basic

# Run simple command
sbx exec test-basic echo "Hello from sandbox"

# Cleanup
sbx rm test-basic

# Expected: "Hello from sandbox" printed
```

### Test 2: Docker in Sandbox

```powershell
# Create test sandbox
sbx create --agent shell test-docker

# Check Docker version
sbx exec test-docker docker version

# List Docker images (should be empty)
sbx exec test-docker docker images

# Cleanup
sbx rm test-docker

# Expected: Docker version info printed, no errors
```

### Test 3: Network Access

```powershell
# Create test sandbox
sbx create --agent shell test-network

# Test HTTP request
sbx exec test-network curl -s https://api.github.com/rate_limit

# Test DNS
sbx exec test-network nslookup docker.com

# Cleanup
sbx rm test-network

# Expected: JSON response and DNS info
```

### Test 4: File System Isolation

```powershell
# Create test sandbox in a temp directory
$tmpdir = "$env:TEMP\sbx-test"
New-Item -ItemType Directory -Path $tmpdir -Force

# Create test file
"test content" | Out-File -FilePath "$tmpdir\test.txt"

# Create sandbox with workspace
sbx create --agent shell test-filesystem --workspace $tmpdir

# Read file from sandbox
sbx exec test-filesystem cat test.txt

# Try to access host files (should fail)
sbx exec test-filesystem ls /c/Users/

# Cleanup
sbx rm test-filesystem

# Expected: Read test file, cannot access host Users directory
```

### Test 5: Memory Limits

```powershell
# Create sandbox with limited memory
sbx create --agent shell test-memory --memory 2GB

# Check available memory
sbx exec test-memory free -h

# Cleanup
sbx rm test-memory

# Expected: Shows ~2GB available memory
```

---

## Dashboard Monitoring

### Launch Interactive Dashboard

```powershell
sbx
```

This shows:
- **Sandbox status**: Running, stopped, or failed
- **Resource usage**: CPU, memory, disk
- **Network activity**: Outbound connections, policy violations
- **Real-time logs**: Agent output and errors

### Commands in Dashboard

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate sandboxes |
| `→` | View sandbox details |
| `l` | View logs |
| `s` | Stop sandbox |
| `r` | Restart sandbox |
| `d` | Delete sandbox |
| `q` | Quit dashboard |

---

## Logs & Debugging

### View sbx Daemon Logs

```bash
# Windows
$env:LOCALAPPDATA\DockerSandboxes\sandboxes\state\sandboxd\daemon.log
Get-Content $env:LOCALAPPDATA\DockerSandboxes\sandboxes\state\sandboxd\daemon.log -Tail 50

# macOS
tail -f ~/Library/Application\ Support/Docker\ Sandboxes/state/sandboxd/daemon.log
```

### View Sandbox Logs

```powershell
sbx logs <sandbox-name>

# Follow logs in real-time
sbx logs <sandbox-name> --follow

# Get logs for all sandboxes
sbx ls | ForEach-Object { sbx logs $_ }
```

### Enable Debug Logging

```bash
# Set debug environment variable
export SBX_DEBUG=1
sbx run claude

# Or in PowerShell
$env:SBX_DEBUG = "1"
& sbx run claude
```

---

## Performance Optimization

### Reduce I/O Latency

```powershell
# Use branch mode instead of direct mode
sbx run claude --branch feature

# Keeps VM-local work, reduces mounts
```

### Allocate More Resources

```powershell
# Increase memory
sbx run claude --memory 8GB

# Allocate specific CPU cores
sbx run claude --cpus 4
```

### Clear Sandbox Cache

```powershell
# Stop all sandboxes
sbx ls | ForEach-Object { sbx stop $_ }

# Remove unused sandboxes
sbx ls | ForEach-Object { sbx rm $_ }

# Reset all sandboxes (⚠️ destructive)
sbx reset
```

---

## Next Steps After Setup

1. **Start your first sandbox**:
   ```powershell
   cd C:\your\project
   sbx run claude
   ```

2. **Review agent changes**:
   ```powershell
   git diff
   git log
   ```

3. **Use branch mode for safety**:
   ```powershell
   sbx run claude --branch add-tests
   git merge .sbx/*/add-tests
   ```

4. **Monitor resources**:
   ```powershell
   sbx  # Open dashboard
   ```

5. **Customize sandbox environment**:
   - See: https://docs.docker.com/ai/sandboxes/customize/

---

## Resources

- **Official Docs**: https://docs.docker.com/ai/sandboxes/
- **Security Model**: https://docs.docker.com/ai/sandboxes/security/
- **Supported Agents**: https://docs.docker.com/ai/sandboxes/agents/
- **GitHub Issues**: https://github.com/docker/sbx/issues
- **Docker Community**: https://forums.docker.com/

---

## Support

If you encounter issues not covered here:

1. **Check logs**: `sbx logs <name>`
2. **Search GitHub**: https://github.com/docker/sbx/issues
3. **Post on Docker Forum**: https://forums.docker.com/c/docker-desktop/
4. **Check the official docs**: https://docs.docker.com/ai/sandboxes/

Happy sandboxing! 🎉
