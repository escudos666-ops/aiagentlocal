# Docker Sandboxes: Fully Automated Setup & Complete Verification

**Everything automated. Everything verified. Everything wired and connected.**

This package contains complete automation and verification scripts to set up Docker Sandboxes on your machine—with comprehensive end-to-end testing to ensure everything is working properly.

---

## 📋 What's Included

### Setup Scripts (Fully Automated)
- **`setup-docker-sbx-complete.ps1`** — Windows PowerShell (run as Administrator)
- **`setup-docker-sbx-complete.sh`** — macOS Bash (chmod +x and run)

### Validation Scripts (Quick Verification)
- **`validate-setup.ps1`** — Windows PowerShell validation
- **`validate-setup.sh`** — macOS Bash validation

### Documentation
- **`DOCKER_SANDBOXES_GUIDE.md`** — Full reference guide
- **`DOCKER_SANDBOXES_QUICK_REFERENCE.md`** — Command cheat sheet
- **`TROUBLESHOOTING_AND_VERIFICATION.md`** — In-depth troubleshooting

### Setup Helpers
- **`setup-docker-sbx.ps1`** — Simpler Windows setup
- **`setup-docker-sbx.sh`** — Simpler macOS setup

---

## 🚀 Quick Start

### Windows (PowerShell)

```powershell
# 1. Open PowerShell as Administrator
# 2. Run the setup script
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\setup-docker-sbx-complete.ps1

# 3. Validate the installation
.\validate-setup.ps1

# 4. Start using sandboxes
cd C:\your\project
sbx run claude
```

### macOS (Bash)

```bash
# 1. Make scripts executable
chmod +x setup-docker-sbx-complete.sh validate-setup.sh

# 2. Run the setup script
./setup-docker-sbx-complete.sh

# 3. Validate the installation
./validate-setup.sh

# 4. Start using sandboxes
cd /path/to/your/project
sbx run claude
```

---

## ✅ What Gets Automated

### Phase 1: Prerequisites
- ✓ Admin privileges check
- ✓ Windows version validation (Windows 11+)
- ✓ macOS version check (12+)
- ✓ Internet connectivity verification
- ✓ Architecture check (arm64 for macOS)

### Phase 2: HypervisorPlatform (Windows Only)
- ✓ Check if enabled
- ✓ Enable if needed
- ✓ Automatic system restart if required
- ✓ Verification after restart

### Phase 3: sbx CLI Installation
- ✓ Check if already installed
- ✓ Install via WinGet (Windows) or Homebrew (macOS)
- ✓ MSI fallback installation (Windows)
- ✓ Verify installation and PATH
- ✓ Retrieve version info

### Phase 4: Docker Authentication
- ✓ Check authentication status
- ✓ Initiate login if needed
- ✓ Verify authentication success
- ✓ Handle authentication errors

### Phase 5: Network Policy Configuration
- ✓ Check current policy
- ✓ Configure network policy (Open/Balanced/Locked)
- ✓ Allow user selection if needed
- ✓ Verify policy application

### Phase 6: Git Configuration
- ✓ Check Git installation
- ✓ Create global gitignore if needed
- ✓ Add `.sbx/` exclusion
- ✓ Verify configuration

### Phase 7-8: Full Testing
- ✓ Create test sandboxes
- ✓ Test network connectivity
- ✓ Verify Docker engine in sandbox
- ✓ Test file system isolation
- ✓ Verify command execution
- ✓ Clean up test resources

---

## 📊 What Gets Verified

### Validation Checks (Quick)

Run `validate-setup.ps1` or `validate-setup.sh` at any time:

```powershell
# Windows
.\validate-setup.ps1          # Quick check
.\validate-setup.ps1 -Detailed  # Detailed output
```

```bash
# macOS
./validate-setup.sh           # Quick check
./validate-setup.sh --detailed  # Detailed output
```

Checks include:
- ✓ HypervisorPlatform enabled (Windows)
- ✓ sbx CLI installed and in PATH
- ✓ sbx version available
- ✓ Docker authentication status
- ✓ Sandbox daemon running
- ✓ Network policy configured
- ✓ Git global ignore configured

