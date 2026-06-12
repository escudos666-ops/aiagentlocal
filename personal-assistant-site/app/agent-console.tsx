"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AgentMode = "auto" | "browse" | "research" | "task" | "memory" | "write" | "message";
type MessageRole = "user" | "assistant" | "system";

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

const modeLabels: Record<AgentMode, string> = {
  auto: "Auto",
  browse: "Browse",
  research: "Research",
  task: "Task",
  memory: "Memory",
  write: "Write",
  message: "Message",
};

const defaultStatus: AgentStatus = {
  routes: {
    paService: false,
    paWebhook: false,
    browserAgent: false,
    browserWebhook: false,
  },
  runs: [],
};

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

export default function AgentConsole({ displayName }: { displayName: string }) {
  const [status, setStatus] = useState<AgentStatus>(defaultStatus);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Tell me what you want done. Use Auto for normal PA routing, Browse or Research when you want me to go out on the web through your browser-use/n8n bridge.",
      route: "console",
    },
  ]);
  const [mode, setMode] = useState<AgentMode>("auto");
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);

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

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[#d9ded8] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Agent Command</h2>
            <p className="mt-1 text-sm leading-6 text-[#65706b]">
              Send your PA to your local agentics stack: PA service, n8n, task/memory agents, and browser-use.
            </p>
          </div>
          <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
            canBrowse ? "border-[#1d7f75] bg-[#edf8f5] text-[#0b4f49]" : "border-[#8a5a00] bg-[#fff8e6] text-[#6b4300]"
          }`}>
            {canBrowse ? "web ready" : "bridge needed"}
          </span>
        </div>
      </div>

      <div className="grid min-h-[560px] gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col border-b border-[#d9ded8] xl:border-b-0 xl:border-r">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[92%] rounded-lg border p-4 ${
                    message.role === "user"
                      ? "ml-auto border-[#1d7f75] bg-[#edf8f5]"
                      : "border-[#d9ded8] bg-[#fbfcfb]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-[#53605a]">
                      {message.role === "user" ? displayName : "PA agent"}
                    </span>
                    {message.route ? (
                      <span className="rounded-md border border-[#cdd6d1] px-2 py-0.5 text-xs text-[#53605a]">
                        {message.route}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#25302b]">{message.text}</p>
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

          <form onSubmit={submitAgentTask} className="border-t border-[#d9ded8] p-4">
            <div className="grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)_120px]">
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as AgentMode)}
                className="h-11 rounded-md border border-[#cdd6d1] bg-white px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
              >
                {(Object.keys(modeLabels) as AgentMode[]).map((value) => (
                  <option key={value} value={value}>
                    {modeLabels[value]}
                  </option>
                ))}
              </select>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: browse the web and find the best current GitHub Copilot CLI install docs"
                className="min-h-24 resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
              />
              <button
                type="submit"
                disabled={isRunning || !prompt.trim()}
                className="h-11 rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e] disabled:bg-[#aab3ae] lg:self-end"
              >
                {isRunning ? "Running" : "Send"}
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4 p-5">
          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">Connected Routes</h3>
            <p className="mt-3 text-sm leading-6 text-[#53605a]">{routeSummary}</p>
            {status.error ? <p className="mt-2 text-sm leading-6 text-[#785b13]">{status.error}</p> : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">How To Send Him Out</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm leading-6 text-[#53605a]">
              <p>Use Browse for one website or one concrete web task.</p>
              <p>Use Research for wider web work with a summarized answer.</p>
              <p>Use Auto when you want the PA service to decide which sub-agent handles it.</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase text-[#53605a]">Recent Runs</h3>
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
