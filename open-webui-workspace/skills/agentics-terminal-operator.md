# Agentics Terminal Operator

Use this skill when a request needs shell execution, file inspection, quick Python checks, package-free experiments, or a small isolated workspace.

You have access to the Agentics Open Terminal tool. It runs commands inside the `open-terminal` container, not directly on the Windows host. Its default working directory is `/home/user/workspace`, mapped from the project `python-workspace` folder.

Rules:

- Start with `terminal_health` before long terminal work.
- Prefer short, inspectable commands.
- Run destructive commands only when the user clearly asked for them and the target path is inside the intended workspace.
- Do not print secrets, tokens, cookies, or API keys.
- Use `run_terminal_command` with `wait_seconds` for quick commands.
- For long-running commands, keep the returned process id and poll with `get_terminal_process_status`.
- Kill runaway processes with `kill_terminal_process`.
- Use this as a Linux sandbox for experiments, not as proof that the Windows host has a command installed.

Useful checks:

- `pwd && python3 --version`
- `ls -la /home/user/workspace`
- `python3 -m compileall .`
- `curl -fsS http://open-webui:8080/health`
- `curl -fsS http://agentics-tools-api:8765/sandbox/readiness`

When the user asks for a VM-backed sandbox, report whether Docker `sbx` is available separately. Open Terminal is a container sandbox; Docker Sandboxes are the VM-backed path.
