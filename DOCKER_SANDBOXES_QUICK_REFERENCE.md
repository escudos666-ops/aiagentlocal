# Docker Sandboxes Quick Reference

## Installation & Setup

```bash
# Windows
winget install Docker.sbx
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All

# macOS
brew install docker/tap/sbx

# First time
sbx login    # Authenticate and choose network policy
```

---

## Essential Commands

| Command | Purpose |
|---------|---------|
| `sbx run claude` | Start Claude Code in sandbox (direct mode) |
| `sbx run claude --branch my-feature` | Start Claude Code in branch mode (safer) |
| `sbx run <agent-name>` | Start any supported agent (copilot, gemini, codex, etc.) |
| `sbx` | View interactive dashboard (TUI) |
| `sbx ls` | List all sandboxes |
| `sbx stop <name>` | Stop a sandbox (keeps files) |
| `sbx rm <name>` | Delete a sandbox |
| `sbx logs <name>` | View sandbox logs |
| `sbx exec <name> bash` | Execute command in running sandbox |
| `sbx policy ls` | View current network policies |
| `sbx policy reset` | Reconfigure network policy |

---

## Modes

### Direct Mode
```bash
sbx run claude
```
- Agent edits your repo directly
- Changes committed to your branch
- ⚠️ Risk: Agent has full git access
- Use when: Working alone, frequent snapshots pushed to remote

### Branch Mode
```bash
sbx run claude --branch my-feature
```
- Agent works in `.sbx/` worktree
- Changes isolated from main branch
- Merge/cherry-pick after review
- ✓ Safer: Main repo untouched
- Use when: Important project, team collaboration

---

## Workflow: Branch Mode (Recommended)

```bash
# 1. Start agent in branch mode
cd your-project
sbx run claude --branch add-tests

# 2. Agent makes commits to `.sbx/*/add-tests`
# 3. After agent finishes, review changes
git log .sbx/claude-your-project-worktrees/add-tests/

# 4. Merge to main
git merge .sbx/claude-your-project-worktrees/add-tests/

# 5. Clean up
sbx rm claude-your-project-worktrees-add-tests
```

---

## Network Policies

| Level | Network Access | Best For |
|-------|---|---|
| **Open** | All traffic allowed | Development, testing |
| **Balanced** | Dev sites, package managers, registries only | Production-like work |
| **Locked** | Only explicitly allowed domains | High-security projects |

Balanced includes: OpenAI, Anthropic, npm, pip, GitHub, Docker Hub, AWS, Azure, GCP

---

## Git Integration

### Configure Global Ignore
```bash
echo ".sbx/" >> ~/.config/git/ignore           # macOS/Linux
# Windows: %APPDATA%\.gitignore_global
```

### Sign Commits After Sandbox Work
```bash
# Branch mode: after merging
git rebase --exec 'git commit --amend --no-edit -S' main
```

---

## Resource Control

```bash
# Limit sandbox memory
sbx run claude --memory 4GB

# Use all available RAM (50% is default)
sbx run claude --memory 100%
```

**Defaults**: 50% of host RAM, auto-scaled for machine size

---

## Supported Agents

- `claude` — Claude Code
- `copilot` — GitHub Copilot CLI
- `gemini` — Google Gemini CLI
- `codex` — Codex
- `cursor` — Cursor
- `kiro` — Kiro
- `opencode` — OpenCode
- `docker-agent` — Docker Agent
- `shell` — Manual bash/zsh shell

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| sbx not found | Open new terminal after install |
| "Not authenticated" | `sbx login` |
| Network blocked | `sbx policy reset` (choose Open for dev) |
| Sandbox won't start | Check HypervisorPlatform enabled; `sbx logs <name>` |
| Performance slow | Reduce host process load; consider cloud VM |
| Commits unsigned | Use `git rebase --exec 'git commit --amend -S'` |
| .sbx folder in git | Add to global `.gitignore` |

---

## Key Concepts

**Isolation**: Agent runs in a microVM with:
- Own kernel
- Own Docker daemon (no host Docker access)
- Network proxy enforcing policies
- Only workspace directory shared

**Worst case**: Agent deletes workspace → restore from git remote

**Bypass Permissions**: Agents run with no prompts (unlike Claude Code on host)

**Sandbox lifecycle**: Create → run agent → review → merge/discard → delete

---

## Documentation

Full docs: https://docs.docker.com/ai/sandboxes/

- [Get Started](https://docs.docker.com/ai/sandboxes/get-started/)
- [Security Model](https://docs.docker.com/ai/sandboxes/security/)
- [Customize](https://docs.docker.com/ai/sandboxes/customize/)
- [Agents](https://docs.docker.com/ai/sandboxes/agents/)
- [Governance](https://docs.docker.com/ai/sandboxes/governance/org/)
