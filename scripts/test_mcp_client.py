import asyncio
import json
import sys

from open_webui.utils.mcp.client import MCPClient


async def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else "http://agentics-mcp:8766/mcp"
    client = MCPClient()
    await client.connect(url)
    try:
        specs = await client.list_tool_specs()
        print(json.dumps(specs, indent=2))
    finally:
        await client.disconnect()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))