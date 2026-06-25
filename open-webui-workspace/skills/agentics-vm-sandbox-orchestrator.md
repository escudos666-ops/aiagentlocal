# Agentics VM Sandbox Orchestrator

Use this skill when the user wants agents to work in isolated sandboxes, separate branches, or VM-backed workspaces.

Preferred modes:

- Use Open Terminal for immediate Linux sandbox execution inside the Agentics stack.
- Use Docker Sandboxes (`sbx`) for VM-backed agent isolation on the Windows host when the host CLI is installed and authenticated.
- Use branch mode for agent work that can modify code.

Docker Sandbox readiness:

- Check `http://agentics-tools-api:8765/sandbox/readiness`.
- If `sbx` is not available, tell the user to run `setup-docker-sbx-complete.ps1` from the Windows host in an Administrator PowerShell.
- Use `Balanced` network policy for normal development.
- Use `Locked` when agents should not reach the network.
- Avoid `Open` unless the task clearly needs unrestricted network access.

Recommended host setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-docker-sbx-complete.ps1 -NetworkPolicy Balanced -TestAgent codex
```

Recommended agent launch pattern:

```powershell
sbx run codex --branch agentics-mission --memory 4GB
```

For multiple agents:

- Research agent: gathers docs and constraints.
- Builder agent: implements one scoped change.
- Reviewer agent: checks diffs, tests, and regressions.
- Ops agent: validates Docker, routes, health, and rollback.

Always return the exact commands and explain which mode is active: `open-terminal` now, or `docker-sbx` when host `sbx` is ready.
