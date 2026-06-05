#!/usr/bin/env python3
"""
Docker Model Runner - Simple Setup Check

Works from the Windows host by using Docker CLI model discovery.
"""

import json
import subprocess
import sys

import requests


def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")


def print_success(text):
    print(f"[OK] {text}")


def print_error(text):
    print(f"[FAIL] {text}")


def print_info(text):
    print(f"-> {text}")


def test_connection(url, name):
    """Test if a service is reachable."""
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        print_success(f"{name}: OK")
        return True
    except Exception as exc:
        print_error(f"{name}: {exc}")
        return False


def get_docker_model_runner_models():
    """Return local DMR models through Docker CLI."""
    try:
        result = subprocess.run(
            ["docker", "model", "ls", "--openai"],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout).get("data", [])
    except Exception as exc:
        print_error(f"Docker Model Runner model discovery failed: {exc}")
        return []


def main():
    print_header("Docker Model Runner - Setup Check")

    print_info("Checking Docker Model Runner...")
    models = get_docker_model_runner_models()
    if not models:
        print_error("No Docker Model Runner models found")
        print_info("Open Docker Desktop > Models and pull at least one model.")
        return 1

    print_success(f"Found {len(models)} Docker Model Runner model(s)")
    for model in models:
        print_info(f"  - {model.get('id', 'Unknown')}")

    print_header("Checking Services")
    services = [
        ("http://localhost:3000/api/health", "Open WebUI"),
        ("http://localhost:5678", "N8N"),
        ("http://localhost:11434/api/tags", "Ollama"),
    ]

    for url, name in services:
        test_connection(url, name)

    print_header("Next Steps")
    print_info("1. Open: http://localhost:3000")
    print_info("2. Start chatting; Smart Router will use available local models")
    print_info("3. Optional browser-use UI: docker compose -f docker-compose.browser-use.yml up -d")

    print_header("Setup Check Complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
