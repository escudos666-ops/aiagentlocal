"""
title: Agentics Stack Health
author: Agentics
version: 1.0.1
required_open_webui_version: 0.6.0
"""

import json
import socket
import urllib.error
import urllib.request


class Tools:
    def _http_status(self, name: str, url: str, timeout: int = 4) -> dict:
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "*/*",
                "User-Agent": "open-webui-agentics-tool/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return {"ok": 200 <= response.status < 400, "status": response.status, "url": url}
        except urllib.error.HTTPError as exc:
            return {"ok": False, "status": exc.code, "url": url, "error": str(exc)}
        except Exception as exc:
            return {"ok": False, "url": url, "error": f"{type(exc).__name__}: {exc}"}

    def _tcp_status(self, host: str, port: int, timeout: int = 4) -> dict:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return {"ok": True, "host": host, "port": port}
        except Exception as exc:
            return {"ok": False, "host": host, "port": port, "error": f"{type(exc).__name__}: {exc}"}

    def stack_health(self) -> str:
        """Return fast health checks for the core local Agentics stack services."""
        checks = {
            "open_webui": self._http_status("open_webui", "http://open-webui:8080/health"),
            "ollama": self._http_status("ollama", "http://ollama:11434/api/tags"),
            "agentics_gateway": self._http_status("agentics_gateway", "http://agentics-gateway:8088/health"),
            "agentics_mcp": self._http_status("agentics_mcp", "http://agentics-mcp:8766/health"),
            "agentics_tools_api": self._http_status("agentics_tools_api", "http://agentics-tools-api:8765/health"),
            "n8n": self._http_status("n8n", "http://n8n:5678/healthz"),
            "postgraphile": self._http_status("postgraphile", "http://postgraphile:5000/graphiql"),
            "chroma": self._http_status("chroma", "http://chroma:8000/api/v2/heartbeat"),
            "minio": self._http_status("minio", "http://minio:9000/minio/health/live"),
            "tika": self._http_status("tika", "http://tika:9998/tika"),
            "pytorch_service": self._http_status("pytorch_service", "http://pytorch-service:8888/health"),
            "open_terminal": self._http_status("open_terminal", "http://open-terminal:8000/health"),
            "postgres": self._tcp_status("postgres", 5432),
            "redis": self._tcp_status("redis", 6379),
        }
        return json.dumps(checks, indent=2)

    def mcp_health(self) -> str:
        """Return the Agentics MCP server health payload."""
        return json.dumps(self._http_status("agentics_mcp", "http://agentics-mcp:8766/health"), indent=2)

    def n8n_health(self) -> str:
        """Return the n8n health endpoint status."""
        return json.dumps(self._http_status("n8n", "http://n8n:5678/healthz"), indent=2)
