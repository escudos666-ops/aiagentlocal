#!/usr/bin/env python3
"""
Docker Model Runner integration helper for Open WebUI.

The Docker Model Runner HTTP endpoint is reachable from containers at
http://model-runner.docker.internal/v1 on this Docker Desktop setup. The host
does not necessarily resolve that name, so this script falls back to the Docker
CLI for host-side model discovery.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

import requests


DMR_API_BASE = os.getenv("DMR_API_BASE", "http://model-runner.docker.internal/v1").rstrip("/")
OPENWEBUI_HOST = os.getenv("OPENWEBUI_HOST", "localhost")
OPENWEBUI_PORT = os.getenv("OPENWEBUI_PORT", "3000")
OPENWEBUI_API = f"http://{OPENWEBUI_HOST}:{OPENWEBUI_PORT}/api"


class DockerModelRunnerIntegration:
    """Report Docker Model Runner availability and Open WebUI provider config."""

    def __init__(self) -> None:
        self.dmr_base = DMR_API_BASE
        self.openwebui_base = OPENWEBUI_API
        self.models_cache: list[dict[str, Any]] = []

    def get_dmr_models(self) -> list[dict[str, Any]]:
        """Fetch available models from DMR HTTP or Docker CLI."""
        models = self._get_models_from_http()
        if not models:
            models = self._get_models_from_docker_cli()
        self.models_cache = models
        return models

    def _get_models_from_http(self) -> list[dict[str, Any]]:
        try:
            response = requests.get(f"{self.dmr_base}/models", timeout=5)
            response.raise_for_status()
            return response.json().get("data", [])
        except Exception as exc:
            print(f"HTTP model discovery unavailable at {self.dmr_base}: {exc}")
            return []

    def _get_models_from_docker_cli(self) -> list[dict[str, Any]]:
        try:
            result = subprocess.run(
                ["docker", "model", "ls", "--openai"],
                check=True,
                capture_output=True,
                text=True,
            )
            return json.loads(result.stdout).get("data", [])
        except Exception as exc:
            print(f"Docker CLI model discovery unavailable: {exc}")
            return []

    def register_dmr_models_in_openwebui(self) -> bool:
        """Print provider config to add in Open WebUI."""
        models = self.get_dmr_models()
        if not models:
            print("No Docker Model Runner models found.")
            return False

        model_names = [model.get("id") or model.get("name") for model in models]
        model_names = [name for name in model_names if name]
        print(f"Found {len(model_names)} Docker Model Runner model(s): {model_names}")

        provider_config = {
            "name": "Docker Model Runner",
            "provider": "openai",
            "api_base": self.dmr_base,
            "api_key": "local",
            "models": model_names,
            "enabled": True,
        }

        print("\nOpen WebUI provider configuration:")
        print(json.dumps(provider_config, indent=2))
        print("\nAdd this in Open WebUI admin settings if the provider is not already configured.")
        return True

    def test_dmr_connection(self) -> bool:
        """Confirm DMR has at least one discoverable model."""
        models = self.get_dmr_models()
        if models:
            print(f"Docker Model Runner is available with {len(models)} model(s).")
            return True

        print("Docker Model Runner is running no discoverable models, or Docker CLI is unavailable.")
        return False

    def generate_openwebui_env_vars(self) -> str:
        """Generate environment variables for Open WebUI docker-compose."""
        return f"""
# Docker Model Runner Integration
DMR_ENABLED=true
DMR_API_BASE={self.dmr_base}

# Multi-model routing
OPENWEBUI_MULTI_MODEL_SUPPORT=true
OPENWEBUI_MODEL_ROUTER=smart
"""

    def test_inference(self, model_name: str, prompt: str = "Hello") -> bool:
        """Test inference through the HTTP endpoint when reachable."""
        try:
            response = requests.post(
                f"{self.dmr_base}/chat/completions",
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 100,
                    "temperature": 0.7,
                },
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            print("Inference through DMR HTTP succeeded.")
            print(f"Response: {content[:160]}")
            return True
        except Exception as exc:
            print(f"Skipping HTTP inference test; endpoint is not reachable from this process: {exc}")
            return False


def main() -> int:
    print("=" * 60)
    print("Docker Model Runner Integration for Open WebUI")
    print("=" * 60)

    integration = DockerModelRunnerIntegration()

    print("\nStep 1: Discovering Docker Model Runner models...")
    if not integration.test_dmr_connection():
        return 1

    models = integration.models_cache
    first_model = models[0].get("id") or models[0].get("name")
    if first_model:
        print("\nStep 2: Testing HTTP inference when available...")
        integration.test_inference(first_model, "Say 'Hello from Docker Model Runner'")

    print("\nStep 3: Open WebUI environment values:")
    print(integration.generate_openwebui_env_vars())

    print("\nStep 4: Provider configuration:")
    integration.register_dmr_models_in_openwebui()

    print("\nIntegration check complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