---

## 🧪 Testing Included

### Automatic Tests (Part of Setup)

```powershell
# Skip network test (if offline)
.\setup-docker-sbx-complete.ps1 -SkipNetworkTest

# Skip sandbox functionality test
.\setup-docker-sbx-complete.ps1 -SkipSandboxTest

# Custom network policy
.\setup-docker-sbx-complete.ps1 -NetworkPolicy "Balanced"
```

### Tests Run

1. **Network Connectivity**: Tests outbound connections from sandbox
2. **Docker in Sandbox**: Verifies Docker daemon runs inside sandbox
3. **Command Execution**: Tests shell command execution
4. **Basic Functionality**: Creates and destroys test sandboxes

---

## 📋 Troubleshooting

### Issue: "sbx: command not found"

**Windows Solution**:
```powershell
# Open a NEW PowerShell window (PATH only updates in new shells)

# Or refresh PATH manually:
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
sbx version
```

**macOS Solution**:
```bash
# Refresh shell environment
eval "$(brew shellenv)"
sbx version
```

### Issue: "HypervisorPlatform is not enabled" (Windows)

```powershell
# Enable manually (run as Administrator)
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All

# Restart system
Restart-Computer

# Re-run setup
.\setup-docker-sbx-complete.ps1
```

### Issue: "sbx not authenticated"

```powershell
sbx login
# Follow the browser-based authentication flow
```

### Issue: Network blocked in sandbox

```powershell
# Check current policy
sbx policy ls

# Reconfigure policy (switch to Open for development)
sbx policy reset
```

### More Help

See `TROUBLESHOOTING_AND_VERIFICATION.md` for comprehensive troubleshooting.

---

## 🎯 After Setup: Quick Commands

```powershell
# Start Claude Code in a sandbox (direct mode)
sbx run claude

# Start Claude Code in branch mode (safer)
sbx run claude --branch my-feature

# List all sandboxes
sbx ls

# View interactive dashboard
sbx

# View sandbox logs
sbx logs <sandbox-name>

# Stop a sandbox
sbx stop <sandbox-name>

# Delete a sandbox
sbx rm <sandbox-name>

# View network policies
sbx policy ls

# Reconfigure network policy
sbx policy reset
```

---

## 🏗️ Architecture

### What Gets Set Up

```
Your Machine
├── HypervisorPlatform (Windows)        [Enabled]
├── sbx CLI                             [Installed & in PATH]
├── Docker Authentication              [Configured]
├── Network Policies                   [Open/Balanced/Locked]
└── Git Configuration                  [.sbx/ in gitignore]

When you run: sbx run claude

└── Sandbox (microVM)
    ├── Linux kernel                    [Isolated]
    ├── Docker daemon                   [Internal]
    ├── Your workspace                  [Mounted]
    └── Claude Code agent               [Running]
```

### Isolation Boundaries

