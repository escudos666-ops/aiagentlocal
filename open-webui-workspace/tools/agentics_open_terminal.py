"""
title: Agentics Open Terminal
author: Agentics
version: 1.0.0
required_open_webui_version: 0.6.0
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request


class Tools:
    def __init__(self):
        self.base_url = os.getenv("OPEN_TERMINAL_URL", "http://open-terminal:8000").rstrip("/")
        self.api_key = os.getenv("OPEN_TERMINAL_API_KEY", "")
        self.default_cwd = os.getenv("OPEN_TERMINAL_WORKSPACE", "/home/user/workspace")

    def _headers(self) -> dict:
        headers = {
            "Accept": "application/json",
            "User-Agent": "open-webui-agentics-terminal/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(
        self,
        path: str,
        method: str = "GET",
        payload: dict | None = None,
        query: dict | None = None,
        timeout: int = 30,
    ) -> dict:
        url = f"{self.base_url}{path}"
        if query:
            query_string = urllib.parse.urlencode(
                {key: value for key, value in query.items() if value is not None}
            )
            if query_string:
                url = f"{url}?{query_string}"

        headers = self._headers()
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
                body = json.loads(raw) if raw else None
                return {"ok": 200 <= response.status < 300, "status": response.status, "body": body}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = raw
            return {"ok": False, "status": exc.code, "error": str(exc), "body": body}
        except Exception as exc:
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    def terminal_health(self) -> str:
        """Check whether the Agentics Open Terminal sandbox API is reachable."""
        return json.dumps(
            {
                "health": self._request("/health", timeout=8),
                "base_url": self.base_url,
                "default_cwd": self.default_cwd,
                "has_api_key": bool(self.api_key),
            },
            indent=2,
        )

    def run_terminal_command(
        self,
        command: str,
        cwd: str = "",
        wait_seconds: float = 10,
        tail: int = 80,
    ) -> str:
        """Run a shell command in the isolated Open Terminal Linux workspace."""
        command = command.strip()
        if not command:
            return json.dumps({"ok": False, "error": "command is required"}, indent=2)

        wait_seconds = max(0, min(float(wait_seconds), 120))
        tail = max(1, min(int(tail), 500))
        payload = {"command": command, "cwd": cwd.strip() or self.default_cwd}
        result = self._request(
            "/execute",
            method="POST",
            payload=payload,
            query={"wait": wait_seconds, "tail": tail},
            timeout=int(wait_seconds) + 15,
        )
        return json.dumps(result, indent=2)

    def list_terminal_processes(self) -> str:
        """List tracked Open Terminal background processes."""
        return json.dumps(self._request("/execute", timeout=10), indent=2)

    def get_terminal_process_status(
        self,
        process_id: str,
        wait_seconds: float = 0,
        offset: int = 0,
        tail: int = 80,
    ) -> str:
        """Get output and status for a running Open Terminal process."""
        process_id = process_id.strip()
        if not process_id:
            return json.dumps({"ok": False, "error": "process_id is required"}, indent=2)

        result = self._request(
            f"/execute/{urllib.parse.quote(process_id)}/status",
            query={
                "wait": max(0, min(float(wait_seconds), 120)),
                "offset": max(0, int(offset)),
                "tail": max(1, min(int(tail), 500)),
            },
            timeout=int(wait_seconds) + 15,
        )
        return json.dumps(result, indent=2)

    def send_terminal_input(self, process_id: str, input_text: str) -> str:
        """Send stdin text to an Open Terminal process."""
        process_id = process_id.strip()
        if not process_id:
            return json.dumps({"ok": False, "error": "process_id is required"}, indent=2)
        result = self._request(
            f"/execute/{urllib.parse.quote(process_id)}/input",
            method="POST",
            payload={"input": input_text},
            timeout=10,
        )
        return json.dumps(result, indent=2)

    def kill_terminal_process(self, process_id: str, force: bool = False) -> str:
        """Terminate an Open Terminal process."""
        process_id = process_id.strip()
        if not process_id:
            return json.dumps({"ok": False, "error": "process_id is required"}, indent=2)
        result = self._request(
            f"/execute/{urllib.parse.quote(process_id)}",
            method="DELETE",
            query={"force": str(bool(force)).lower()},
            timeout=10,
        )
        return json.dumps(result, indent=2)
