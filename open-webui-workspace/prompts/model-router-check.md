Check why models may or may not appear in Open WebUI.

Verify:

- Ollama `/api/tags` from inside the stack.
- Docker Model Runner `/models` through the OpenAI-compatible endpoint.
- Open WebUI `/api/models`.
- `OPENAI_API_BASE_URLS`, `OPENAI_API_KEYS`, `OLLAMA_BASE_URL`, `DEFAULT_PINNED_MODELS`, and `DEFAULT_MODEL_PARAMS`.
- Whether native function calling is accidentally forced for providers that cannot parse tool calls.

Finish by listing the visible models and the exact fix if any provider is missing.