- **Kernel**: Separate kernel per sandbox (not shared)
- **Docker**: Sandbox has own Docker daemon (not host's)
- **Network**: Proxy-enforced policies (blocks host localhost)
- **Filesystem**: Only workspace accessible (host hidden)
- **User**: Agent runs as non-root

**Result**: Agents can run freely without breaking your system.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `DOCKER_SANDBOXES_GUIDE.md` | Complete reference (installation, workflows, security) |
| `DOCKER_SANDBOXES_QUICK_REFERENCE.md` | Command cheat sheet and quick lookup |
| `TROUBLESHOOTING_AND_VERIFICATION.md` | In-depth troubleshooting and verification tests |
| `README.md` (this file) | Overview and quick start |

---

## 🔧 Script Options

### setup-docker-sbx-complete.ps1 (Windows)

```powershell
# Custom network policy
.\setup-docker-sbx-complete.ps1 -NetworkPolicy "Balanced"

# Choose test agent
.\setup-docker-sbx-complete.ps1 -TestAgent "gemini"

# Skip network test (if offline)
.\setup-docker-sbx-complete.ps1 -SkipNetworkTest

# Skip sandbox test
.\setup-docker-sbx-complete.ps1 -SkipSandboxTest

# Combined
.\setup-docker-sbx-complete.ps1 -NetworkPolicy "Open" -SkipNetworkTest -SkipSandboxTest
```

### setup-docker-sbx-complete.sh (macOS)

```bash
# Custom network policy
./setup-docker-sbx-complete.sh "Balanced"

# Custom test agent
./setup-docker-sbx-complete.sh "Open" "gemini"

# Skip network test
SKIP_NETWORK_TEST=true ./setup-docker-sbx-complete.sh

# Skip sandbox test
SKIP_SANDBOX_TEST=true ./setup-docker-sbx-complete.sh
```

---

## 🎓 Workflow Examples

### Example 1: Review & Merge Agent Work

```powershell
# 1. Start agent in branch mode
cd C:\my\project
sbx run claude --branch add-tests

# 2. Agent makes commits to .sbx/*/add-tests

# 3. Review changes
git log .sbx/claude-my-project-worktrees/add-tests/ --oneline

# 4. Merge to main
git merge .sbx/claude-my-project-worktrees/add-tests/

# 5. Clean up
sbx rm claude-my-project-worktrees-add-tests
```

### Example 2: Monitor Agent Progress

```powershell
# 1. Start agent
sbx run claude

# 2. In another terminal, watch resources
sbx   # Opens interactive dashboard

# 3. View logs
sbx logs <sandbox-name>

# 4. Check network activity
sbx policy ls
```

### Example 3: Custom Sandbox with Tools

See `TROUBLESHOOTING_AND_VERIFICATION.md` → "Customize Sandbox Environment"

---

## ✨ Features

✓ **Fully Automated** — One command to set everything up  
✓ **Comprehensive Verification** — 7-9 checks on each run  
✓ **End-to-End Testing** — Network, Docker, filesystem tests  
✓ **Error Recovery** — Handles common issues automatically  
✓ **Detailed Logging** — See what's happening at each step  
✓ **Interactive Dashboard** — Monitor sandbox resources  
✓ **Git Integration** — Branch mode for safe experiments  
✓ **Multiple Agents** — Claude, Copilot, Gemini, Cursor, etc.  
✓ **Network Policies** — Open, Balanced, or Locked down  
✓ **Cross-Platform** — Windows (x86_64) and macOS (arm64)

---

## 🐛 Known Limitations

- **Commit Signing**: SSH agents (1Password, etc.) not forwarded to sandbox
  - *Workaround*: Rebase with `-S` flag after merging
  
- **Performance**: Some file I/O latency in branch mode
  - *Workaround*: Use direct mode for fast iteration, branch mode for final work

- **Network Policy**: May be too restrictive for some use cases
  - *Workaround*: Switch to "Open" mode for development

---

## 📞 Support

- **Official Docs**: https://docs.docker.com/ai/sandboxes/
- **GitHub Issues**: https://github.com/docker/sbx/issues
- **Docker Forum**: https://forums.docker.com/c/docker-desktop/
- **Security Model**: https://docs.docker.com/ai/sandboxes/security/

---

## 🚦 Next Steps

1. **Run Setup**:
   ```powershell
   # Windows
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .\setup-docker-sbx-complete.ps1
   
   # macOS
   chmod +x setup-docker-sbx-complete.sh
   ./setup-docker-sbx-complete.sh
   ```

2. **Validate**:
   ```powershell
   # Windows
   .\validate-setup.ps1 -Detailed
   
   # macOS
   ./validate-setup.sh --detailed
   ```

3. **Start Using**:
   ```powershell
   cd C:\your\project
   sbx run claude
   ```

---

## 📄 License

These scripts are provided as-is for setting up Docker Sandboxes. Docker is licensed under the Docker Community Edition License.

---

**Ready to run powerful agents safely and get back to coding? Let's go!** 🎉
