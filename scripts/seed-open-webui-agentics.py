#!/usr/bin/env python3
"""Seed Agentics tools, skills, functions, and prompts into Open WebUI."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "open-webui-workspace"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def tool_specs() -> dict[str, list[dict]]:
    return {
        "agentics_stack_health": [
            {
                "name": "stack_health",
                "description": "Return the Agentics service inventory and health status from the local tools API.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "mcp_health",
                "description": "Return the Agentics MCP server health payload.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "n8n_health",
                "description": "Return the n8n health endpoint status.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        ],
        "agentics_open_terminal": [
            {
                "name": "terminal_health",
                "description": "Check whether the Agentics Open Terminal sandbox API is reachable.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_terminal_command",
                "description": "Run a shell command in the isolated Open Terminal Linux workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Shell command to run."},
                        "cwd": {
                            "type": "string",
                            "description": "Working directory inside open-terminal.",
                            "default": "/home/user/workspace",
                        },
                        "wait_seconds": {
                            "type": "number",
                            "description": "Seconds to wait for completion before returning.",
                            "default": 10,
                        },
                        "tail": {
                            "type": "integer",
                            "description": "Maximum output entries to return.",
                            "default": 80,
                        },
                    },
                    "required": ["command"],
                },
            },
            {
                "name": "list_terminal_processes",
                "description": "List tracked Open Terminal background processes.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "get_terminal_process_status",
                "description": "Get output and status for a running Open Terminal process.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "process_id": {"type": "string"},
                        "wait_seconds": {"type": "number", "default": 0},
                        "offset": {"type": "integer", "default": 0},
                        "tail": {"type": "integer", "default": 80},
                    },
                    "required": ["process_id"],
                },
            },
            {
                "name": "send_terminal_input",
                "description": "Send stdin text to an Open Terminal process.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "process_id": {"type": "string"},
                        "input_text": {"type": "string"},
                    },
                    "required": ["process_id", "input_text"],
                },
            },
            {
                "name": "kill_terminal_process",
                "description": "Terminate an Open Terminal process.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "process_id": {"type": "string"},
                        "force": {"type": "boolean", "default": False},
                    },
                    "required": ["process_id"],
                },
            },
        ],
    }


def build_payload() -> dict:
    specs = tool_specs()
    prompts = [
        ("stack-doctor", "Stack Doctor", "stack-doctor.md", ["agentics", "ops", "docker"]),
        ("terminal-task", "Terminal Task", "terminal-task.md", ["agentics", "terminal", "sandbox"]),
        (
            "sandbox-agent-mission",
            "Sandbox Agent Mission",
            "sandbox-agent-mission.md",
            ["agentics", "sandbox", "agents"],
        ),
        (
            "webui-functional-smoke",
            "WebUI Functional Smoke",
            "webui-functional-smoke.md",
            ["agentics", "webui", "smoke-test"],
        ),
        (
            "model-router-check",
            "Model Router Check",
            "model-router-check.md",
            ["agentics", "models", "dmr", "ollama"],
        ),
    ]

    return {
        "db_path": "/app/backend/data/webui.db",
        "tools": [
            {
                "id": "agentics_stack_health",
                "name": "Agentics Stack Health",
                "content": read_text(WORKSPACE / "tools" / "agentics_stack_health.py"),
                "specs": specs["agentics_stack_health"],
                "meta": {
                    "description": "Health and service checks for the local Agentics stack.",
                    "manifest": {"title": "Agentics Stack Health"},
                },
                "valves": {},
            },
            {
                "id": "agentics_open_terminal",
                "name": "Agentics Open Terminal",
                "content": read_text(WORKSPACE / "tools" / "agentics_open_terminal.py"),
                "specs": specs["agentics_open_terminal"],
                "meta": {
                    "description": "Authenticated command execution through the local Open Terminal sandbox.",
                    "manifest": {"title": "Agentics Open Terminal"},
                },
                "valves": {},
            },
        ],
        "functions": [
            {
                "id": "agentics_context_filter",
                "name": "Agentics Context Filter",
                "type": "filter",
                "content": read_text(WORKSPACE / "functions" / "agentics_context_filter.py"),
                "meta": {
                    "description": "Adds local Agentics endpoint context to chat metadata.",
                    "manifest": {"title": "Agentics Context Filter", "type": "filter"},
                },
                "valves": {},
                "is_active": 1,
                "is_global": 0,
            }
        ],
        "skills": [
            {
                "id": "agentics-stack-operator",
                "name": "Agentics Stack Operator",
                "description": "Use the local Agentics MCP, tools API, gateway, n8n, and model services safely and directly.",
                "content": read_text(WORKSPACE / "skills" / "agentics-stack-operator.md"),
                "meta": {"tags": ["agentics", "local-stack", "tools"]},
            },
            {
                "id": "agentics-terminal-operator",
                "name": "Agentics Terminal Operator",
                "description": "Use Open Terminal as an isolated Linux command sandbox for Agentics work.",
                "content": read_text(WORKSPACE / "skills" / "agentics-terminal-operator.md"),
                "meta": {"tags": ["agentics", "terminal", "sandbox"]},
            },
            {
                "id": "agentics-vm-sandbox-orchestrator",
                "name": "Agentics VM Sandbox Orchestrator",
                "description": "Plan and operate VM-backed Docker Sandbox agent work when host sbx is ready.",
                "content": read_text(WORKSPACE / "skills" / "agentics-vm-sandbox-orchestrator.md"),
                "meta": {"tags": ["agentics", "docker-sbx", "vm-sandbox", "agents"]},
            },
        ],
        "prompts": [
            {
                "command": command,
                "name": name,
                "content": read_text(WORKSPACE / "prompts" / filename),
                "tags": tags,
                "data": {},
                "meta": {"source": "agentics-seed"},
            }
            for command, name, filename, tags in prompts
        ],
    }


CONTAINER_CODE = r'''
import json
import sqlite3
import sys
import time
import uuid

payload = json.load(sys.stdin)
now = int(time.time())
conn = sqlite3.connect(payload["db_path"])
cur = conn.cursor()

row = cur.execute(
    "select id from user where role='admin' order by created_at asc limit 1"
).fetchone()
if row is None:
    row = cur.execute("select id from user order by created_at asc limit 1").fetchone()
if row is None:
    raise SystemExit("No Open WebUI user found")
user_id = row[0]

counts = {"tools": 0, "functions": 0, "skills": 0, "prompts": 0}

def ensure_access_grants(resource_type, resource_id):
    for permission in ("read", "write"):
        cur.execute(
            """
            insert or ignore into access_grant
            (id, resource_type, resource_id, principal_type, principal_id, permission, created_at)
            values (?, ?, ?, 'user', '*', ?, ?)
            """,
            (str(uuid.uuid4()), resource_type, resource_id, permission, now),
        )

for tool in payload["tools"]:
    exists = cur.execute("select id from tool where id=?", (tool["id"],)).fetchone()
    values = (
        user_id,
        tool["name"],
        tool["content"],
        json.dumps(tool["specs"]),
        json.dumps(tool["meta"]),
        json.dumps(tool.get("valves") or {}),
        now,
        tool["id"],
    )
    if exists:
        cur.execute(
            """
            update tool
            set user_id=?, name=?, content=?, specs=?, meta=?, valves=?, updated_at=?
            where id=?
            """,
            values,
        )
    else:
        cur.execute(
            """
            insert into tool
            (id, user_id, name, content, specs, meta, valves, updated_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tool["id"],
                user_id,
                tool["name"],
                tool["content"],
                json.dumps(tool["specs"]),
                json.dumps(tool["meta"]),
                json.dumps(tool.get("valves") or {}),
                now,
                now,
            ),
        )
    counts["tools"] += 1
    ensure_access_grants("tool", tool["id"])

