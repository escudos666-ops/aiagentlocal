# Agentics Known-Good Launchpad

This file is the baseline map for the current workspace. Use it to avoid guessing which files are active source, which compose command is canonical, and which folders are local runtime state.

## Current Baseline

- Main repo: `C:\DeerpShit\Agentics`
- Current branch state when this was written: `main`, ahead of `origin/codex/agentics-save`, with existing local modifications and untracked files.
- Docker Compose is installed: `Docker Compose version v5.1.4`.
- Docker daemon was not running during the live check, so compose syntax was validated but containers were not started or health-checked.

## Canonical Compose Path

Validate the full launch shape:

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml -f docker-compose.monitoring.yml -f docker-compose.browser-use.yml -f compose.yaml config --quiet
```

Start the full stack:

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml -f docker-compose.monitoring.yml -f docker-compose.browser-use.yml -f compose.yaml up -d
```

Core stack plus assistant control room only:

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml -f compose.yaml up -d
```

Optional GPU smoke test:

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml --profile gpu-test run --rm gpu-check
```

## Open WebUI Ownership Guard

Agentics Open WebUI is expected to be the compose-managed container named `open-webui` with:

```text
compose project: agentics
compose service: open-webui
data volume:     agentics_open-webui_data -> /app/backend/data
network:         agentics_agentnet
tool server:     http://agentics-mcp:8766/mcp
model backend:   http://ollama:11434
```

Check the guard:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ensure-agentics-openwebui.ps1
```

Repair a displaced or extension-created `open-webui` container:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ensure-agentics-openwebui.ps1 -Repair
```

Known trap: the Docker Desktop extension `rw4lll/openwebui-docker-extension` can create a fresh `open-webui` container on the plain Docker `bridge` network with the unrelated `openwebui` volume. That looks like Open WebUI but does not contain the Agentics tools, functions, skills, prompts, MCP connection, or compose wiring. Remove that extension when using this stack:

```powershell
docker extension rm rw4lll/openwebui-docker-extension
```

Known trap: `docker-compose.yml + docker-compose.monitoring.yml + compose.yaml` is not a valid launch combo because the monitoring overlay configures `grafana` but that base combo does not define a `grafana` service. Treat `docker-compose.yml` as an older/minimal stack unless intentionally working on that path.

`compose.agentics.full.yaml` also validates as a standalone full-stack compose file, but the practical active path is the unified GPU base plus overlays above.

## Services In The Full Launch

For the canonical browser-facing URL table, see `docs/UI_MAP.md`.

The validated full launch shape contains:

```text
agentics-mcp
agentics-tools-api
adminer
browser-use-webui
cadvisor
chroma
gateway
grafana
langchain
loki
minio
n8n
n8n-imports
node-exporter
node18
node24
ollama
open-terminal
open-webui
personal-assistant-webui
postgraphile
postgres
prometheus
promtail
python
redis
tika
waha
```

Common local URLs:

```text
Open WebUI              http://127.0.0.1:3000
n8n                     http://127.0.0.1:5678
Personal Assistant UI   http://127.0.0.1:8787
Agentics MCP health     http://127.0.0.1:8766/health
Agentics Tools API      http://127.0.0.1:8765
Browser Use WebUI       http://127.0.0.1:7788
Browser Use VNC         http://127.0.0.1:6080/vnc.html
Grafana                 http://127.0.0.1:3002
Prometheus              http://127.0.0.1:9090
Loki                    http://127.0.0.1:3100
MinIO API               http://127.0.0.1:9000
MinIO Console           http://127.0.0.1:9001
Adminer                 http://127.0.0.1:8081
PostGraphile            http://127.0.0.1:5000
Ollama                  http://127.0.0.1:11434
Chroma                  http://127.0.0.1:8001
Tika                    http://127.0.0.1:9998
WAHA                    http://127.0.0.1:3001
Gateway                 http://127.0.0.1
Gateway health/debug    http://127.0.0.1:8088/health
Unified static UI       http://127.0.0.1:3011
```

## Source Map

Active source and config:

```text
agentics-gui/              React + Vite operational dashboard.
agentics-tools-api/        FastAPI service for stack health checks and local agent chat. Exposed at `127.0.0.1:8765`.
agentics-unified-ui/       Static Nginx-hosted unified landing/control UI. Direct host port is `3011`.
config/webui/pipelines/    Open WebUI pipeline code, including smart model routing.
gateway/                   Nginx gateway config.
mcp/                       Agentics MCP server mounted into Open WebUI.
monitoring/                Prometheus, Loki, Promtail, Grafana datasource/dashboard config.
n8n-imports/               Workflows served for import.
n8n-workflows/             Source workflow JSON.
openwebui-tools/           Open WebUI tool scripts.
personal-assistant-site/   Current Node control-room app. `npm start` runs `index.js`.
scripts/                   Setup, repair, and verification helpers.
ui/                        Simple static UI.
vault/                     Vault config.
```

Auxiliary or experimental source:

```text
browser-use-web-ui/        Browser-use Gradio WebUI with Docker support.
dashboard/                 Older FastAPI-backed personal assistant dashboard.
huggingface-api/           FastAPI + Transformers service.
pa-service/                Personal-agent orchestrator service.
pytorch-service/           FastAPI + PyTorch service.
workflow-import/           Workflow JSON copies.
```

Deprecated nested UI repo copies:

```text
wbgui/                     Separate/parallel WebGUI worktree-style copy. Do not use as active root source.
web-ui/                    Browser-use WebUI copy. Use browser-use-web-ui/ instead.
```

Runtime, generated, dependency, or backup folders:

```text
.git/
backups/
data/
DockerDesktopWSL/
env-backups/
huggingface-cache/
ollama/
postgres-data/
test-reports/
ui_backup_*/
**/.venv/
**/dist/
**/node_modules/
**/playwright-report/
**/test-results/
config/webui/cache/
config/webui/uploads/
config/webui/vector_db/
```

These folders should generally not be committed or used as the source of truth.

## Working Rules For Future Changes

1. Add core stack services to `docker-compose.agentics.unified.gpu.yml`.
2. Add optional observability changes to `docker-compose.monitoring.yml` and `monitoring/`.
3. Add browser automation changes to `docker-compose.browser-use.yml` or `browser-use-web-ui/`.
4. Add assistant control-room changes to `compose.yaml` or `personal-assistant-site/`.
5. Keep secrets in `.env` or `.env.*`; keep only examples such as `.env.example` in source.
6. Before a change, run the compose validation command above. After a change, run it again.
7. Once Docker Desktop is running, use `docker compose ... ps` and the URLs above for health checks.

## First Health Check After Starting Docker

```powershell
docker compose -f docker-compose.agentics.unified.gpu.yml -f docker-compose.monitoring.yml -f docker-compose.browser-use.yml -f compose.yaml ps

Invoke-RestMethod http://127.0.0.1:8766/health
Invoke-RestMethod http://127.0.0.1:8765/health
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:5678/healthz
Invoke-RestMethod http://127.0.0.1:8787/api/services
```
