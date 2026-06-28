# Open WebUI MCP Integration

This stack includes a local **Agentics MCP** server and wires it into Open WebUI through Open WebUI's native `TOOL_SERVER_CONNECTIONS` setting.

## Services

- `agentics-mcp` exposes MCP over streamable HTTP at `http://agentics-mcp:8766/mcp` inside Docker.
- The same service exposes a local health endpoint at `http://127.0.0.1:8766/health`.
- `open-webui` is configured with an MCP tool server named `Agentics MCP`.

## Start or update the stack

```powershell
docker compose -f docker-compose.yml up -d agentics-mcp open-webui
```

For the GPU/unified stack:

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml up -d agentics-mcp open-webui
```

## Register MCP in an existing Open WebUI database

If Open WebUI already has persisted tool-server settings, environment defaults may not overwrite them. Run:

```powershell
.\register-openwebui-mcp.ps1
```

The script preserves existing tool servers and upserts `Agentics MCP`.

## Available MCP tools

- `list_agentics_services`
- `check_agentics_service`
- `check_all_agentics_services`
- `list_agentics_connections`
- `check_agentics_connection`
- `check_all_agentics_connections`
- `call_agentics_connection`
- `browser_use_webui_status`
- `playwright_open_page`
- `playwright_extract_links`
- `ask_agentics_router`
- `send_whatsapp_message`

## Connected browser tools

- Browser Use WebUI is exposed through the MCP hub as `browser_use_webui` with the default URL `http://host.docker.internal:7788` from inside Docker.
- Browser Use noVNC is exposed as `browser_use_vnc` with the default URL `http://host.docker.internal:6080`.
- Browser Use Chrome CDP is tracked as `browser_use_chrome_cdp` by TCP health on `host.docker.internal:9222`; the HTTP version endpoint may only respond after Chromium is actively running.
- Playwright is exposed through the MCP hub as `playwright` with the default websocket `ws://host.docker.internal:3010/`.

The standalone Playwright server is pinned to Playwright `1.58.0` to match the Playwright Python client included in the Open WebUI image used by `agentics-mcp`.

In Open WebUI, open **Admin Settings → Tools** and verify `Agentics MCP` appears as an MCP tool server.