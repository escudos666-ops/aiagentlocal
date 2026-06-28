import json
import os
import sys
import urllib.error
import urllib.request


BASE_URL = os.getenv("OPENWEBUI_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
EMAIL = os.getenv("OPENWEBUI_ADMIN_EMAIL")
PASSWORD = os.getenv("OPENWEBUI_ADMIN_PASSWORD")


def request_json(path: str, method: str = "GET", token: str | None = None, payload=None):
    body = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        f"{BASE_URL}{path}", data=body, headers=headers, method=method
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def main() -> int:
    if not EMAIL or not PASSWORD:
        print("OPENWEBUI_ADMIN_EMAIL and OPENWEBUI_ADMIN_PASSWORD are required", file=sys.stderr)
        return 2

    signin = request_json(
        "/api/v1/auths/signin",
        method="POST",
        payload={"email": EMAIL, "password": PASSWORD},
    )
    token = signin.get("token")
    if not token:
        print("Signin response did not include a token", file=sys.stderr)
        return 1

    tool_server_config = request_json("/api/v1/configs/tool_servers", token=token)
    tools = request_json("/api/v1/tools/", token=token)

    connections = tool_server_config.get("TOOL_SERVER_CONNECTIONS", [])
    mcp_connections = [
        connection
        for connection in connections
        if connection.get("type") == "mcp"
        and connection.get("info", {}).get("id") == "agentics_mcp"
    ]
    mcp_tool_entries = [tool for tool in tools if tool.get("id") == "server:mcp:agentics_mcp"]

    print(
        json.dumps(
            {
                "mcp_configured": bool(mcp_connections),
                "mcp_visible_in_tools": bool(mcp_tool_entries),
                "mcp_connection_count": len(mcp_connections),
                "tool_entry": mcp_tool_entries[0] if mcp_tool_entries else None,
            },
            indent=2,
        )
    )

    return 0 if mcp_connections and mcp_tool_entries else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as exc:
        print(exc.read().decode("utf-8", errors="replace"), file=sys.stderr)
        raise