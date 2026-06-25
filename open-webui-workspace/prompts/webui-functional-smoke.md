Run a functional Open WebUI smoke test.

Do not stop at health checks. Confirm:

- WebUI loads at `http://ai.localhost`.
- The model picker shows Ollama models and Docker Model Runner models.
- One Ollama chat returns a normal response.
- One Docker Model Runner chat returns a normal response.
- Tools, MCP, functions, and skills are visible.
- Browser console has no unexpected runtime errors.

If a failure appears, fix the stack and repeat the smoke test.
