import json
import os
import base64
import socket
import urllib.error
import urllib.request
from urllib.parse import urlparse
from typing import Any

from mcp.server.fastmcp import FastMCP
from starlette.responses import JSONResponse


MCP_NAME = os.getenv("MCP_NAME", "Agentics MCP")
MCP_HOST = os.getenv("MCP_HOST", "0.0.0.0")
MCP_PORT = int(os.getenv("MCP_PORT", "8766"))
MCP_PATH = os.getenv("MCP_PATH", "/mcp")
HTTP_TIMEOUT = float(os.getenv("MCP_HTTP_TIMEOUT", "10"))


def _playwright_ws_url() -> str:
    return os.getenv("PLAYWRIGHT_WS_URL", "ws://host.docker.internal:3010/")


def _browser_use_webui_url() -> str:
    return os.getenv("BROWSER_USE_WEBUI_URL", "http://host.docker.internal:7788").rstrip("/")


def _browser_use_vnc_url() -> str:
    return os.getenv("BROWSER_USE_VNC_URL", "http://host.docker.internal:6080").rstrip("/")


def _browser_use_cdp_url() -> str:
    return os.getenv(
        "BROWSER_USE_CDP_URL",
        "http://host.docker.internal:9222/json/version",
    )


mcp = FastMCP(
    name=MCP_NAME,
    instructions=(
        "Local Agentics MCP tools for Open WebUI. Use these tools for service "
        "health checks, local Agentics automation through n8n, and explicitly "
        "requested WhatsApp sending."
    ),
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path=MCP_PATH,
    stateless_http=True,
)


def _parse_body(raw: bytes) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return None

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _request(
    url: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = HTTP_TIMEOUT,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    request_headers = {"User-Agent": "agentics-mcp/0.1"}
    if headers:
        request_headers.update(headers)
    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "url": url,
                "body": _parse_body(response.read()),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": exc.code,
            "url": url,
            "error": str(exc),
            "body": _parse_body(exc.read()),
        }
    except Exception as exc:
        return {
            "ok": False,
            "url": url,
            "error": f"{type(exc).__name__}: {exc}",
        }


def _request_status(url: str, timeout: float = HTTP_TIMEOUT) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "agentics-mcp/0.1"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "url": url,
                "content_type": response.headers.get("content-type"),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": exc.code,
            "url": url,
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "ok": False,
            "url": url,
            "error": f"{type(exc).__name__}: {exc}",
        }


def _tcp_check(host: str, port: int, timeout: float = HTTP_TIMEOUT) -> dict[str, Any]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"ok": True, "host": host, "port": port}
    except Exception as exc:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "error": f"{type(exc).__name__}: {exc}",
        }


def _tcp_target_from_url(url: str) -> tuple[str, int]:
    parsed = urlparse(url)
    if not parsed.hostname:
        raise ValueError(f"URL does not include a host: {url}")

    if parsed.port:
        port = parsed.port
    elif parsed.scheme in {"wss", "https"}:
        port = 443
    else:
        port = 80

    return parsed.hostname, port