for function in payload["functions"]:
    exists = cur.execute("select id from function where id=?", (function["id"],)).fetchone()
    values = (
        user_id,
        function["name"],
        function["type"],
        function["content"],
        json.dumps(function["meta"]),
        json.dumps(function.get("valves") or {}),
        int(function.get("is_active", 1)),
        int(function.get("is_global", 0)),
        now,
        function["id"],
    )
    if exists:
        cur.execute(
            """
            update function
            set user_id=?, name=?, type=?, content=?, meta=?, valves=?,
                is_active=?, is_global=?, updated_at=?
            where id=?
            """,
            values,
        )
    else:
        cur.execute(
            """
            insert into function
            (id, user_id, name, type, content, meta, valves, is_active, is_global, updated_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                function["id"],
                user_id,
                function["name"],
                function["type"],
                function["content"],
                json.dumps(function["meta"]),
                json.dumps(function.get("valves") or {}),
                int(function.get("is_active", 1)),
                int(function.get("is_global", 0)),
                now,
                now,
            ),
        )
    counts["functions"] += 1

for skill in payload["skills"]:
    exists = cur.execute("select id from skill where id=?", (skill["id"],)).fetchone()
    values = (
        user_id,
        skill["name"],
        skill["description"],
        skill["content"],
        json.dumps(skill["meta"]),
        1,
        now,
        skill["id"],
    )
    if exists:
        cur.execute(
            """
            update skill
            set user_id=?, name=?, description=?, content=?, meta=?, is_active=?, updated_at=?
            where id=?
            """,
            values,
        )
    else:
        cur.execute(
            """
            insert into skill
            (id, user_id, name, description, content, meta, is_active, updated_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                skill["id"],
                user_id,
                skill["name"],
                skill["description"],
                skill["content"],
                json.dumps(skill["meta"]),
                1,
                now,
                now,
            ),
        )
    counts["skills"] += 1
    ensure_access_grants("skill", skill["id"])

for prompt in payload["prompts"]:
    row = cur.execute(
        "select id from prompt where command=?",
        (prompt["command"],),
    ).fetchone()
    if row:
        cur.execute(
            """
            update prompt
            set user_id=?, name=?, content=?, data=?, meta=?,
                is_active=1, tags=?, updated_at=?
            where command=?
            """,
            (
                user_id,
                prompt["name"],
                prompt["content"],
                json.dumps(prompt.get("data") or {}),
                json.dumps(prompt.get("meta") or {}),
                json.dumps(prompt.get("tags") or []),
                now,
                prompt["command"],
            ),
        )
    else:
        cur.execute(
            """
            insert into prompt
            (id, command, user_id, name, content, data, meta, is_active,
             version_id, tags, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                prompt["command"],
                user_id,
                prompt["name"],
                prompt["content"],
                json.dumps(prompt.get("data") or {}),
                json.dumps(prompt.get("meta") or {}),
                str(uuid.uuid4()),
                json.dumps(prompt.get("tags") or []),
                now,
                now,
            ),
        )
    counts["prompts"] += 1

conn.commit()
print(json.dumps({"ok": True, "user_id": user_id, "counts": counts}, indent=2))
'''


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="open-webui")
    args = parser.parse_args()

    payload = build_payload()
    proc = subprocess.run(
        ["docker", "exec", "-i", args.container, "python", "-c", textwrap.dedent(CONTAINER_CODE)],
        input=json.dumps(payload),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=ROOT,
        check=False,
    )
    if proc.stdout:
        print(proc.stdout.strip())
    if proc.stderr:
        print(proc.stderr.strip(), file=sys.stderr)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
