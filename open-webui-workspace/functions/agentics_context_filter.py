"""
title: Agentics Context Filter
author: Agentics
version: 1.0.0
type: filter
required_open_webui_version: 0.6.0
"""


class Filter:
    def inlet(self, body: dict, __user__=None) -> dict:
        """Attach local Agentics context to chat metadata before model execution."""
        metadata = body.setdefault("metadata", {})
        metadata.setdefault(
            "agentics_stack",
            {
                "gateway": "http://agentics-gateway:8088",
                "mcp": "http://agentics-mcp:8766/mcp",
                "tools_api": "http://agentics-tools-api:8765",
                "n8n": "http://n8n:5678",
            },
        )
        return body

    def outlet(self, body: dict, __user__=None) -> dict:
        """Leave responses unchanged after adding request context in inlet."""
        return body
