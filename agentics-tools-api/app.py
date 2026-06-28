from typing import Any

from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
import os
import socket
import urllib.request
import urllib.error

app = FastAPI(title="Agentics Tools API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8787",
        "http://localhost:8787",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

HTTP_TIMEOUT = float(os.getenv("AGENTICS_TOOLS_HTTP_TIMEOUT", "30"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434")).rstrip("/")
DEFAULT_AGENT_MODEL = os.getenv("AGENTICS_DEFAULT_AGENT_MODEL", "agentics-assistant:latest")

SERVICES = {
    "agentics_tools_api": {"kind": "http", "url": "http://127.0.0.1:8765", "health_url": "http://127.0.0.1:8765/health"},
    "agentics_gui": {"kind": "http", "url": "http://host.docker.internal:5173", "health_url": "http://host.docker.internal:5173"},
    "open_webui": {"kind": "http", "url": "http://open-webui:8080", "health_url": "http://open-webui:8080/health"},
    "agentics_mcp": {"kind": "http", "url": "http://agentics-mcp:8766/mcp", "health_url": "http://agentics-mcp:8766/health"},
    "ollama": {"kind": "http", "url": f"{OLLAMA_BASE_URL}/api/tags"},
    "docker_model_runner": "http://host.docker.internal:12434/engines/llama.cpp/v1/models",
    "n8n": "http://n8n:5678",
    "tika": "http://tika:9998/tika",
    "chroma": "http://chroma:8000/api/v2/heartbeat",
    "minio": "http://minio:9000/minio/health/live",
    "grafana": "http://grafana:3000/api/health",
    "prometheus": "http://prometheus:9090/-/healthy",
    "loki": "http://loki:3100/ready",
    "browser_use": "http://browser-use-web-ui-browser-use-webui-1:7788",
    "browser_use_vnc": "http://browser-use-web-ui-browser-use-webui-1:6080",
    "browser_use_chrome_cdp": {"kind": "tcp", "host": "host.docker.internal", "port": 9222, "url": "http://host.docker.internal:9222"},
    "playwright": {"kind": "tcp", "host": "host.docker.internal", "port": 3010, "url": "ws://host.docker.internal:3010/"},
    "open_terminal": {"kind": "http", "url": "http://open-terminal:8000", "health_url": "http://open-terminal:8000/docs"},
    "postgraphile": "http://postgraphile:5000/graphql",
}

POSTGRAPHILE_HEALTH_QUERY = {"query": "query HealthCheck { __typename }"}


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    model: str = DEFAULT_AGENT_MODEL
    temperature: float = 0.4
    num_ctx: int = 4096
    num_predict: int = 512


def parse_body(raw: bytes) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def request_json(url: str, method: str = "GET", payload: dict[str, Any] | None = None, timeout: float = HTTP_TIMEOUT):
    body = None
    headers = {"Accept": "application/json", "User-Agent": "agentics-tools-api/0.1"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, parse_body(response.read())

def check_url(url: str):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return {"ok": True, "status": r.status, "url": url}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "url": url, "error": str(e)}
    except Exception as e:
        return {"ok": False, "url": url, "error": f"{type(e).__name__}: {e}"}

def check_tcp(host: str, port: int, url: str | None = None):
    try:
        with socket.create_connection((host, port), timeout=5):
            return {"ok": True, "host": host, "port": port, "url": url or f"tcp://{host}:{port}"}
    except Exception as e:
        return {"ok": False, "host": host, "port": port, "url": url or f"tcp://{host}:{port}", "error": f"{type(e).__name__}: {e}"}

def check_graphql(url: str):
    request = urllib.request.Request(
        url,
        data=json.dumps(POSTGRAPHILE_HEALTH_QUERY).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as r:
            body = r.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "ok": 200 <= r.status < 300 and "data" in payload,
                "status": r.status,
                "method": "POST",
                "url": url,
            }
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "method": "POST", "url": url, "error": str(e)}
    except Exception as e:
        return {"ok": False, "method": "POST", "url": url, "error": f"{type(e).__name__}: {e}"}

def check_service(name: str):
    service = SERVICES[name]
    if isinstance(service, dict):
        if service.get("kind") == "tcp":
            return check_tcp(str(service["host"]), int(service["port"]), str(service.get("url") or ""))
        return check_url(str(service.get("health_url") or service["url"]))

    url = service
    if name == "postgraphile":
        return check_graphql(url)
    return check_url(url)

def ollama_generate(payload: dict[str, Any]):
    status, body = request_json(f"{OLLAMA_BASE_URL}/api/generate", method="POST", payload=payload, timeout=120)
    return status, body

@app.get("/")
def root():
    return {"ok": True, "service": "agentics-tools-api"}

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/services")
def services():
    results: dict[str, Any] = {}
    max_workers = min(12, len(SERVICES))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(check_service, name): name for name in SERVICES}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except Exception as e:
                results[name] = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    return {name: results[name] for name in SERVICES}

@app.get("/services/{name}")
def service(name: str):
    if name not in SERVICES:
        return {"ok": False, "error": f"Unknown service: {name}", "known": list(SERVICES)}
    return check_service(name)

@app.get("/agents")
def agents():
    try:
        _, body = request_json(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        models = body.get("models", []) if isinstance(body, dict) else []
        completion_models = []
        for model in models:
            if not isinstance(model, dict):
                continue
            capabilities = model.get("capabilities") or []
            if capabilities and "completion" not in capabilities:
                continue
            name = model.get("name") or model.get("model")
            if not name:
                continue
            completion_models.append(
                {
                    "id": name,
                    "name": name,
                    "model": name,
                    "description": f"Local Ollama agent/model: {name}",
                    "capabilities": capabilities,
                    "size": model.get("size"),
                    "modified_at": model.get("modified_at"),
                }
            )

        return {
            "ok": True,
            "source": "ollama",
            "ollama_url": OLLAMA_BASE_URL,
            "default_model": DEFAULT_AGENT_MODEL,
            "agents": completion_models,
        }
    except Exception as e:
        return {
            "ok": False,
            "source": "ollama",
            "ollama_url": OLLAMA_BASE_URL,
            "default_model": DEFAULT_AGENT_MODEL,
            "agents": [],
            "error": f"{type(e).__name__}: {e}",
        }

@app.post("/agents/chat")
def agent_chat(chat: AgentChatRequest):
    prompt = chat.message.strip()
    if not prompt:
        return {"ok": False, "error": "message is required"}

    payload = {
        "model": chat.model or DEFAULT_AGENT_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": chat.temperature,
            "num_ctx": chat.num_ctx,
            "num_predict": chat.num_predict,
        },
    }

    try:
        status, body = ollama_generate(payload)
        if not isinstance(body, dict):
            return {"ok": False, "status": status, "source": "ollama", "error": "Unexpected Ollama response", "raw": body}

        return {
            "ok": 200 <= status < 300,
            "status": status,
            "source": "ollama",
            "model": body.get("model") or payload["model"],
            "response": body.get("response", ""),
            "eval_count": body.get("eval_count"),
            "total_duration": body.get("total_duration"),
            "raw": body,
        }
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "source": "ollama", "error": str(e), "body": parse_body(e.read())}
    except Exception as e:
        return {"ok": False, "source": "ollama", "error": f"{type(e).__name__}: {e}"}
