from typing import Any

import json
import os
import shutil
import socket
import urllib.error
import urllib.parse
import urllib.request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Agentics Tools API")

DEFAULT_CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "https://mjhee-personal-assistant.admetec-nl-8738.chatgpt-team.site",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "AGENTICS_TOOLS_CORS_ORIGINS",
        ",".join(DEFAULT_CORS_ORIGINS),
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_private_network=True,
)


@app.middleware("http")
async def add_private_network_cors_header(request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin in CORS_ORIGINS:
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


HTTP_TIMEOUT = float(os.getenv("AGENTICS_TOOLS_HTTP_TIMEOUT", "30"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434")).rstrip("/")
DEFAULT_AGENT_MODEL = os.getenv("AGENTICS_DEFAULT_AGENT_MODEL", "agentics-assistant:latest")
OPEN_WEBUI_INTERNAL_URL = os.getenv("OPEN_WEBUI_INTERNAL_URL", "http://open-webui:8080").rstrip("/")
OPEN_TERMINAL_URL = os.getenv("OPEN_TERMINAL_URL", "http://open-terminal:8000").rstrip("/")
OPEN_TERMINAL_API_KEY = os.getenv("OPEN_TERMINAL_API_KEY", "")
OPEN_TERMINAL_WORKSPACE = os.getenv("OPEN_TERMINAL_WORKSPACE", "/home/user/workspace")
BROWSER_USE_INTERNAL_URL = os.getenv(
    "BROWSER_USE_INTERNAL_URL",
    "http://browser-use-web-ui-browser-use-webui-1:7788",
).rstrip("/")
BROWSER_USE_VNC_INTERNAL_URL = os.getenv(
    "BROWSER_USE_VNC_INTERNAL_URL",
    "http://browser-use-web-ui-browser-use-webui-1:6080",
).rstrip("/")

SERVICES = {
    "agentics_tools_api": {
        "kind": "http",
        "url": os.getenv("AGENTICS_TOOLS_SELF_URL", "http://127.0.0.1:8765"),
        "health_url": os.getenv("AGENTICS_TOOLS_SELF_HEALTH_URL", "http://127.0.0.1:8765/health"),
    },
    "agentics_gui": {
        "kind": "http",
        "url": os.getenv("AGENTICS_GUI_URL", "http://host.docker.internal:5173"),
        "health_url": os.getenv("AGENTICS_GUI_HEALTH_URL", "http://host.docker.internal:5173"),
    },
    "open_webui": {
        "kind": "http",
        "url": OPEN_WEBUI_INTERNAL_URL,
        "health_url": os.getenv("OPEN_WEBUI_HEALTH_URL", f"{OPEN_WEBUI_INTERNAL_URL}/health"),
    },
    "agentics_mcp": {
        "kind": "http",
        "url": os.getenv("AGENTICS_MCP_URL", "http://agentics-mcp:8766/mcp"),
        "health_url": os.getenv("AGENTICS_MCP_HEALTH_URL", "http://agentics-mcp:8766/health"),
    },
    "ollama": {"kind": "http", "url": f"{OLLAMA_BASE_URL}/api/tags"},
    "docker_model_runner": os.getenv(
        "DOCKER_MODEL_RUNNER_URL",
        "http://host.docker.internal:12434/engines/llama.cpp/v1/models",
    ),
    "postgres": {
        "kind": "tcp",
        "host": os.getenv("POSTGRES_HOST", "postgres"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "url": os.getenv("ADMINER_PUBLIC_URL", "http://localhost:8088"),
    },
    "redis": {
        "kind": "tcp",
        "host": os.getenv("REDIS_HOST", "redis"),
        "port": int(os.getenv("REDIS_PORT", "6379")),
    },
    "n8n": os.getenv("N8N_INTERNAL_URL", "http://n8n:5678"),
    "waha": os.getenv("WAHA_HEALTH_URL", "http://waha:3000/api/sessions"),
    "tika": os.getenv("TIKA_INTERNAL_URL", "http://tika:9998/tika"),
    "chroma": os.getenv("CHROMA_HEALTH_URL", "http://chroma:8000/api/v2/heartbeat"),
    "minio": os.getenv("MINIO_HEALTH_URL", "http://minio:9000/minio/health/live"),
    "adminer": os.getenv("ADMINER_INTERNAL_URL", "http://adminer:8080"),
    "grafana": os.getenv("GRAFANA_HEALTH_URL", "http://grafana:3000/api/health"),
    "prometheus": os.getenv("PROMETHEUS_HEALTH_URL", "http://prometheus:9090/-/healthy"),
    "loki": os.getenv("LOKI_HEALTH_URL", "http://loki:3100/ready"),
    "pytorch_service": os.getenv("PYTORCH_SERVICE_HEALTH_URL", "http://pytorch-service:8888/health"),
    "browser_use": BROWSER_USE_INTERNAL_URL,
    "browser_use_vnc": BROWSER_USE_VNC_INTERNAL_URL,
    "browser_use_chrome_cdp": {
        "kind": "tcp",
        "host": os.getenv("BROWSER_USE_CDP_HOST", "host.docker.internal"),
        "port": int(os.getenv("BROWSER_USE_CDP_PORT", "9222")),
        "url": os.getenv("BROWSER_USE_CDP_URL", "http://host.docker.internal:9222"),
    },
    "playwright": {
        "kind": "tcp",
        "host": os.getenv("PLAYWRIGHT_HOST", "host.docker.internal"),
        "port": int(os.getenv("PLAYWRIGHT_PORT", "3010")),
        "url": os.getenv("PLAYWRIGHT_URL", "ws://host.docker.internal:3010/"),
    },
    "open_terminal": {
        "kind": "http",
        "url": OPEN_TERMINAL_URL,
        "health_url": os.getenv("OPEN_TERMINAL_HEALTH_URL", f"{OPEN_TERMINAL_URL}/docs"),
    },
    "postgraphile": os.getenv("POSTGRAPHILE_URL", "http://postgraphile:5000/graphql"),
}

POSTGRAPHILE_HEALTH_QUERY = {"query": "query HealthCheck { __typename }"}


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    model: str = DEFAULT_AGENT_MODEL
    temperature: float = 0.4
    num_ctx: int = 4096
    num_predict: int = 512


class TerminalCommandRequest(BaseModel):
    command: str = Field(..., min_length=1)
    cwd: str = OPEN_TERMINAL_WORKSPACE
    wait_seconds: float = Field(default=10, ge=0, le=120)
    tail: int = Field(default=80, ge=1, le=500)
    env: dict[str, str] | None = None


class TerminalInputRequest(BaseModel):
    input: str = Field(..., min_length=1)


class SandboxPlanRequest(BaseModel):
    objective: str = Field(..., min_length=1)
    base_branch: str = "agentics-mission"
    agents: list[str] = Field(default_factory=lambda: ["codex"])
    memory: str = "4GB"
    policy: str = "Balanced"


def parse_body(raw: bytes) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def request_json(
    url: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = HTTP_TIMEOUT,
    headers: dict[str, str] | None = None,
):
    body = None
    request_headers = {"Accept": "application/json", "User-Agent": "agentics-tools-api/0.1"}
    if headers:
        request_headers.update(headers)
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, parse_body(response.read())


def check_url(url: str):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return {"ok": True, "status": response.status, "url": url}
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "url": url, "error": str(error)}
    except Exception as error:
        return {"ok": False, "url": url, "error": f"{type(error).__name__}: {error}"}


def check_tcp(host: str, port: int, url: str | None = None):
    try:
        with socket.create_connection((host, port), timeout=5):
            return {"ok": True, "host": host, "port": port, "url": url or f"tcp://{host}:{port}"}
    except Exception as error:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "url": url or f"tcp://{host}:{port}",
            "error": f"{type(error).__name__}: {error}",
        }


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
        with urllib.request.urlopen(request, timeout=5) as response:
            body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "ok": 200 <= response.status < 300 and "data" in payload,
                "status": response.status,
                "method": "POST",
                "url": url,
            }
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "method": "POST", "url": url, "error": str(error)}
    except Exception as error:
        return {"ok": False, "method": "POST", "url": url, "error": f"{type(error).__name__}: {error}"}


