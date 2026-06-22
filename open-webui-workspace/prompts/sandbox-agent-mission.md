Plan this as a sandboxed agent mission.

Objective:

{{objective}}

Use this structure:

1. Decide whether Open Terminal is enough or whether Docker `sbx` VM-backed sandboxes are needed.
2. Check sandbox readiness through the Agentics tools API.
3. Split the mission into focused lanes: research, builder, reviewer, ops, and browser if needed.
4. Produce exact `sbx run` commands with branch names and memory caps.
5. Include the fallback Open Terminal command path if host `sbx` is unavailable.

Use `Balanced` policy unless the user asks for a different network policy.
