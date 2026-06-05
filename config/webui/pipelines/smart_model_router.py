"""
Smart Model Router Pipeline for Open WebUI.

Routes requests to Docker Model Runner when the configured model is available,
then falls back to Ollama. Defaults match the models currently installed in
this local stack.
"""

from datetime import datetime
from typing import Generator
import json
import logging

import requests


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Pipeline:
    def __init__(self):
        self.name = "Smart Model Router"
        self.valves = {
            # Docker Model Runner is reachable from containers through this
            # Docker Desktop internal DNS name. host.docker.internal:50051 is
            # not reachable from the Open WebUI container on this setup.
            "dmr_enabled": True,
            "dmr_base_url": "http://model-runner.docker.internal/v1",
            "dmr_host": "model-runner.docker.internal",
            "dmr_port": "",

            # Ollama configuration.
            "ollama_enabled": True,
            "ollama_host": "ollama",
            "ollama_port": "11434",

            # Installed local models observed during triage.
            "coding_model_dmr": "docker.io/ai/llama3.2:latest",
            "coding_model_ollama": "llama3.2:3b",
            "general_model_dmr": "docker.io/ai/llama3.2:latest",
            "general_model_ollama": "llama3.2:3b",

            # Routing behavior.
            "prefer_dmr": True,
            "fallback_to_ollama": True,
            "emit_route_metadata": True,
            "timeout": 30,
            "healthcheck_timeout": 5,
            "max_tokens": 1000,
            "temperature": 0.7,
        }

    def get_task_type(self, user_message: str) -> str:
        """Classify the task based on message content."""
        message_lower = user_message.lower()

        coding_keywords = [
            "code", "function", "debug", "algorithm", "python", "javascript",
            "error", "bug", "syntax", "api", "sql", "json", "html", "css",
            "docker", "kubernetes", "deploy", "refactor", "optimize",
        ]
        analysis_keywords = [
            "analyze", "summary", "report", "data", "statistics", "trend",
            "chart", "graph", "comparison", "performance", "metrics",
        ]
        creative_keywords = [
            "write", "story", "poem", "creative", "brainstorm", "idea",
            "content", "marketing", "social",
        ]

        if any(keyword in message_lower for keyword in coding_keywords):
            return "coding"
        if any(keyword in message_lower for keyword in analysis_keywords):
            return "analysis"
        if any(keyword in message_lower for keyword in creative_keywords):
            return "creative"
        return "general"

    def get_dmr_endpoint(self) -> str:
        """Get the Docker Model Runner OpenAI-compatible endpoint."""
        base_url = str(self.valves.get("dmr_base_url", "")).strip().rstrip("/")
        if base_url:
            return base_url

        host = str(self.valves["dmr_host"]).strip()
        port = str(self.valves.get("dmr_port", "")).strip()
        if port:
            return f"http://{host}:{port}/v1"
        return f"http://{host}/v1"

    def get_ollama_endpoint(self) -> str:
        """Get the Ollama endpoint."""
        return f"http://{self.valves['ollama_host']}:{self.valves['ollama_port']}"

    def _task_model_matrix(self, task_type: str) -> dict:
        matrices = {
            "coding": {
                "preferred": {
                    "type": "dmr",
                    "model": self.valves["coding_model_dmr"],
                    "reason": "Local Docker Model Runner model selected for coding task",
                },
                "fallback": {
                    "type": "ollama",
                    "model": self.valves["coding_model_ollama"],
                    "reason": "Ollama fallback selected for coding task",
                },
            },
            "analysis": {
                "preferred": {
                    "type": "dmr",
                    "model": self.valves["general_model_dmr"],
                    "reason": "Local Docker Model Runner model selected for analysis task",
                },
                "fallback": {
                    "type": "ollama",
                    "model": self.valves["general_model_ollama"],
                    "reason": "Ollama fallback selected for analysis task",
                },
            },
            "creative": {
                "preferred": {
                    "type": "dmr",
                    "model": self.valves["general_model_dmr"],
                    "reason": "Local Docker Model Runner model selected for creative task",
                },
                "fallback": {
                    "type": "ollama",
                    "model": self.valves["general_model_ollama"],
                    "reason": "Ollama fallback selected for creative task",
                },
            },
            "general": {
                "preferred": {
                    "type": "dmr",
                    "model": self.valves["general_model_dmr"],
                    "reason": "Local Docker Model Runner model selected for general task",
                },
                "fallback": {
                    "type": "ollama",
                    "model": self.valves["general_model_ollama"],
                    "reason": "Ollama fallback selected for general task",
                },
            },
        }
        return matrices.get(task_type, matrices["general"])

    def _candidate_models(self, task_type: str) -> list[dict]:
        matrix = self._task_model_matrix(task_type)
        candidates = []

        if self.valves["prefer_dmr"] and self.valves["dmr_enabled"]:
            candidates.append(matrix["preferred"])
        if self.valves["fallback_to_ollama"] and self.valves["ollama_enabled"]:
            candidates.append(matrix["fallback"])
        if not candidates:
            candidates.append(matrix["preferred"])

        return candidates

    def _model_aliases(self, model_name: str) -> set[str]:
        aliases = {model_name}
        short_name = model_name.split("/")[-1]
        aliases.add(short_name)
        if ":" in short_name:
            aliases.add(short_name.split(":", 1)[0])
        return aliases

    def _model_matches(self, requested_model: str, available_models: set[str]) -> bool:
        requested_aliases = self._model_aliases(requested_model)
        available_aliases = set()
        for available_model in available_models:
            available_aliases.update(self._model_aliases(available_model))
        return bool(requested_aliases & available_aliases)

    def _list_dmr_models(self) -> set[str]:
        try:
            response = requests.get(
                f"{self.get_dmr_endpoint()}/models",
                timeout=self.valves["healthcheck_timeout"],
            )
            response.raise_for_status()
            data = response.json()
            return {
                item.get("id") or item.get("name")
                for item in data.get("data", [])
                if item.get("id") or item.get("name")
            }
        except Exception as exc:
            logger.warning("Could not list Docker Model Runner models: %s", exc)
            return set()

    def _list_ollama_models(self) -> set[str]:
        try:
            response = requests.get(
                f"{self.get_ollama_endpoint()}/api/tags",
                timeout=self.valves["healthcheck_timeout"],
            )
            response.raise_for_status()
            data = response.json()
            return {
                item.get("name") or item.get("model")
                for item in data.get("models", [])
                if item.get("name") or item.get("model")
            }
        except Exception as exc:
            logger.warning("Could not list Ollama models: %s", exc)
            return set()

    def _is_candidate_available(self, model_config: dict) -> bool:
        model_type = model_config["type"]
        model_name = model_config["model"]

        if model_type == "dmr":
            return self._model_matches(model_name, self._list_dmr_models())
        if model_type == "ollama":
            return self._model_matches(model_name, self._list_ollama_models())
        return False

    def select_model(self, task_type: str) -> dict:
        """Select the best available model for the task."""
        candidates = self._candidate_models(task_type)
        for candidate in candidates:
            if self._is_candidate_available(candidate):
                return candidate

        # If discovery fails for every provider, return the first candidate so
        # the user gets a concrete provider error instead of silence.
        return candidates[0]

    def query_model(self, model_config: dict, messages: list) -> Generator[str, None, None]:
        """Query the selected model."""
        model_type = model_config["type"]
        model_name = model_config["model"]
        reason = model_config["reason"]

        if self.valves["emit_route_metadata"]:
            yield f"\n[{model_type.upper()}: {model_name}]\n"
            yield f"[Reason: {reason}]\n"
            yield f"[Timestamp: {datetime.now().isoformat()}]\n\n"

        try:
            if model_type == "dmr":
                yield from self._query_dmr(model_name, messages)
            else:
                yield from self._query_ollama(model_name, messages)
        except Exception as exc:
            logger.error("Error querying %s model %s: %s", model_type, model_name, exc)
            yield f"\nError: could not query {model_type} model {model_name}: {exc}\n"

    def _query_dmr(self, model_name: str, messages: list) -> Generator[str, None, None]:
        """Query Docker Model Runner."""
        response = requests.post(
            f"{self.get_dmr_endpoint()}/chat/completions",
            json={
                "model": model_name,
                "messages": messages,
                "temperature": self.valves["temperature"],
                "max_tokens": self.valves["max_tokens"],
                "stream": True,
            },
            timeout=self.valves["timeout"],
            stream=True,
        )
        response.raise_for_status()

        for raw_line in response.iter_lines():
            if not raw_line:
                continue

            line = raw_line.decode("utf-8")
            if not line.startswith("data: "):
                continue

            payload = line[6:]
            if payload == "[DONE]":
                break

            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue

            choices = data.get("choices") or []
            if not choices:
                continue

            delta = choices[0].get("delta", {})
            content = delta.get("content")
            if content:
                yield content

    def _query_ollama(self, model_name: str, messages: list) -> Generator[str, None, None]:
        """Query Ollama."""
        prompt = "\n".join(
            f"{message.get('role', 'user')}: {message.get('content', '')}"
            for message in messages
        )

        response = requests.post(
            f"{self.get_ollama_endpoint()}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "temperature": self.valves["temperature"],
                "stream": True,
            },
            timeout=self.valves["timeout"],
            stream=True,
        )
        response.raise_for_status()

        for raw_line in response.iter_lines():
            if not raw_line:
                continue

            try:
                data = json.loads(raw_line)
            except json.JSONDecodeError:
                continue

            content = data.get("response")
            if content:
                yield content

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: list,
        body: dict,
    ) -> Generator[str, None, None]:
        """Open WebUI pipeline entrypoint."""
        task_type = self.get_task_type(user_message)
        model_config = self.select_model(task_type)
        safe_messages = messages or [{"role": "user", "content": user_message}]
        yield from self.query_model(model_config, safe_messages)
