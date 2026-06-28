"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AgentMode = "auto" | "browse" | "research" | "task" | "memory" | "write" | "message";
type MessageRole = "user" | "assistant" | "system";
type SandboxPolicy = "Open" | "Balanced" | "Locked";
type SubagentId = "research" | "builder" | "reviewer" | "ops" | "browser";
type SandboxRunStatus = "staged" | "running" | "review";

type AgentSource = {
  title?: string;
  url: string;
};

type AgentRun = {
  id: number;
  requestText: string;
  intent: string;
  route: string;
  status: "completed" | "failed" | "needs_confirmation";
  responseText: string;
  sources: AgentSource[];
  createdAt: string;
};

type AgentStatus = {
  routes: {
    paService: boolean;
    paWebhook: boolean;
    browserAgent: boolean;
    browserWebhook: boolean;
  };
  runs: AgentRun[];
  error?: string;
};

type AgentMessage = {
  id: string;
  role: MessageRole;
  text: string;
  route?: string;
  sources?: AgentSource[];
  status?: AgentRun["status"];
};

type SubagentDefinition = {
  id: SubagentId;
  name: string;
  role: string;
  agent: "codex" | "shell";
  status: "ready" | "watch" | "review";
  accentClass: string;
  defaultObjective: string;
  tools: string[];
};

type SandboxRun = {
  id: string;
  subagentId: SubagentId;
  subagentName: string;
  objective: string;
  branch: string;
  command: string;
  policy: SandboxPolicy;
  memory: string;
  status: SandboxRunStatus;
  createdAt: string;
};

type OpenAiResponseState = {
  status: "idle" | "running" | "completed" | "failed";
  outputText: string;
  error: string;
  missing: string[];
};

type OpenAiResponsePayload = {
  outputText?: string;
  error?: string;
  missing?: unknown;
};

const modeLabels: Record<AgentMode, string> = {
  auto: "Auto",
  browse: "Browse",
  research: "Research",
  task: "Task",
  memory: "Memory",
  write: "Write",
  message: "Message",
};

const policyNotes: Record<SandboxPolicy, string> = {
  Open: "All network traffic allowed for development work.",
  Balanced: "Dev services, registries, and AI providers allowed.",
  Locked: "Network blocked unless policy exceptions are configured.",
};

const subagents: SubagentDefinition[] = [
  {
    id: "research",
    name: "Research",
    role: "Maps sources, docs, and implementation options.",
    agent: "codex",
    status: "ready",
    accentClass: "border-l-[#325d8c]",
    defaultObjective: "Gather the current facts and constraints before implementation.",
    tools: ["web", "docs", "notes"],
  },
  {
    id: "builder",
    name: "Builder",
    role: "Implements the smallest coherent change set.",
    agent: "codex",
    status: "ready",
    accentClass: "border-l-[#1d7f75]",
    defaultObjective: "Build the requested change in an isolated worktree.",
    tools: ["repo", "tests", "compose"],
  },
  {
    id: "reviewer",
    name: "Reviewer",
    role: "Checks diffs, risks, and missing validation.",
    agent: "codex",
    status: "review",
    accentClass: "border-l-[#8b315d]",
    defaultObjective: "Review the implementation and identify regressions.",
    tools: ["git", "tests", "security"],
  },
  {
    id: "ops",
    name: "Ops",
    role: "Validates containers, health checks, and rollback paths.",
    agent: "codex",
    status: "watch",
    accentClass: "border-l-[#8a5a00]",
    defaultObjective: "Verify Docker stack readiness and deployment commands.",
    tools: ["docker", "logs", "health"],
  },
  {
    id: "browser",
    name: "Browser",
    role: "Exercises UI flows and browser automation tasks.",
    agent: "codex",
    status: "ready",
    accentClass: "border-l-[#5b6b87]",
    defaultObjective: "Run the user-facing browser checks for the dashboard.",
    tools: ["playwright", "browser", "screens"],
  },
];

