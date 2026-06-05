#!/bin/sh
# Docker Model Runner - Setup Check

set -eu

OPENWEBUI_HOST="${OPENWEBUI_HOST:-localhost}"
OPENWEBUI_PORT="${OPENWEBUI_PORT:-3000}"

echo "=========================================="
echo "Docker Model Runner - Integration Check"
echo "=========================================="
echo

echo "Step 1: Checking Docker Model Runner..."
if ! docker model status; then
  echo "[FAIL] Docker Model Runner is not available"
  exit 1
fi

MODELS_JSON="$(docker model ls --openai)"
MODEL_COUNT="$(printf "%s" "$MODELS_JSON" | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("data", [])))')"
if [ "$MODEL_COUNT" = "0" ]; then
  echo "[FAIL] No Docker Model Runner models found"
  echo "Open Docker Desktop > Models and pull at least one model."
  exit 1
fi

echo "[OK] Found $MODEL_COUNT Docker Model Runner model(s)"
printf "%s" "$MODELS_JSON" | python3 -c 'import json,sys; [print("  - " + item.get("id", "Unknown")) for item in json.load(sys.stdin).get("data", [])]'
echo

echo "Step 2: Creating required directories..."
mkdir -p config/webui/pipelines n8n-workflows monitoring data/postgres data/redis data/loki data/grafana
echo "[OK] Directories are present"
echo

echo "Step 3: Restarting Open WebUI..."
if docker compose restart openwebui; then
  echo "[OK] Open WebUI restarted"
else
  echo "[WARN] Could not restart Open WebUI"
fi
echo

echo "Step 4: Verifying services..."
if curl -fsS "http://${OPENWEBUI_HOST}:${OPENWEBUI_PORT}/api/health" >/dev/null; then
  echo "[OK] Open WebUI"
else
  echo "[FAIL] Open WebUI"
fi

if curl -fsS "http://localhost:11434/api/tags" >/dev/null; then
  echo "[OK] Ollama"
else
  echo "[FAIL] Ollama"
fi

if curl -fsS "http://localhost:5678" >/dev/null; then
  echo "[OK] N8N"
else
  echo "[FAIL] N8N"
fi

echo
echo "Integration check complete."
echo "Open WebUI: http://localhost:3000"
echo "Container DMR endpoint: http://model-runner.docker.internal/v1"
