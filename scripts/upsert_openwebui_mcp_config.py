import argparse
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_CONNECTION = {
    "url": "http://agentics-mcp:8766/mcp",
    "path": "",
    "type": "mcp",
    "auth_type": "none",
    "headers": {},
    "key": "",
    "config": {
        "enable": True,
        "access_grants": [
            {
                "principal_type": "user",
                "principal_id": "*",
                "permission": "read",
            }
        ],
    },
    "info": {
        "id": "agentics_mcp",
        "name": "Agentics MCP",
        "description": "Local Agentics MCP tools for service health checks and Agentics automations.",
    },
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Upsert Agentics MCP into Open WebUI config.")
    parser.add_argument("db", help="Path to Open WebUI webui.db")
    parser.add_argument("--apply", action="store_true", help="Apply the change")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()
    tables = {
        row[0]
        for row in cursor.execute(
            "select name from sqlite_master where type = 'table' order by name"
        )
    }
    if "config" not in tables:
        raise SystemExit("Open WebUI config table not found")

    row = cursor.execute("select id, data from config order by id desc limit 1").fetchone()
    if row is None:
        config_id = None
        data = {"version": 0, "ui": {}}
    else:
        config_id = row[0]
        raw_data = row[1]
        data = raw_data if isinstance(raw_data, dict) else json.loads(raw_data)

    tool_server = data.setdefault("tool_server", {})
    connections = tool_server.setdefault("connections", [])
    before_count = len(connections)
    connections = [
        connection
        for connection in connections
        if connection.get("url") != DEFAULT_CONNECTION["url"]
        and connection.get("info", {}).get("id") != DEFAULT_CONNECTION["info"]["id"]
    ]
    connections.append(DEFAULT_CONNECTION)
    tool_server["connections"] = connections

    print(f"Existing tool_server.connections: {before_count}")
    print(f"Updated tool_server.connections: {len(connections)}")
    print(json.dumps(DEFAULT_CONNECTION, indent=2))

    if not args.apply:
        print("Dry run only. Re-run with --apply to persist.")
        return 0

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.with_name(f"{db_path.name}.before-mcp-config.{timestamp}.bak")
    connection.close()
    shutil.copy2(db_path, backup_path)
    print(f"Backup written: {backup_path}")

    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
    payload = json.dumps(data)
    if config_id is None:
        cursor.execute(
            "insert into config (data, version, created_at, updated_at) values (?, ?, ?, ?)",
            (payload, data.get("version", 0), now, now),
        )
    else:
        cursor.execute(
            "update config set data = ?, updated_at = ? where id = ?",
            (payload, now, config_id),
        )
    connection.commit()
    connection.close()
    print("Agentics MCP persisted in Open WebUI config.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())