const defaultStatus: AgentStatus = {
  routes: {
    paService: false,
    paWebhook: false,
    browserAgent: false,
    browserWebhook: false,
  },
  runs: [],
};

const defaultObjective =
  "Improve the Agentics personal assistant dashboard and verify the sandboxed subagent workflow.";

function messageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function summarizeRoutes(status: AgentStatus) {
  const connected = [
    status.routes.paService ? "PA service" : null,
    status.routes.paWebhook ? "PA webhook" : null,
    status.routes.browserAgent ? "Browser agent" : null,
    status.routes.browserWebhook ? "Browser webhook" : null,
  ].filter(Boolean);

  return connected.length ? connected.join(", ") : "No external agent routes configured";
}

function sanitizeBranchSegment(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return cleaned || "agentics-mission";
}

function branchForSubagent(baseBranch: string, subagent: SubagentDefinition) {
  return `${sanitizeBranchSegment(baseBranch)}-${subagent.id}`;
}

function sandboxCommand(subagent: SubagentDefinition, branch: string, memory: string) {
  return `sbx run ${subagent.agent} --branch ${branch} --memory ${memory}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusTone(status: SubagentDefinition["status"] | SandboxRunStatus) {
  if (status === "ready" || status === "staged") {
    return "border-[#b8ddd6] bg-[#f4fbf9] text-[#0b4f49]";
  }

  if (status === "running") {
    return "border-[#95b7dc] bg-[#f4f8fd] text-[#27496d]";
  }

  if (status === "review") {
    return "border-[#e6bfd1] bg-[#fff5fa] text-[#7a214c]";
  }

  return "border-[#e8c27d] bg-[#fff8e8] text-[#6b4300]";
}

async function readOpenAiPayload(response: Response): Promise<OpenAiResponsePayload> {
  const text = await response.text();

  if (!text.trim()) {
    return response.ok
      ? {}
      : { error: `OpenAI route returned HTTP ${response.status} without a response body.` };
  }

  try {
    return JSON.parse(text) as OpenAiResponsePayload;
  } catch {
    return {
      error: `OpenAI route returned non-JSON HTTP ${response.status}: ${text.slice(0, 220)}`,
    };
  }
}

export default function AgentConsole({ displayName }: { displayName: string }) {
  const [status, setStatus] = useState<AgentStatus>(defaultStatus);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Give me the objective, then decide whether it should route through the PA stack or fan out as sandboxed subagents.",
      route: "console",
    },
  ]);
  const [mode, setMode] = useState<AgentMode>("auto");
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [objective, setObjective] = useState(defaultObjective);
  const [branchName, setBranchName] = useState("agentics-dashboard");
  const [sandboxPolicy, setSandboxPolicy] = useState<SandboxPolicy>("Balanced");
  const [memoryLimit, setMemoryLimit] = useState("4GB");
  const [selectedSubagents, setSelectedSubagents] = useState<SubagentId[]>([
    "research",
    "builder",
    "reviewer",
    "ops",
  ]);
  const [sandboxRuns, setSandboxRuns] = useState<SandboxRun[]>([]);
  const [copiedCommand, setCopiedCommand] = useState("");
  const [openAiPrompt, setOpenAiPrompt] = useState("");
  const [openAiSeed, setOpenAiSeed] = useState("{{dockerdesktop}}");
  const [openAiModel, setOpenAiModel] = useState("gpt-5.4-mini");
  const [openAiResponse, setOpenAiResponse] = useState<OpenAiResponseState>({
    status: "idle",
    outputText: "",
    error: "",
    missing: [],
  });

  useEffect(() => {
    let ignore = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/agent", { cache: "no-store" });
        const payload = (await response.json()) as AgentStatus;
        if (!ignore) {
          setStatus(payload);
        }
      } catch {
        if (!ignore) {
          setStatus({
            ...defaultStatus,
            error: "Agent status is unavailable in this preview.",
          });
        }
      }
    }

    void loadStatus();
    return () => {
      ignore = true;
    };
  }, []);

  const routeSummary = useMemo(() => summarizeRoutes(status), [status]);
  const canBrowse = status.routes.browserAgent || status.routes.browserWebhook;
  const selectedDefinitions = useMemo(
    () => subagents.filter((subagent) => selectedSubagents.includes(subagent.id)),
    [selectedSubagents]
  );
  const preparedCommands = useMemo(
    () =>
      selectedDefinitions.map((subagent) => {
        const branch = branchForSubagent(branchName, subagent);
        return {
          subagent,
          branch,
          command: sandboxCommand(subagent, branch, memoryLimit),
        };
      }),
    [branchName, memoryLimit, selectedDefinitions]
  );
  const allCommands = preparedCommands.map((item) => item.command).join("\n");

  function toggleSubagent(id: SubagentId) {
    setSelectedSubagents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function copyCommand(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(text);
      window.setTimeout(() => setCopiedCommand(""), 1800);
    } catch {
      setCopiedCommand("copy-failed");
      window.setTimeout(() => setCopiedCommand(""), 1800);
    }
  }

  function launchSandboxSubagents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedObjective = objective.trim();

    if (!trimmedObjective || !preparedCommands.length) {
      return;
    }

    const createdAt = new Date().toISOString();
    const stagedRuns = preparedCommands.map<SandboxRun>((item) => ({
      id: `${createdAt}-${item.subagent.id}`,
      subagentId: item.subagent.id,
      subagentName: item.subagent.name,
      objective: `${item.subagent.defaultObjective} ${trimmedObjective}`,
      branch: item.branch,
      command: item.command,
      policy: sandboxPolicy,
      memory: memoryLimit,
      status: "staged",
      createdAt,
    }));

    setSandboxRuns((current) => [...stagedRuns, ...current].slice(0, 12));
    setMessages((current) => [
      ...current,
      {
        id: messageId(),
        role: "system",
        text: `Staged ${stagedRuns.length} sandboxed subagent ${stagedRuns.length === 1 ? "run" : "runs"} with ${sandboxPolicy} policy and ${memoryLimit} memory caps.`,
        route: "sandbox-orchestrator",
      },
    ]);
  }

  async function submitAgentTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();

    if (!text || isRunning) {
      return;
    }

    const userMessage: AgentMessage = {
      id: messageId(),
      role: "user",
      text,
      route: modeLabels[mode],
    };

    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The PA agent could not complete that run.");
      }

      const assistantMessage: AgentMessage = {
        id: messageId(),
        role: "assistant",
        text: payload.responseText,
        route: payload.route,
        sources: payload.sources,
        status: payload.status,
      };

      setMessages((current) => [...current, assistantMessage]);
      setStatus((current) => ({
        ...current,
        runs: payload.run ? [payload.run, ...current.runs].slice(0, 8) : current.runs,
      }));
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: error instanceof Error ? error.message : "The PA agent run failed.",
          route: "error",
          status: "failed",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  async function submitOpenAiResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (openAiResponse.status === "running") {
      return;
    }

    setOpenAiResponse({
      status: "running",
      outputText: "",
      error: "",
      missing: [],
    });

    try {
      const response = await fetch("/api/openai-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: openAiPrompt,
          assistantSeed: openAiSeed,
          model: openAiModel,
          allowedTools: [],
        }),
      });
      const payload = await readOpenAiPayload(response);

      if (!response.ok) {
        setOpenAiResponse({
          status: "failed",
          outputText: "",
          error: payload.error ?? "OpenAI request failed.",
          missing: Array.isArray(payload.missing) ? payload.missing : [],
        });
        return;
      }

      setOpenAiResponse({
        status: "completed",
        outputText: payload.outputText || "The response completed without output text.",
        error: "",
        missing: [],
      });
    } catch (error) {
      setOpenAiResponse({
        status: "failed",
        outputText: "",
        error: error instanceof Error ? error.message : "OpenAI request failed.",
        missing: [],
      });
    }
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="border-b border-[#d9ded8] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Agent Orchestrator</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#65706b]">
              Route simple work to the PA stack, or split larger objectives into isolated Docker
              Sandbox subagent worktrees.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="Subagents" value={subagents.length} />
            <MiniMetric label="Selected" value={selectedDefinitions.length} />
            <MiniMetric label="Staged" value={sandboxRuns.length} />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-0 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 border-b border-[#d9ded8] 2xl:border-b-0 2xl:border-r">
          <form onSubmit={launchSandboxSubagents} className="border-b border-[#eef2ef] p-5">
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_270px]">
              <div className="min-w-0">
                <label className="text-sm font-semibold text-[#25302b]" htmlFor="sandbox-objective">
                  Mission objective
                </label>
                <textarea
                  id="sandbox-objective"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm leading-6 outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
                <label className="min-w-0 text-sm font-semibold text-[#25302b]">
                  Branch
                  <input
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                  />
                </label>
                <label className="min-w-0 text-sm font-semibold text-[#25302b]">
                  Policy
                  <select
                    value={sandboxPolicy}
                    onChange={(event) => setSandboxPolicy(event.target.value as SandboxPolicy)}
                    className="mt-2 h-11 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                  >
                    {(Object.keys(policyNotes) as SandboxPolicy[]).map((policy) => (
                      <option key={policy} value={policy}>
                        {policy}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-semibold text-[#25302b]">
                  Memory
                  <select
                    value={memoryLimit}
                    onChange={(event) => setMemoryLimit(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                  >
                    {["2GB", "4GB", "6GB", "8GB", "50%"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm leading-6 text-[#53605a]">{policyNotes[sandboxPolicy]}</p>
              <button
                type="submit"
                disabled={!objective.trim() || !selectedDefinitions.length}
                className="h-11 rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e] disabled:bg-[#aab3ae]"
              >
                Launch Sandboxed Subagents
              </button>
            </div>
          </form>

          <section className="border-b border-[#eef2ef] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Subagent Lanes</h3>
                <p className="mt-1 text-sm text-[#65706b]">
                  Each selected lane gets its own branch-mode sandbox command.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyCommand(allCommands)}
                disabled={!allCommands}
                className="h-10 rounded-md border border-[#cdd6d1] px-3 text-sm font-semibold text-[#36403b] hover:bg-[#eef2ef] disabled:text-[#8b9690]"
              >
                {copiedCommand === allCommands ? "Copied" : "Copy Commands"}
              </button>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 2xl:grid-cols-2">
              {subagents.map((subagent) => {
                const selected = selectedSubagents.includes(subagent.id);
                const branch = branchForSubagent(branchName, subagent);
                const command = sandboxCommand(subagent, branch, memoryLimit);

                return (
                  <article
                    key={subagent.id}
                    className={`min-w-0 border-l-4 p-4 ${subagent.accentClass} ${
                      selected ? "bg-[#fbfcfb]" : "bg-white opacity-70"
                    } border-b border-r border-t border-[#d9ded8]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold">{subagent.name}</h4>
                        <p className="mt-1 text-sm leading-6 text-[#53605a]">{subagent.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSubagent(subagent.id)}
                        className={`h-8 rounded-md px-3 text-xs font-semibold ${
                          selected
                            ? "bg-[#171918] text-white"
                            : "border border-[#cdd6d1] text-[#36403b] hover:bg-[#eef2ef]"
                        }`}
                      >
                        {selected ? "On" : "Off"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase ${statusTone(subagent.status)}`}>
                        {subagent.status}
                      </span>
                      {subagent.tools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-md border border-[#d9ded8] bg-white px-2 py-1 text-xs text-[#53605a]"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>

                    <pre className="mt-3 max-w-full whitespace-pre-wrap break-words rounded-md border border-[#d9ded8] bg-white p-3 text-xs leading-5 text-[#25302b]">
                      {command}
                    </pre>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid min-w-0 gap-0 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 border-b border-[#eef2ef] p-5 2xl:border-b-0 2xl:border-r">
              <h3 className="text-lg font-semibold">Tell the assistant what to do</h3>
              <p className="mt-1 text-sm text-[#65706b]">
                Type one focused request. The assistant will route it to PA, browser, writing, memory, or messaging tools.
              </p>

              <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`rounded-md border p-3 ${
                        message.role === "user"
                          ? "ml-auto max-w-[92%] border-[#1d7f75] bg-[#edf8f5]"
                          : message.role === "system"
                            ? "border-[#e8c27d] bg-[#fff8e8]"
                            : "border-[#d9ded8] bg-[#fbfcfb]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-[#53605a]">
                          {message.role === "user"
                            ? displayName
                            : message.role === "system"
                              ? "orchestrator"
                              : "PA agent"}
                        </span>
                        {message.route ? (
                          <span className="rounded-md border border-[#cdd6d1] px-2 py-0.5 text-xs text-[#53605a]">
                            {message.route}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#25302b]">{message.text}</p>
                      {message.sources?.length ? (
                        <div className="mt-3 flex flex-col gap-1 border-t border-[#d9ded8] pt-3">
                          {message.sources.map((source) => (
                            <a
                              key={source.url}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words text-sm font-medium text-[#0b5f58] underline"
                            >
                              {source.title || source.url}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>

              <form onSubmit={submitAgentTask} className="mt-5">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask the PA agent to handle one focused task"
                    className="min-h-28 w-full resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm leading-6 outline-none transition focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="flex w-full flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[#53605a] sm:w-48">
                      Mode
                      <select
                        value={mode}
                        onChange={(event) => setMode(event.target.value as AgentMode)}
                        className="h-11 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm normal-case outline-none transition focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                      >
                        {(Object.keys(modeLabels) as AgentMode[]).map((value) => (
                          <option key={value} value={value}>
                            {modeLabels[value]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="submit"
                      disabled={isRunning || !prompt.trim()}
                      className="h-11 w-full rounded-md bg-[#1d7f75] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14665e] disabled:cursor-not-allowed disabled:bg-[#aab3ae] disabled:shadow-none disabled:hover:bg-[#aab3ae] sm:w-36"
                    >
                      {isRunning ? "Running" : "Send"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="min-w-0 p-5">
              <h3 className="font-semibold">Activity Log</h3>
              <div className="mt-4 flex flex-col gap-3">
                {sandboxRuns.length ? (
                  sandboxRuns.map((run) => (
                    <article key={run.id} className="border-b border-[#eef2ef] pb-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{run.subagentName}</p>
                          <p className="mt-1 text-xs uppercase text-[#65706b]">
                            {formatTime(run.createdAt)} - {run.policy} - {run.memory}
                          </p>
                        </div>
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase ${statusTone(run.status)}`}>
                          {run.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#53605a]">{run.objective}</p>
                      <button
                        type="button"
                        onClick={() => copyCommand(run.command)}
                        className="mt-2 rounded-md border border-[#cdd6d1] px-2 py-1 text-xs font-semibold text-[#36403b] hover:bg-[#eef2ef]"
                      >
                        {copiedCommand === run.command ? "Copied" : run.branch}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-[#cdd6d1] p-3 text-sm leading-6 text-[#65706b]">
                    Sandboxed subagent launches will appear here.
                  </p>
                )}
              </div>
            </div>
          </section>
        </section>

        <aside className="flex min-w-0 flex-col gap-5 p-5">
          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase text-[#53605a]">Connected Routes</h3>
                <p className="mt-3 text-sm leading-6 text-[#53605a]">{routeSummary}</p>
              </div>
              <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
                canBrowse ? "border-[#1d7f75] bg-[#edf8f5] text-[#0b4f49]" : "border-[#8a5a00] bg-[#fff8e6] text-[#6b4300]"
              }`}>
                {canBrowse ? "web ready" : "bridge needed"}
              </span>
            </div>
            {status.error ? <p className="mt-2 text-sm leading-6 text-[#785b13]">{status.error}</p> : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">Sandbox Readiness</h3>
            <div className="mt-3 flex flex-col gap-2">
              <ReadinessRow label="Isolation" value="branch worktree" ok />
              <ReadinessRow label="Policy" value={sandboxPolicy} ok={sandboxPolicy !== "Open"} />
              <ReadinessRow label="Memory cap" value={memoryLimit} ok />
              <ReadinessRow label="Host CLI" value="sbx ls" ok={false} />
            </div>
            <div className="mt-3 rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3">
              <p className="text-xs font-semibold uppercase text-[#53605a]">Policy setup</p>
              <pre className="mt-2 max-w-full whitespace-pre-wrap break-words text-xs leading-5 text-[#25302b]">sbx policy reset</pre>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">Command Preview</h3>
            <pre className="mt-3 max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3 text-xs leading-5 text-[#25302b]">
              {allCommands || "Select at least one subagent."}
            </pre>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">OpenAI MCP Response</h3>
            <form onSubmit={submitOpenAiResponse} className="mt-3 flex flex-col gap-3">
              <label className="block text-sm font-semibold text-[#25302b]">
                Model
                <input
                  value={openAiModel}
                  onChange={(event) => setOpenAiModel(event.target.value)}
                  className="mt-2 block h-10 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
              </label>
              <label className="block text-sm font-semibold text-[#25302b]">
                User input
                <textarea
                  value={openAiPrompt}
                  onChange={(event) => setOpenAiPrompt(event.target.value)}
                  placeholder="Optional input text for the Responses request"
                  className="mt-2 block min-h-20 w-full resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
              </label>
              <label className="block text-sm font-semibold text-[#25302b]">
                Assistant seed
                <input
                  value={openAiSeed}
                  onChange={(event) => setOpenAiSeed(event.target.value)}
                  className="mt-2 block h-10 w-full rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
              </label>
              <button
                type="submit"
                disabled={openAiResponse.status === "running" || !openAiModel.trim()}
                className="h-10 rounded-md bg-[#171918] px-4 text-sm font-semibold text-white hover:bg-[#2d332f] disabled:bg-[#aab3ae]"
              >
                {openAiResponse.status === "running" ? "Running" : "Run Response"}
              </button>
            </form>

            {openAiResponse.status === "failed" ? (
              <div className="mt-3 rounded-md border border-[#e8c27d] bg-[#fff8e8] p-3 text-sm leading-6 text-[#6b4300]">
                <p>{openAiResponse.error}</p>
                {openAiResponse.missing.length ? (
                  <p className="mt-2 text-xs">
                    Configure these env vars in the site runtime: {openAiResponse.missing.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {openAiResponse.status === "completed" ? (
              <pre className="mt-3 max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3 text-xs leading-5 text-[#25302b]">
                {openAiResponse.outputText}
              </pre>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">Recent PA Runs</h3>
            <div className="mt-3 flex flex-col gap-3">
              {status.runs.length ? (
                status.runs.map((run) => (
                  <div key={run.id} className="border-b border-[#eef2ef] pb-3 last:border-b-0">
                    <p className="line-clamp-2 text-sm font-semibold">{run.requestText}</p>
                    <p className="mt-1 text-xs uppercase text-[#65706b]">
                      {run.intent} via {run.route}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#cdd6d1] p-3 text-sm leading-6 text-[#65706b]">
                  Agent runs will appear here.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#d9ded8] bg-[#fbfcfb] px-3 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#65706b]">{label}</p>
    </div>
  );
}

function ReadinessRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#d9ded8] bg-[#fbfcfb] px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 truncate text-xs text-[#65706b]">{value}</p>
      </div>
      <span className={`h-3 w-3 shrink-0 rounded-full ${ok ? "bg-[#1d7f75]" : "bg-[#b7791f]"}`} />
    </div>
  );
}
