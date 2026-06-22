# Open WebUI Agentics Workspace

This folder mirrors the Agentics tools, functions, skills, and local provider settings that are currently loaded in the running Open WebUI container.

Live source inspected:

- Container: `open-webui`
- Database: `/app/backend/data/webui.db`

Current mirrored entries:

- Tool: `agentics_stack_health` (`tools/agentics_stack_health.py`)
- Tool: `agentics_open_terminal` (`tools/agentics_open_terminal.py`)
- Function: `agentics_context_filter` (`functions/agentics_context_filter.py`)
- Skill: `agentics-stack-operator` (`skills/agentics-stack-operator.md`)
- Skill: `agentics-terminal-operator` (`skills/agentics-terminal-operator.md`)
- Skill: `agentics-vm-sandbox-orchestrator` (`skills/agentics-vm-sandbox-orchestrator.md`)
- Prompts:
  - `stack-doctor` (`prompts/stack-doctor.md`)
  - `terminal-task` (`prompts/terminal-task.md`)
  - `sandbox-agent-mission` (`prompts/sandbox-agent-mission.md`)
  - `webui-functional-smoke` (`prompts/webui-functional-smoke.md`)
  - `model-router-check` (`prompts/model-router-check.md`)
- Tool server and local model provider settings: `config/agentics-webui-config.json`

The Agentics MCP server implementation itself lives at `../mcp/agentics_mcp_server.py`.

Note: the running `open-webui` container currently has no host mount for `/app/backend/data`, so these UI-side entries are otherwise stored only inside the container filesystem.

To seed or repair the running WebUI entries:

```powershell
python .\scripts\seed-open-webui-agentics.py
```