def _ensure_url(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("url is required")
    if value.startswith(("http://", "https://")):
        return value
    return f"https://{value}"


def _connection_catalog() -> dict[str, dict[str, Any]]:
    playwright_ws = _playwright_ws_url()
    playwright_host, playwright_port = _tcp_target_from_url(playwright_ws)
    browser_webui = _browser_use_webui_url()

    return {
        "browser_use_webui": {
            "kind": "http",
            "url": browser_webui,
            "health_url": f"{browser_webui}/config",
            "description": "Browser Use Gradio WebUI for AI-controlled browsing tasks.",
        },
        "browser_use_vnc": {
            "kind": "http",
            "url": _browser_use_vnc_url(),
            "description": "noVNC browser view for the Browser Use container.",
        },
        "browser_use_chrome_cdp": {
            "kind": "tcp",
            "url": _browser_use_cdp_url(),
            "host": os.getenv("BROWSER_USE_CDP_HOST", "host.docker.internal"),
            "port": int(os.getenv("BROWSER_USE_CDP_PORT", "9222")),
            "description": "Chrome DevTools Protocol endpoint exposed by Browser Use when Chromium is running.",
        },
        "playwright": {
            "kind": "tcp",
            "url": playwright_ws,
            "host": playwright_host,
            "port": playwright_port,
            "description": "Remote Playwright run-server websocket used by MCP browser automation tools.",
        },
        "open_terminal": {
            "kind": "http",
            "url": os.getenv("OPEN_TERMINAL_URL", "http://open-terminal:8000"),
            "health_url": os.getenv("OPEN_TERMINAL_HEALTH_URL", "http://open-terminal:8000/docs"),
            "description": "Open WebUI terminal service on the Agentics Docker network.",
        },
    }


def _service_catalog() -> dict[str, str | dict[str, Any]]:
    waha_headers = {}
    if os.getenv("WAHA_API_KEY"):
        waha_headers["X-Api-Key"] = os.getenv("WAHA_API_KEY", "")

    return {
        "ollama": os.getenv("OLLAMA_HEALTH_URL", "http://ollama:11434/api/tags"),
        "open_webui": os.getenv("OPEN_WEBUI_HEALTH_URL", "http://open-webui:8080/health"),
        "n8n": os.getenv("N8N_HEALTH_URL", "http://n8n:5678/healthz"),
        "postgres": {
            "kind": "tcp",
            "host": os.getenv("POSTGRES_HOST", "postgres"),
            "port": int(os.getenv("POSTGRES_PORT", "5432")),
            "url": "tcp://postgres:5432",
        },
        "redis": {
            "kind": "tcp",
            "host": os.getenv("REDIS_HOST", "redis"),
            "port": int(os.getenv("REDIS_PORT", "6379")),
            "url": "tcp://redis:6379",
        },
        "minio": os.getenv("MINIO_HEALTH_URL", "http://minio:9000/minio/health/live"),
        "chroma": os.getenv("CHROMA_HEALTH_URL", "http://chroma:8000/api/v2/heartbeat"),
        "tika": os.getenv("TIKA_HEALTH_URL", "http://tika:9998/tika"),
        "grafana": os.getenv("GRAFANA_HEALTH_URL", "http://grafana:3000/api/health"),
        "agentics_tools_api": os.getenv("AGENTICS_TOOLS_API_URL", "http://agentics-tools-api:8765/health"),
        "browser_use_webui": os.getenv("BROWSER_USE_HEALTH_URL", f"{_browser_use_webui_url()}/config"),
        "browser_use_vnc": os.getenv("BROWSER_USE_VNC_HEALTH_URL", _browser_use_vnc_url()),
        "browser_use_chrome_cdp": {
            "kind": "tcp",
            "host": os.getenv("BROWSER_USE_CDP_HOST", "host.docker.internal"),
            "port": int(os.getenv("BROWSER_USE_CDP_PORT", "9222")),
            "url": _browser_use_cdp_url(),
        },
        "open_terminal": os.getenv("OPEN_TERMINAL_HEALTH_URL", "http://open-terminal:8000/docs"),
        "waha": {
            "kind": "http",
            "url": os.getenv("WAHA_HEALTH_URL", "http://waha:3000/api/sessions"),
            "headers": waha_headers,
        },
        "postgraphile": {
            "kind": "http",
            "url": os.getenv("POSTGRAPHILE_GRAPHQL_URL", "http://postgraphile:5000/graphql"),
            "method": "POST",
            "payload": {"query": "query HealthCheck { __typename }"},
        },
        "docker_model_runner": os.getenv(
            "DOCKER_MODEL_RUNNER_URL",
            "http://host.docker.internal:12434/engines/llama.cpp/v1/models",
        ),
    }


def _check_service_target(target: str | dict[str, Any]) -> dict[str, Any]:
    if isinstance(target, str):
        return _request(target, timeout=HTTP_TIMEOUT)

    if target.get("kind") == "tcp":
        return _tcp_check(target["host"], int(target["port"]), timeout=min(HTTP_TIMEOUT, 5))

    return _request(
        target["url"],
        method=target.get("method", "GET"),
        payload=target.get("payload"),
        headers=target.get("headers"),
        timeout=min(HTTP_TIMEOUT, 5),
    )


def _get_browser_use_config() -> dict[str, Any]:
    result = _request(f"{_browser_use_webui_url()}/config", timeout=min(HTTP_TIMEOUT, 10))
    if not result.get("ok") or not isinstance(result.get("body"), dict):
        return result

    body = result["body"]
    dependencies = body.get("dependencies", [])
    api_names = [
        dependency.get("api_name")
        for dependency in dependencies
        if dependency.get("api_name") and dependency.get("show_api", True)
    ]

    return {
        "ok": True,
        "url": _browser_use_webui_url(),
        "no_vnc_url": _browser_use_vnc_url(),
        "api_prefix": body.get("api_prefix", "/gradio_api"),
        "title": body.get("title"),
        "api_names": api_names,
        "recommended_api_names": {
            "run_browser_use_agent": "submit_wrapper",
            "stop_browser_use_agent": "stop_wrapper",
            "pause_or_resume_browser_use_agent": "pause_resume_wrapper",
            "clear_browser_use_agent": "clear_wrapper",
            "run_deep_research": "start_wrapper",
            "stop_deep_research": "stop_wrapper_1",
        },
    }


def _with_playwright_page(
    url: str,
    wait_until: str,
    wait_ms: int,
    timeout_ms: int,
    width: int,
    height: int,
):
    from playwright.sync_api import sync_playwright

    allowed_wait_until = {"commit", "domcontentloaded", "load", "networkidle"}
    if wait_until not in allowed_wait_until:
        raise ValueError(
            f"wait_until must be one of {sorted(allowed_wait_until)}, got {wait_until!r}"
        )

    normalized_url = _ensure_url(url)
    playwright = sync_playwright().start()
    browser = None
    context = None
    try:
        browser = playwright.chromium.connect(_playwright_ws_url(), timeout=timeout_ms)
        context = browser.new_context(viewport={"width": width, "height": height})
        page = context.new_page()
        response = page.goto(normalized_url, wait_until=wait_until, timeout=timeout_ms)
        if wait_ms > 0:
            page.wait_for_timeout(wait_ms)

        return playwright, browser, context, page, response
    except Exception:
        if context is not None:
            context.close()
        if browser is not None:
            browser.close()
        playwright.stop()
        raise


def _close_playwright(playwright, browser, context) -> None:
    try:
        if context is not None:
            context.close()
    finally:
        try:
            if browser is not None:
                browser.close()
        finally:
            playwright.stop()


@mcp.custom_route("/health", methods=["GET"])
async def health(_request_obj):
    return JSONResponse(
        {
            "ok": True,
            "service": MCP_NAME,
            "transport": "streamable-http",
            "mcp_url": f"http://{MCP_HOST}:{MCP_PORT}{MCP_PATH}",
        }
    )


@mcp.tool()
def list_agentics_services() -> dict[str, Any]:
    """List the known local Agentics services and the URL used to check each one."""
    return {"services": _service_catalog()}


@mcp.tool()
def check_agentics_service(name: str) -> dict[str, Any]:
    """Check one local Agentics service by name and return status details."""
    services = _service_catalog()
    if name not in services:
        return {
            "ok": False,
            "error": f"Unknown service: {name}",
            "known_services": sorted(services),
        }

    return _check_service_target(services[name])


@mcp.tool()
def check_all_agentics_services() -> dict[str, Any]:
    """Check all known local Agentics services and return a status map."""
    return {
        name: _check_service_target(target)
        for name, target in _service_catalog().items()
    }


@mcp.tool()
def list_agentics_connections() -> dict[str, Any]:
    """List callable local connection endpoints exposed through the Agentics MCP hub."""
    return {"connections": _connection_catalog()}


@mcp.tool()
def check_agentics_connection(name: str) -> dict[str, Any]:
    """Check one callable connection endpoint such as browser_use_webui or playwright."""
    connections = _connection_catalog()
    if name not in connections:
        return {
            "ok": False,
            "error": f"Unknown connection: {name}",
            "known_connections": sorted(connections),
        }

    connection = connections[name]
    if connection.get("kind") == "tcp":
        return _tcp_check(connection["host"], int(connection["port"]), timeout=min(HTTP_TIMEOUT, 5))

    return _request_status(connection.get("health_url") or connection["url"], timeout=min(HTTP_TIMEOUT, 5))


@mcp.tool()
def check_all_agentics_connections() -> dict[str, Any]:
    """Check all callable local connection endpoints exposed through MCP."""
    return {name: check_agentics_connection(name) for name in _connection_catalog()}


@mcp.tool()
def call_agentics_connection(
    name: str,
    path: str = "",
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = HTTP_TIMEOUT,
) -> dict[str, Any]:
    """Call a whitelisted local HTTP connection by name, such as browser_use_webui."""
    connections = _connection_catalog()
    if name not in connections:
        return {
            "ok": False,
            "error": f"Unknown connection: {name}",
            "known_connections": sorted(connections),
        }

    connection = connections[name]
    if connection.get("kind") != "http":
        return {
            "ok": False,
            "error": f"Connection {name!r} is not an HTTP connection. Use a dedicated tool instead.",
            "connection": connection,
        }

    method = method.upper().strip()
    if method not in {"GET", "POST"}:
        return {"ok": False, "error": "method must be GET or POST"}

    if path.startswith(("http://", "https://")):
        return {"ok": False, "error": "path must be relative, not an absolute URL"}

    base_url = connection["url"].rstrip("/")
    url = base_url if not path else f"{base_url}/{path.lstrip('/')}"
    return _request(url, method=method, payload=payload, timeout=timeout)


@mcp.tool()
def browser_use_webui_status() -> dict[str, Any]:
    """Return Browser Use WebUI status, URLs, and available Gradio API names."""
    return _get_browser_use_config()


@mcp.tool()
def playwright_open_page(
    url: str,
    wait_until: str = "domcontentloaded",
    wait_ms: int = 1000,
    timeout_ms: int = 30000,
    text_limit: int = 2500,
    screenshot: bool = False,
    full_page: bool = False,
    width: int = 1280,
    height: int = 900,
) -> dict[str, Any]:
    """Open a URL through the connected Playwright server and return page details."""
    playwright = browser = context = None
    try:
        playwright, browser, context, page, response = _with_playwright_page(
            url=url,
            wait_until=wait_until,
            wait_ms=wait_ms,
            timeout_ms=timeout_ms,
            width=width,
            height=height,
        )

        body_text = ""
        body_text_error = None
        try:
            body_text = page.locator("body").inner_text(timeout=min(timeout_ms, 5000))
        except Exception as exc:
            body_text_error = f"{type(exc).__name__}: {exc}"

        screenshot_base64 = None
        if screenshot:
            screenshot_base64 = base64.b64encode(
                page.screenshot(full_page=full_page, timeout=timeout_ms)
            ).decode("ascii")

        return {
            "ok": True,
            "playwright_ws_url": _playwright_ws_url(),
            "requested_url": url,
            "final_url": page.url,
            "title": page.title(),
            "status": response.status if response else None,
            "body_text": body_text[: max(0, text_limit)],
            "body_text_truncated": len(body_text) > text_limit,
            "body_text_error": body_text_error,
            "screenshot_base64": screenshot_base64,
        }
    except Exception as exc:
        return {
            "ok": False,
            "playwright_ws_url": _playwright_ws_url(),
            "requested_url": url,
            "error": f"{type(exc).__name__}: {exc}",
        }
    finally:
        if playwright is not None:
            _close_playwright(playwright, browser, context)


@mcp.tool()
def playwright_extract_links(
    url: str,
    limit: int = 50,
    wait_until: str = "domcontentloaded",
    wait_ms: int = 1000,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """Open a URL through Playwright and return links discovered on the page."""
    playwright = browser = context = None
    try:
        playwright, browser, context, page, response = _with_playwright_page(
            url=url,
            wait_until=wait_until,
            wait_ms=wait_ms,
            timeout_ms=timeout_ms,
            width=1280,
            height=900,
        )
        links = page.eval_on_selector_all(
            "a[href]",
            """
            (elements, limit) => elements
                .map((element) => ({
                    text: (element.innerText || element.textContent || '').trim(),
                    href: element.href,
                }))
                .filter((link) => link.href)
                .slice(0, limit)
            """,
            max(1, min(limit, 200)),
        )

        return {
            "ok": True,
            "playwright_ws_url": _playwright_ws_url(),
            "requested_url": url,
            "final_url": page.url,
            "title": page.title(),
            "status": response.status if response else None,
            "links": links,
        }
    except Exception as exc:
        return {
            "ok": False,
            "playwright_ws_url": _playwright_ws_url(),
            "requested_url": url,
            "error": f"{type(exc).__name__}: {exc}",
        }
    finally:
        if playwright is not None:
            _close_playwright(playwright, browser, context)


@mcp.tool()
def ask_agentics_router(
    message: str,
    model: str = "agentics-assistant:latest",
    temperature: float = 0.4,
    num_ctx: int = 4096,
    num_predict: int = 512,
) -> dict[str, Any]:
    """Send a message to the local Agentics n8n chat router webhook."""
    if not message.strip():
        return {"ok": False, "error": "message is required"}

    return _request(
        os.getenv("N8N_CHAT_URL", "http://n8n:5678/webhook/agentics-chat"),
        method="POST",
        payload={
            "message": message,
            "model": model,
            "temperature": temperature,
            "num_ctx": num_ctx,
            "num_predict": num_predict,
        },
        timeout=float(os.getenv("N8N_ROUTER_TIMEOUT", "120")),
    )


@mcp.tool()
def send_whatsapp_message(chat_id: str, text: str, session: str = "default") -> dict[str, Any]:
    """Send a WhatsApp message through the local WAHA/n8n bridge when explicitly requested."""
    if not chat_id.strip():
        return {"ok": False, "error": "chat_id is required"}
    if not text.strip():
        return {"ok": False, "error": "text is required"}

    return _request(
        os.getenv("N8N_WHATSAPP_URL", "http://n8n:5678/webhook/agentics-whatsapp-send"),
        method="POST",
        payload={"session": session, "chatId": chat_id, "text": text},
        timeout=float(os.getenv("N8N_WHATSAPP_TIMEOUT", "60")),
    )


@mcp.resource("agentics://services")
def services_resource() -> str:
    """Return the known Agentics service catalog as JSON."""
    return json.dumps(_service_catalog(), indent=2)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
