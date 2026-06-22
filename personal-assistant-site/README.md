# Agentics Personal Assistant WebUI

This is a local-first WebUI for the Agentics Docker stack. It gives one place to see how Open WebUI, Ollama, MCP tools, n8n, WAHA, Browser Use, storage, vector memory, document parsing, and monitoring fit together as a personal assistant system.

## Run

From the stack directory:

```bash
docker compose up -d --build personal-assistant-webui
```

Then open:

```text
http://localhost:8787
```

## Optional workflow dispatch

Set `N8N_AGENT_WEBHOOK_URL` if you want the command bar to send tasks into an n8n webhook:

```env
N8N_AGENT_WEBHOOK_URL=http://n8n:5678/webhook/agentics-chat
```

Without that variable, the UI still works as a stack map and health console.

## Optional OpenAI Responses MCP panel

The Agent Orchestrator includes an OpenAI MCP Response panel that mirrors a
Responses API request with a remote MCP server. Configure these values in the
site runtime before using it:

```env
OPENAI_API_KEY=
OPENAI_RESPONSES_MODEL=gpt-5.4-mini
PIPEDREAM_MCP_SERVER_URL=https://remote.mcp.pipedream.net
PIPEDREAM_MCP_APP_SLUG=
PIPEDREAM_MCP_AUTHORIZATION=
```

Keep Pipedream authorization values in local runtime configuration only. Do not
commit them to the repository.
