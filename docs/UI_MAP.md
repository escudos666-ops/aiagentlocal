# Agentics UI Map

This is the canonical map for browser-facing surfaces in this repo. Use it before starting a stack or adding a new web UI so ports, gateway names, and source folders stay predictable.

## Canonical Local UIs

| Surface | Direct URL | Gateway host | Source of truth | Notes |
| --- | --- | --- | --- | --- |
| Personal Assistant WebUI | `http://127.0.0.1:8787` | `http://pa.localhost` | `compose.yaml`, `personal-assistant-site/` | Current control-room app. |
| Open WebUI | `http://127.0.0.1:3000` | `http://ai.localhost` | `docker-compose.agentics.unified.gpu.yml` | Compose-owned Agentics Open WebUI. |
| n8n | `http://127.0.0.1:5678` | `http://n8n.localhost` | `docker-compose.agentics.unified.gpu.yml` | Workflow UI. |
| Browser Use WebUI | `http://127.0.0.1:7788` | `http://browser.localhost` | `docker-compose.browser-use.yml`, `browser-use-web-ui/` | Gateway route follows the host port so the current running container also works. |
| Browser Use noVNC | `http://127.0.0.1:6080/vnc.html` | `http://vnc.localhost/vnc.html` | `docker-compose.browser-use.yml`, `browser-use-web-ui/` | Gateway route follows the host port so the current running container also works. |
| MinIO Console | `http://127.0.0.1:9001` | `http://files.localhost` | `docker-compose.agentics.unified.gpu.yml` | Object storage console. |
| Adminer | `http://127.0.0.1:8081` | `http://db.localhost` | `docker-compose.agentics.unified.gpu.yml` | `8088` is reserved for the gateway. |
| Grafana | `http://127.0.0.1:3002` | `http://grafana.localhost` | `docker-compose.agentics.unified.gpu.yml`, `docker-compose.monitoring.yml` | Observability UI. |
| Unified static UI | `http://127.0.0.1:3011` | `http://unified.localhost` | `docker-compose.unified-ui.yml`, `agentics-unified-ui/` | `3010` is reserved for Playwright. |

## Non-UI HTTP Surfaces

| Surface | URL | Source of truth | Notes |
| --- | --- | --- | --- |
| Gateway health/debug | `http://127.0.0.1:8088/health` | `gateway/nginx.conf` | Debug port for the local front door. |
| Agentics Tools API | `http://127.0.0.1:8765` | `agentics-tools-api/` | API, not a WebUI. |
| Agentics MCP | `http://127.0.0.1:8766/health` | `mcp/` | MCP server health. |
| PostGraphile | `http://127.0.0.1:5000/graphql` | `docker-compose.agentics.unified.gpu.yml` | GraphQL endpoint. |
| Open Terminal | `http://127.0.0.1:8000` | `compose.agentics.full.yaml` | API/service surface; root may return JSON/404. |
| Playwright server | `ws://127.0.0.1:3010` | `docker-compose.playwright.yml` | Reserved for automation, not a dashboard. |

## Deprecated Or Duplicate UI Copies

Do not use these as active source-of-truth folders:

- `wbgui/`: older nested WebGUI repo copy.
- `web-ui/`: nested upstream Browser Use WebUI copy.
- `ui_backup_*/`: timestamped static UI backups.

Use these instead:

- `personal-assistant-site/` for the current Personal Assistant WebUI.
- `browser-use-web-ui/` plus root `docker-compose.browser-use.yml` for Browser Use.
- `agentics-unified-ui/` plus `docker-compose.unified-ui.yml` for the static unified UI.

## Port Reservations

| Port | Owner |
| --- | --- |
| `80` | Gateway hostnames such as `ai.localhost`, `pa.localhost`, `n8n.localhost`. |
| `8088` | Gateway debug/health listener. |
| `8081` | Adminer direct host port. |
| `3010` | Playwright automation server. |
| `3011` | Unified static UI direct host port. |

## Canonical Launch

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml -f docker-compose.monitoring.yml -f docker-compose.browser-use.yml -f compose.yaml up -d
```

For the static unified UI:

```powershell
docker compose -f docker-compose.unified-ui.yml up -d
```