def check_service(name: str):
    service = SERVICES[name]
    if isinstance(service, dict):
        if service.get("kind") == "tcp":
            return check_tcp(str(service["host"]), int(service["port"]), str(service.get("url") or ""))
        return check_url(str(service.get("health_url") or service["url"]))

    if name == "postgraphile":
        return check_graphql(service)
    return check_url(service)


def ollama_generate(payload: dict[str, Any]):
    return request_json(f"{OLLAMA_BASE_URL}/api/generate", method="POST", payload=payload, timeout=120)


def open_terminal_headers() -> dict[str, str]:
    if not OPEN_TERMINAL_API_KEY:
        return {}
    return {"Authorization": f"Bearer {OPEN_TERMINAL_API_KEY}"}


def open_terminal_request(
    path: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    query: dict[str, Any] | None = None,
    timeout: float = HTTP_TIMEOUT,
):
    url = f"{OPEN_TERMINAL_URL}{path}"
    if query:
        clean_query = {
            key: value
            for key, value in query.items()
            if value is not None
        }
        if clean_query:
            url = f"{url}?{urllib.parse.urlencode(clean_query)}"

    return request_json(
        url,
        method=method,
        payload=payload,
        timeout=timeout,
        headers=open_terminal_headers(),
    )


def sanitize_branch_segment(value: str) -> str:
    clean = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in clean:
        clean = clean.replace("--", "-")
    return clean[:48] or "agentics-mission"


