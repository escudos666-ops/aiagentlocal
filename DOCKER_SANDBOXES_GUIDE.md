# Docker Sandboxes: Functional AI Agent Setup

## Overview

Docker Sandboxes let you run AI coding agents (Claude Code, Copilot, Gemini, etc.) in isolated microVMs. Agents run in bypass-permissions mode—no "do you want to run this?" prompts—but can't touch your host system.

---

## Installation

### Windows (x86_64, Windows 11+)

1. **Enable HypervisorPlatform** (required for microVMs):
   ```powershell
   # Run as Administrator
   Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
   ```
   Or use the setup script:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .\setup-docker-sbx.ps1
   ```

2. **Install sbx CLI**:
   ```powershell
   winget install Docker.sbx
   ```
   Then open a new PowerShell window.

3. **Authenticate**:
   ```powershell
   sbx login
   ```
   Choose a network policy (Open, Balanced, or Locked).

### macOS (arm64 only)

1. **Install sbx via Homebrew**:
   ```bash
   brew install docker/tap/sbx
   ```

2. **Authenticate**:
   ```bash
   sbx login
   ```
   Choose a network policy.

Or use the setup script:
```bash
chmod +x setup-docker-sbx.sh
./setup-docker-sbx.sh
```

---

## Quick Start

### 1. Run an Agent in a Sandbox

**Direct mode** (agent modifies your repo directly):
```bash
cd your-project
sbx run claude
```

**Branch mode** (agent works in `.sbx/` worktree, safer):
```bash
cd your-project
sbx run claude --branch my-feature
```

Supported agents:
- `claude` — Claude Code
- `copilot` — GitHub Copilot CLI
- `gemini` — Google Gemini
- `codex` — Codex
- `cursor` — Cursor
- `kiro` — Kiro
- `opencode` — OpenCode
- `docker-agent` — Docker Agent
- `shell` — Manual sandbox access

### 2. Monitor Sandboxes

View all running sandboxes, resource usage, and network activity:
```bash
sbx
```

This opens an interactive TUI dashboard showing:
- Sandbox status and memory/CPU usage
- Network requests and policy violations
- Agent logs in real-time

### 3. Manage Sandboxes

```bash
sbx ls                           # List all sandboxes
sbx stop <sandbox-name>          # Stop a sandbox (keeps files)
sbx rm <sandbox-name>            # Delete a sandbox
sbx exec <sandbox-name> bash     # Execute command in sandbox
sbx policy ls                    # View network policies
```

---

## Network Policies

Choose at authentication or change with `sbx policy reset`:

| Policy | Description | Use Case |
|--------|-------------|----------|
| **Open** | All network traffic allowed | Development (no restrictions) |
| **Balanced** | Dev sites allowed; others blocked | Good balance of safety + usability |
| **Locked** | All blocked unless explicitly allowed | Maximum security (most restrictive) |

**Balanced policy includes:**
- AI services (OpenAI, Anthropic, Google, Perplexity)
- Package managers (npm, pip, cargo, maven, etc.)
- Code repositories (GitHub, GitLab, Docker Hub)
- Cloud infra (AWS, Azure, GCP)
- OS packages (apt, apk, yum)

---

## Git Workflows

### Direct Mode (Simpler)

Agent edits your repo directly and commits:
```bash
sbx run claude
```

⚠️ **Risk**: Agent has full access to git history; could theoretically corrupt your repo.  
**Safety**: Push to remote first as a backup.

### Branch Mode (Safer)

Agent works in an isolated `.sbx/` worktree:
```bash
sbx run claude --branch my-feature
```

File structure:
```
your-project/
├── .sbx/
│   └── claude-your-project-worktrees/
│       └── my-feature/          # Agent works here
│           ├── src/
│           ├── tests/
│           └── ...
├── src/                         # Host repo untouched
├── tests/
└── ...
```

**Steps:**
1. Agent commits changes to `.sbx/*/my-feature` worktree
2. Review changes with `git show` or GUI
3. Merge to your main branch:
   ```bash
   git merge my-feature
   # or cherry-pick specific commits
   git cherry-pick <commit-hash>
   ```

**Important**: Add `.sbx/` to your global gitignore (done by setup scripts):
```bash
# Get or create global ignore file
git config --global core.excludesFile
echo ".sbx/" >> ~/.config/git/ignore  # macOS/Linux
# Windows: %APPDATA%\.gitignore_global
```

### Commit Signing

**Known limitation**: Sandboxes don't forward SSH agents (e.g., 1Password) for commit signing.

**Workaround:**
1. Let sandbox create unsigned commits
2. After review, on your host machine:
   ```bash
   git rebase --exec 'git commit --amend --no-edit -S' main
   ```
   This re-signs all commits with your key.

---

## Workspace Isolation

Only your project's workspace is shared with the sandbox. The sandbox cannot:
- Access your host filesystem (except workspace)
- Access host Docker daemon or images
- Access host localhost services
- Execute commands on your machine
- Access credentials or SSH keys on your host

The sandbox VM runs:
- Its own Linux kernel
- Its own Docker Engine (for `docker build`, `docker compose`, etc.)
- All agent tools and processes
- Networking through a proxy that enforces policies

---

## Performance & Resources

**Default**: Sandbox uses 50% of host RAM. Customize:
```bash
sbx run claude --memory 4GB    # Limit to 4GB
sbx run claude --memory 100%   # Use all available RAM
```

**Known issues:**
- First sandbox startup: ~10-30 seconds (downloads image, spins up VM)
- Large projects: Noticeable performance hit vs. host machine
- File I/O: Slower than native due to VM + workspace mount

**Optimization tips:**
- Run on a machine with sufficient RAM (16GB+ recommended)
- Use branch mode to keep active work in separate worktrees
- Close unused sandboxes to free resources

---

## Common Tasks

### Run a Custom Agent with Pre-installed Tools

Customize the sandbox environment (e.g., install Node.js, Go, etc.):

1. Create a Dockerfile:
   ```dockerfile
   FROM docker/sandbox-templates:claude-code-base
   RUN apt-get update && apt-get install -y golang-go nodejs
   ```

2. Build and save as template:
   ```bash
   docker build -t my-claude-template .
   sbx create --image my-claude-template --agent claude my-custom-sandbox
   sbx run my-custom-sandbox
   ```

See: [https://docs.docker.com/ai/sandboxes/customize/](https://docs.docker.com/ai/sandboxes/customize/)

### Share Sandboxes with Team (Enterprise)

Admins can centrally manage sandbox policies via Docker Admin Console:
```bash
sbx org policy set --network-policy locked
```

This applies uniform sandbox rules across the organization.

### View Sandbox Logs

```bash
sbx logs <sandbox-name>
```

### Export a Sandbox as a Template

Save a configured sandbox for reuse:
```bash
sbx save my-sandbox my-template
sbx create --template my-template new-sandbox
```

---

## Troubleshooting

### sbx command not found
- Ensure you installed with `winget install Docker.sbx` (Windows) or `brew install docker/tap/sbx` (macOS)
- Open a **new terminal window** after installation

### "Not authenticated" error
```bash
sbx login
```

### Sandbox fails to start
```bash
sbx logs <sandbox-name>
# Check HypervisorPlatform is enabled (Windows):
Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform
```

### Git commits not visible after agent finishes
- In branch mode, commits are in `.sbx/*/my-feature` worktree, not your main branch
- Merge or cherry-pick the commits to your main branch manually

### Network policy too restrictive
```bash
sbx policy reset    # Reconfigure
# Or switch to Open mode for development
```

### Agent runs slowly
- Reduce memory usage competing processes on host
- Check `sbx` dashboard for memory pressure
- Consider running on a beefier machine or cloud VM

---

## Security Model

**Isolation layers:**

1. **Hypervisor boundary**: Sandbox runs as separate microVM with its own kernel
2. **Docker Engine isolation**: Sandbox has its own Docker daemon; can't access host Docker
3. **Network proxy**: Intercepts all outbound traffic; blocks access to host localhost; enforces policies
4. **Filesystem isolation**: Only workspace is accessible; host files/processes are hidden
5. **User isolation**: Agent runs as non-root user inside sandbox

**Worst-case scenarios:**
- Agent deletes your workspace directory → restore from git
- Agent creates infinite containers → sandbox disk fills; restart or `sbx rm`
- Agent accesses external sites → network proxy blocks (unless policy allows)

**Not possible:**
- Agent breaks out of VM
- Agent accesses host system or other sandboxes
- Agent steals host credentials
- Agent modifies host Docker or system files

---

## References

- [Docker Sandboxes Documentation](https://docs.docker.com/ai/sandboxes/)
- [Sandbox Security Model](https://docs.docker.com/ai/sandboxes/security/)
- [Supported Agents](https://docs.docker.com/ai/sandboxes/agents/)
- [Customize Sandboxes](https://docs.docker.com/ai/sandboxes/customize/)
- [Organization Governance](https://docs.docker.com/ai/sandboxes/governance/org/)