@app.get("/")
def root():
    return {"ok": True, "service": "agentics-tools-api"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/services")
def services():
    return {name: check_service(name) for name in SERVICES}


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
    except Exception as error:
        return {
            "ok": False,
            "source": "ollama",
            "ollama_url": OLLAMA_BASE_URL,
            "default_model": DEFAULT_AGENT_MODEL,
            "agents": [],
            "error": f"{type(error).__name__}: {error}",
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
            return {
                "ok": False,
                "status": status,
                "source": "ollama",
                "error": "Unexpected Ollama response",
                "raw": body,
            }

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
    except urllib.error.HTTPError as error:
        return {
            "ok": False,
            "status": error.code,
            "source": "ollama",
            "error": str(error),
            "body": parse_body(error.read()),
        }
    except Exception as error:
        return {"ok": False, "source": "ollama", "error": f"{type(error).__name__}: {error}"}


@app.get("/terminal/health")
def terminal_health():
    health = check_url(f"{OPEN_TERMINAL_URL}/health")
    docs = check_url(f"{OPEN_TERMINAL_URL}/docs")
    return {
        "ok": bool(health.get("ok")),
        "mode": "open-terminal",
        "url": OPEN_TERMINAL_URL,
        "workspace": OPEN_TERMINAL_WORKSPACE,
        "has_api_key": bool(OPEN_TERMINAL_API_KEY),
        "health": health,
        "docs": docs,
    }


@app.post("/terminal/execute")
def terminal_execute(command: TerminalCommandRequest):
    payload = {
        "command": command.command.strip(),
        "cwd": command.cwd or OPEN_TERMINAL_WORKSPACE,
    }
    if command.env:
        payload["env"] = command.env

    try:
        status, body = open_terminal_request(
            "/execute",
            method="POST",
            payload=payload,
            query={"wait": command.wait_seconds, "tail": command.tail},
            timeout=max(HTTP_TIMEOUT, command.wait_seconds + 10),
        )
        return {
            "ok": 200 <= status < 300,
            "status": status,
            "source": "open-terminal",
            "body": body,
        }
    except urllib.error.HTTPError as error:
        return {
            "ok": False,
            "status": error.code,
            "source": "open-terminal",
            "error": str(error),
            "body": parse_body(error.read()),
        }
    except Exception as error:
        return {"ok": False, "source": "open-terminal", "error": f"{type(error).__name__}: {error}"}


@app.get("/terminal/processes")
def terminal_processes():
    try:
        status, body = open_terminal_request("/execute")
        return {"ok": 200 <= status < 300, "status": status, "source": "open-terminal", "body": body}
    except Exception as error:
        return {"ok": False, "source": "open-terminal", "error": f"{type(error).__name__}: {error}"}


@app.get("/terminal/processes/{process_id}")
def terminal_process_status(process_id: str, wait: float = 0, offset: int = 0, tail: int = 80):
    try:
        status, body = open_terminal_request(
            f"/execute/{process_id}/status",
            query={"wait": wait, "offset": offset, "tail": tail},
        )
        return {"ok": 200 <= status < 300, "status": status, "source": "open-terminal", "body": body}
    except Exception as error:
        return {"ok": False, "source": "open-terminal", "error": f"{type(error).__name__}: {error}"}


@app.post("/terminal/processes/{process_id}/input")
def terminal_process_input(process_id: str, process_input: TerminalInputRequest):
    try:
        status, body = open_terminal_request(
            f"/execute/{process_id}/input",
            method="POST",
            payload={"input": process_input.input},
        )
        return {"ok": 200 <= status < 300, "status": status, "source": "open-terminal", "body": body}
    except Exception as error:
        return {"ok": False, "source": "open-terminal", "error": f"{type(error).__name__}: {error}"}


@app.delete("/terminal/processes/{process_id}")
def terminal_process_kill(process_id: str, force: bool = False):
    try:
        status, body = open_terminal_request(
            f"/execute/{process_id}",
            method="DELETE",
            query={"force": str(force).lower()},
        )
        return {"ok": 200 <= status < 300, "status": status, "source": "open-terminal", "body": body}
    except Exception as error:
        return {"ok": False, "source": "open-terminal", "error": f"{type(error).__name__}: {error}"}


@app.get("/sandbox/readiness")
def sandbox_readiness():
    terminal = terminal_health()
    sbx_path = shutil.which("sbx")
    return {
        "ok": bool(terminal.get("ok")),
        "active_sandbox": "open-terminal",
        "open_terminal": terminal,
        "docker_sbx": {
            "available_in_tools_container": bool(sbx_path),
            "path": sbx_path,
            "vm_backed": bool(sbx_path),
            "setup_script": "setup-docker-sbx-complete.ps1",
            "host_note": "Docker Sandboxes are host-level VM sandboxes. Install and authenticate sbx on the Windows host before agents can launch them directly.",
        },
        "recommended_commands": [
            "powershell -ExecutionPolicy Bypass -File .\\setup-docker-sbx-complete.ps1 -NetworkPolicy Balanced -TestAgent codex",
            "sbx run codex --branch agentics-mission --memory 4GB",
            "sbx ls",
        ],
    }


@app.post("/sandbox/plan")
def sandbox_plan(plan: SandboxPlanRequest):
    base = sanitize_branch_segment(plan.base_branch or plan.objective)
    agents = [sanitize_branch_segment(agent) for agent in plan.agents if agent.strip()]
    if not agents:
        agents = ["codex"]

    commands = []
    for agent in agents:
        branch = sanitize_branch_segment(f"{base}-{agent}")
        commands.append(
            {
                "agent": agent,
                "branch": branch,
                "command": f"sbx run {agent} --branch {branch} --memory {plan.memory}",
                "objective": plan.objective,
                "policy": plan.policy,
            }
        )

    return {
        "ok": True,
        "mode": "docker-sbx-plan",
        "vm_backed_requires_host_sbx": True,
        "policy": plan.policy,
        "memory": plan.memory,
        "commands": commands,
        "fallback": {
            "mode": "open-terminal",
            "execute_api": "/terminal/execute",
            "workspace": OPEN_TERMINAL_WORKSPACE,
        },
    }
