"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AgentConsole from "./agent-console";

type Priority = "high" | "medium" | "low";
type TaskStatus = "open" | "done";
type NoteKind = "decision" | "idea" | "reference" | "general";
type AgendaTone = "deep" | "admin" | "meeting" | "personal";

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  project: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Note = {
  id: number;
  title: string;
  body: string;
  kind: NoteKind;
  createdAt: string;
  updatedAt: string;
};

type AgendaBlock = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  tone: AgendaTone;
  createdAt: string;
};

type Capture = {
  id: number;
  rawText: string;
  interpretedAs: "task" | "note" | "agenda";
  createdAt: string;
};

type AssistantState = {
  tasks: Task[];
  notes: Note[];
  agendaBlocks: AgendaBlock[];
  captures: Capture[];
  persistence: "d1" | "demo";
  error?: string;
};

type StackStatus = "online" | "degraded" | "offline";

type RawStackService = {
  ok?: boolean;
  status?: number;
  code?: number;
  error?: string;
  url?: string;
  host?: string;
  port?: number;
  durationMs?: number;
};

type RawStackPayload = {
  services?: Record<string, RawStackService>;
  source?: string;
  error?: string;
  checkedAt?: string;
};

type StackServiceDefinition = {
  id: string;
  name: string;
  role: string;
  groupKey: string;
  group: string;
  publicUrl?: string;
  action: string;
};

type StackService = StackServiceDefinition & {
  ok: boolean;
  status: StackStatus;
  detail: string;
  sourceUrl?: string;
};

type StackFunctionDefinition = {
  id: string;
  name: string;
  description: string;
  serviceId: string;
  publicUrl: string;
  action: string;
};

type StackState = {
  services: StackService[];
  online: number;
  degraded: number;
  offline: number;
  checkedAt: string;
  source: "browser-bridge" | "container-proxy";
  error?: string;
};

type Props = {
  displayName: string;
  email: string | null;
};

const emptyState: AssistantState = {
  tasks: [],
  notes: [],
  agendaBlocks: [],
  captures: [],
  persistence: "d1",
};

const sampleState: AssistantState = {
  tasks: [
    {
      id: -1,
      title: "Capture the next thing you want off your mind",
      status: "open",
      priority: "high",
      project: "Today",
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: -2,
      title: "Review open loops before your next focus block",
      status: "open",
      priority: "medium",
      project: "Routine",
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: [
    {
      id: -1,
      title: "Assistant rhythm",
      body: "Use the capture bar for tasks, notes, reminders, and schedule blocks. The deployed site stores them in D1.",
      kind: "reference",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  agendaBlocks: [
    {
      id: -1,
      label: "Deep work",
      startTime: "09:00",
      endTime: "10:30",
      tone: "deep",
      createdAt: new Date().toISOString(),
    },
    {
      id: -2,
      label: "Admin sweep",
      startTime: "14:00",
      endTime: "14:30",
      tone: "admin",
      createdAt: new Date().toISOString(),
    },
  ],
  captures: [],
  persistence: "demo",
};

const hostedAssistantUrl = "https://mjhee-personal-assistant.admetec-nl-8738.chatgpt-team.site";
const localStackBridgeUrl =
  process.env.NEXT_PUBLIC_AGENTICS_TOOLS_API_PUBLIC_URL ?? "http://127.0.0.1:8765";

const stackServiceDefinitions: StackServiceDefinition[] = [
  {
    id: "open_webui",
    name: "Open WebUI",
    role: "Chat workspace and model front door",
    groupKey: "assistant",
    group: "Assistant Core",
    publicUrl: "http://localhost:3000",
    action: "Open",
  },
  {
    id: "ollama",
    name: "Ollama",
    role: "Local model runtime",
    groupKey: "assistant",
    group: "Assistant Core",
    publicUrl: "http://localhost:11434/api/tags",
    action: "API",
  },
  {
    id: "agentics_mcp",
    name: "Agentics MCP",
    role: "Local assistant tools and automations",
    groupKey: "assistant",
    group: "Assistant Core",
    publicUrl: "http://localhost:8766/health",
    action: "Health",
  },
  {
    id: "agentics_tools_api",
    name: "Agentics Tools API",
    role: "Browser bridge for stack status",
    groupKey: "assistant",
    group: "Assistant Core",
    publicUrl: "http://localhost:8765/services",
    action: "Services",
  },
  {
    id: "n8n",
    name: "n8n",
    role: "Workflow automation",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:5678",
    action: "Open",
  },
  {
    id: "waha",
    name: "WAHA",
    role: "WhatsApp assistant bridge",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:3001",
    action: "Open",
  },
  {
    id: "browser_use",
    name: "Browser Use",
    role: "Browser automation workspace",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:7788",
    action: "Open",
  },
  {
    id: "browser_use_vnc",
    name: "Browser VNC",
    role: "Visual browser session",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:6080",
    action: "View",
  },
  {
    id: "playwright",
    name: "Playwright",
    role: "Browser test service",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:3010",
    action: "WS",
  },
  {
    id: "open_terminal",
    name: "Open Terminal",
    role: "Sandboxed workspace terminal",
    groupKey: "automation",
    group: "Automation",
    publicUrl: "http://localhost:8000",
    action: "Open",
  },
  {
    id: "postgraphile",
    name: "GraphQL",
    role: "Postgres GraphQL API",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:5000/graphql",
    action: "GraphQL",
  },
  {
    id: "postgres",
    name: "Postgres",
    role: "Relational workflow state",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:8081",
    action: "Adminer",
  },
  {
    id: "redis",
    name: "Redis",
    role: "Cache and queue support",
    groupKey: "memory",
    group: "Memory And Data",
    action: "Internal",
  },
  {
    id: "minio",
    name: "MinIO",
    role: "Assistant file storage",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:9001",
    action: "Console",
  },
  {
    id: "chroma",
    name: "Chroma",
    role: "Vector memory",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:8001",
    action: "API",
  },
  {
    id: "tika",
    name: "Tika",
    role: "Document parsing",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:9998",
    action: "Parser",
  },
  {
    id: "adminer",
    name: "Adminer",
    role: "Postgres admin UI",
    groupKey: "memory",
    group: "Memory And Data",
    publicUrl: "http://localhost:8081",
    action: "Open",
  },
  {
    id: "grafana",
    name: "Grafana",
    role: "Dashboards",
    groupKey: "observability",
    group: "Observability",
    publicUrl: "http://localhost:3002",
    action: "Open",
  },
  {
    id: "prometheus",
    name: "Prometheus",
    role: "Metrics collection",
    groupKey: "observability",
    group: "Observability",
    publicUrl: "http://localhost:9090",
    action: "Metrics",
  },
  {
    id: "loki",
    name: "Loki",
    role: "Container logs",
    groupKey: "observability",
    group: "Observability",
    publicUrl: "http://localhost:3100",
    action: "Logs",
  },
  {
    id: "docker_model_runner",
    name: "Docker Model Runner",
    role: "Docker Desktop model endpoint",
    groupKey: "runtime",
    group: "Runtime",
    publicUrl: "http://localhost:12434/engines/llama.cpp/v1/models",
    action: "Models",
  },
  {
    id: "pytorch_service",
    name: "PyTorch",
    role: "GPU service health",
    groupKey: "runtime",
    group: "Runtime",
    publicUrl: "http://localhost:8888/health",
    action: "Health",
  },
];

const stackGroupOrder = ["assistant", "automation", "memory", "observability", "runtime"];
const emptyStackState = normalizeStackPayload({}, "container-proxy");

const stackFunctionDefinitions: StackFunctionDefinition[] = [
  {
    id: "chat",
    name: "Assistant Chat",
    description: "Open the Open WebUI conversation surface.",
    serviceId: "open_webui",
    publicUrl: "http://localhost:3000",
    action: "Chat",
  },
  {
    id: "agents",
    name: "Local Agents",
    description: "Inspect available Ollama agents and models.",
    serviceId: "agentics_tools_api",
    publicUrl: "http://localhost:8765/agents",
    action: "Agents",
  },
  {
    id: "tools",
    name: "Tools API",
    description: "Open the local API docs for stack and agent endpoints.",
    serviceId: "agentics_tools_api",
    publicUrl: "http://localhost:8765/docs",
    action: "Docs",
  },
  {
    id: "services",
    name: "Stack Status",
    description: "Read the complete machine-readable container status map.",
    serviceId: "agentics_tools_api",
    publicUrl: "http://localhost:8765/services",
    action: "JSON",
  },
  {
    id: "workflows",
    name: "Workflows",
    description: "Build and inspect n8n assistant automations.",
    serviceId: "n8n",
    publicUrl: "http://localhost:5678",
    action: "n8n",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Bridge",
    description: "Open the WAHA bridge surface for messaging sessions.",
    serviceId: "waha",
    publicUrl: "http://localhost:3001",
    action: "WAHA",
  },
  {
    id: "browser-use",
    name: "Browser Automation",
    description: "Launch the Browser Use workspace.",
    serviceId: "browser_use",
    publicUrl: "http://localhost:7788",
    action: "Browser",
  },
  {
    id: "browser-vnc",
    name: "Browser Session",
    description: "View the live browser automation session.",
    serviceId: "browser_use_vnc",
    publicUrl: "http://localhost:6080",
    action: "VNC",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Open the local workspace terminal service.",
    serviceId: "open_terminal",
    publicUrl: "http://localhost:8000",
    action: "Terminal",
  },
  {
    id: "graphql",
    name: "GraphQL",
    description: "Open the PostGraphile GraphQL endpoint.",
    serviceId: "postgraphile",
    publicUrl: "http://localhost:5000/graphql",
    action: "GraphQL",
  },
  {
    id: "database",
    name: "Database Admin",
    description: "Open Adminer for the local Postgres service.",
    serviceId: "postgres",
    publicUrl: "http://localhost:8081",
    action: "Adminer",
  },
  {
    id: "files",
    name: "Files",
    description: "Open the MinIO console for assistant object storage.",
    serviceId: "minio",
    publicUrl: "http://localhost:9001",
    action: "MinIO",
  },
  {
    id: "memory",
    name: "Vector Memory",
    description: "Open the Chroma API surface.",
    serviceId: "chroma",
    publicUrl: "http://localhost:8001",
    action: "Chroma",
  },
  {
    id: "parsing",
    name: "Document Parsing",
    description: "Open the Tika parser endpoint.",
    serviceId: "tika",
    publicUrl: "http://localhost:9998",
    action: "Tika",
  },
  {
    id: "dashboards",
    name: "Dashboards",
    description: "Open Grafana observability dashboards.",
    serviceId: "grafana",
    publicUrl: "http://localhost:3002",
    action: "Grafana",
  },
  {
    id: "metrics",
    name: "Metrics",
    description: "Open Prometheus metrics collection.",
    serviceId: "prometheus",
    publicUrl: "http://localhost:9090",
    action: "Prometheus",
  },
  {
    id: "logs",
    name: "Logs",
    description: "Open Loki log storage.",
    serviceId: "loki",
    publicUrl: "http://localhost:3100",
    action: "Loki",
  },
  {
    id: "models",
    name: "Model Runtime",
    description: "Inspect Ollama local model tags.",
    serviceId: "ollama",
    publicUrl: "http://localhost:11434/api/tags",
    action: "Models",
  },
  {
    id: "docker-models",
    name: "Docker Models",
    description: "Inspect Docker Model Runner models.",
    serviceId: "docker_model_runner",
    publicUrl: "http://localhost:12434/engines/llama.cpp/v1/models",
    action: "DMR",
  },
  {
    id: "gpu",
    name: "GPU Service",
    description: "Check the PyTorch GPU service health endpoint.",
    serviceId: "pytorch_service",
    publicUrl: "http://localhost:8888/health",
    action: "Health",
  },
];

const priorityTone: Record<Priority, string> = {
  high: "border-[#c2410c] bg-[#fff7ed] text-[#7c2d12]",
  medium: "border-[#1d7f75] bg-[#edf8f5] text-[#0b4f49]",
  low: "border-[#5b6b87] bg-[#f1f5f9] text-[#27364d]",
};

const agendaTone: Record<AgendaTone, string> = {
  deep: "border-l-[#1d7f75]",
  admin: "border-l-[#8a5a00]",
  meeting: "border-l-[#8b315d]",
  personal: "border-l-[#325d8c]",
};

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function timeNowLabel() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function getNextId(items: { id: number }[]) {
  const minimum = items.reduce((lowest, item) => Math.min(lowest, item.id), 0);
  return minimum <= 0 ? minimum - 1 : -1;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function parseJsonError(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "The assistant could not save that change.";
}

function getRawServices(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const stackPayload = payload as RawStackPayload;
  if (stackPayload.services && typeof stackPayload.services === "object") {
    return stackPayload.services;
  }

  return payload as Record<string, RawStackService>;
}

function getStackError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === "string" ? error : undefined;
  }

  return undefined;
}

function getStackCheckedAt(payload: unknown) {
  if (payload && typeof payload === "object" && "checkedAt" in payload) {
    const checkedAt = (payload as { checkedAt?: unknown }).checkedAt;
    if (typeof checkedAt === "string") {
      return checkedAt;
    }
  }

  return new Date().toISOString();
}

function normalizeStackService(
  definition: StackServiceDefinition,
  rawService: RawStackService | undefined
): StackService {
  const statusCode = rawService?.status ?? rawService?.code;
  const isDegraded =
    !rawService?.ok &&
    typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500;
  const status: StackStatus = rawService?.ok ? "online" : isDegraded ? "degraded" : "offline";
  const duration =
    typeof rawService?.durationMs === "number" ? ` in ${rawService.durationMs}ms` : "";
  const tcpDetail =
    rawService?.host && rawService.port ? `TCP ${rawService.host}:${rawService.port}` : "";
  const detail = rawService?.ok
    ? tcpDetail
      ? `${tcpDetail} open`
      : `Online${duration}`
    : rawService?.error
      ? rawService.error
      : typeof statusCode === "number"
        ? `HTTP ${statusCode}`
        : "Not reported by the stack bridge";

  return {
    ...definition,
    ok: Boolean(rawService?.ok),
    status,
    detail,
    sourceUrl: rawService?.url,
  };
}

function normalizeStackPayload(
  payload: unknown,
  source: StackState["source"]
): StackState {
  const rawServices = getRawServices(payload);
  const services = stackServiceDefinitions.map((definition) =>
    normalizeStackService(definition, rawServices[definition.id])
  );
  const online = services.filter((service) => service.status === "online").length;
  const degraded = services.filter((service) => service.status === "degraded").length;

  return {
    services,
    online,
    degraded,
    offline: services.length - online - degraded,
    checkedAt: getStackCheckedAt(payload),
    source,
    error: getStackError(payload),
  };
}

async function fetchStackState(url: string, source: StackState["source"]) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getStackError(payload) ?? `Stack check failed with HTTP ${response.status}`);
  }

  return normalizeStackPayload(payload, source);
}

export default function AssistantClient({ displayName, email }: Props) {
  const [assistantState, setAssistantState] = useState<AssistantState>(emptyState);
  const [activeView, setActiveView] = useState<"agent" | "stack" | "desk" | "tasks" | "notes">("agent");
  const [stackState, setStackState] = useState<StackState>(emptyStackState);
  const [command, setCommand] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStackLoading, setIsStackLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [clock, setClock] = useState<{ today: string; time: string } | null>(null);

  useEffect(() => {
    function updateClock() {
      setClock({
        today: todayLabel(),
        time: timeNowLabel(),
      });
    }

    updateClock();
    const timer = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadState() {
      try {
        const response = await fetch("/api/assistant", { cache: "no-store" });
        const payload = (await response.json()) as AssistantState;

        if (!ignore) {
          setAssistantState(payload.persistence === "demo" ? sampleState : payload);
          setStatusMessage(payload.error ?? "");
        }
      } catch {
        if (!ignore) {
          setAssistantState(sampleState);
          setStatusMessage("Running local demo data until D1 is available.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadState();
    return () => {
      ignore = true;
    };
  }, []);

  const loadStackState = useCallback(async () => {
    setIsStackLoading(true);
    try {
      const bridgeState = await fetchStackState(`${localStackBridgeUrl}/services`, "browser-bridge");
      setStackState(bridgeState);
    } catch (bridgeError) {
      try {
        const proxyState = await fetchStackState("/api/stack", "container-proxy");
        setStackState(proxyState);
      } catch (proxyError) {
        const message =
          proxyError instanceof Error
            ? proxyError.message
            : bridgeError instanceof Error
              ? bridgeError.message
              : "Stack bridge unavailable";
        setStackState({ ...emptyStackState, checkedAt: new Date().toISOString(), error: message });
      }
    } finally {
      setIsStackLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void loadStackState();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [loadStackState]);

  const openTasks = useMemo(
    () => assistantState.tasks.filter((task) => task.status === "open"),
    [assistantState.tasks]
  );
  const doneTasks = useMemo(
    () => assistantState.tasks.filter((task) => task.status === "done"),
    [assistantState.tasks]
  );
  const highPriorityCount = openTasks.filter((task) => task.priority === "high").length;
  const nextBlock = assistantState.agendaBlocks[0];
  const focusScore = Math.max(10, 100 - openTasks.length * 9 - highPriorityCount * 7);

  async function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = command.trim();

    if (!text) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "capture", text }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(parseJsonError(payload));
      }

      setAssistantState((current) => {
        const next = { ...current };
        if (payload.createdType === "task") {
          next.tasks = [payload.item, ...current.tasks];
        }
        if (payload.createdType === "note") {
          next.notes = [payload.item, ...current.notes];
        }
        if (payload.createdType === "agenda") {
          next.agendaBlocks = [payload.item, ...current.agendaBlocks].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );
        }
        next.captures = [payload.capture, ...current.captures].slice(0, 8);
        return next;
      });
      setCommand("");
      setStatusMessage(`Captured as ${payload.createdType}.`);
    } catch (error) {
      const fallbackTask: Task = {
        id: getNextId(assistantState.tasks),
        title: text,
        status: "open",
        priority: "medium",
        project: "Inbox",
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAssistantState((current) => ({
        ...current,
        tasks: [fallbackTask, ...current.tasks],
        persistence: "demo",
      }));
      setCommand("");
      setStatusMessage(error instanceof Error ? error.message : "Saved locally for this preview.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();

    if (!title) {
      return;
    }

    await saveItem(
      { type: "task", title, priority: taskPriority, project: "Inbox" },
      (item: Task) =>
        setAssistantState((current) => ({
          ...current,
          tasks: [item, ...current.tasks],
        })),
      {
        id: getNextId(assistantState.tasks),
        title,
        status: "open",
        priority: taskPriority,
        project: "Inbox",
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    setTaskTitle("");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = noteTitle.trim();

    if (!title) {
      return;
    }

    await saveItem(
      { type: "note", title, body: noteBody, kind: "general" },
      (item: Note) =>
        setAssistantState((current) => ({
          ...current,
          notes: [item, ...current.notes],
        })),
      {
        id: getNextId(assistantState.notes),
        title,
        body: noteBody,
        kind: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    setNoteTitle("");
    setNoteBody("");
  }

  async function saveItem<T>(payload: object, onSaved: (item: T) => void, fallback: T) {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(parseJsonError(result));
      }

      onSaved(result.item as T);
      setStatusMessage("Saved.");
    } catch (error) {
      onSaved(fallback);
      setAssistantState((current) => ({ ...current, persistence: "demo" }));
      setStatusMessage(error instanceof Error ? error.message : "Saved locally for this preview.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    const nextStatus: TaskStatus = task.status === "done" ? "open" : "done";

    setAssistantState((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item
      ),
    }));

    if (task.id < 0) {
      return;
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "task", id: task.id, status: nextStatus }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(parseJsonError(result));
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d9ded8] py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-[#65706b]">
              {clock ? `${clock.today} at ${clock.time}` : "Local workspace"}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Personal Assistant</h1>
            <p className="text-sm text-[#65706b]">
              Good to see you, {displayName}. {email ? "Workspace identity is active." : "Local preview identity is active."}
            </p>
          </div>

          <nav className="flex w-full flex-wrap gap-2 rounded-lg border border-[#cdd6d1] bg-white p-1 lg:w-auto lg:flex-nowrap">
            {(["agent", "stack", "desk", "tasks", "notes"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={`h-10 min-w-[92px] flex-1 rounded-md px-4 text-sm font-medium capitalize transition lg:min-w-0 lg:flex-none ${
                  activeView === view
                    ? "bg-[#1d7f75] text-white"
                    : "text-[#36403b] hover:bg-[#eef2ef]"
                }`}
              >
                {view}
              </button>
            ))}
          </nav>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="order-2 flex flex-col gap-4 lg:order-1">
            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-[#53605a]">Today</h2>
                <span className="rounded-md bg-[#edf8f5] px-2 py-1 text-sm font-semibold text-[#0b4f49]">
                  {focusScore}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Metric label="Open" value={openTasks.length} />
                <Metric label="Done" value={doneTasks.length} />
                <Metric label="High" value={highPriorityCount} />
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Quick Capture</h2>
              <form onSubmit={submitCommand} className="mt-4 flex flex-col gap-3">
                <textarea
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Example: remind me to send the deployment note tomorrow"
                  className="min-h-28 resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none transition focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
                <button
                  type="submit"
                  disabled={isSaving || !command.trim()}
                  className="h-10 rounded-md bg-[#171918] px-4 text-sm font-semibold text-white transition hover:bg-[#2d332f] disabled:bg-[#aab3ae]"
                >
                  Capture
                </button>
              </form>
              {statusMessage ? (
                <p className="mt-3 text-sm leading-6 text-[#785b13]">{statusMessage}</p>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-lg border border-[#d9ded8] bg-white">
              <Image
                src="/assistant-visual.png"
                alt="Assistant planning visual"
                width={900}
                height={520}
                priority
                unoptimized
                className="h-44 w-full object-cover"
              />
              <div className="border-t border-[#d9ded8] p-4">
                <h2 className="text-sm font-semibold uppercase text-[#53605a]">Next Block</h2>
                <p className="mt-2 text-lg font-semibold">{nextBlock?.label ?? "No agenda yet"}</p>
                <p className="mt-1 text-sm text-[#65706b]">
                  {nextBlock ? `${nextBlock.startTime} to ${nextBlock.endTime}` : "Add one with quick capture."}
                </p>
              </div>
            </section>
          </aside>

          <section className="order-1 min-w-0 rounded-xl border-2 border-[#b8ddd7] bg-white shadow-sm lg:order-2">
            {activeView === "agent" ? (
              <AgentConsole displayName={displayName} />
            ) : null}
            {activeView === "desk" ? (
              <DeskView
                agendaBlocks={assistantState.agendaBlocks}
                isLoading={isLoading}
                notes={assistantState.notes}
                openTasks={openTasks}
                onToggleTask={toggleTask}
              />
            ) : null}
            {activeView === "stack" ? (
              <StackView
                isLoading={isStackLoading}
                stackState={stackState}
                onRefresh={loadStackState}
              />
            ) : null}
            {activeView === "tasks" ? (
              <TasksView
                isLoading={isLoading}
                taskPriority={taskPriority}
                taskTitle={taskTitle}
                tasks={assistantState.tasks}
                onAddTask={addTask}
                onPriorityChange={setTaskPriority}
                onTaskTitleChange={setTaskTitle}
                onToggleTask={toggleTask}
              />
            ) : null}
            {activeView === "notes" ? (
              <NotesView
                isLoading={isLoading}
                noteBody={noteBody}
                noteTitle={noteTitle}
                notes={assistantState.notes}
                onAddNote={addNote}
                onNoteBodyChange={setNoteBody}
                onNoteTitleChange={setNoteTitle}
              />
            ) : null}
          </section>

          <aside className="order-3 flex flex-col gap-4 lg:order-3">
            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Agenda</h2>
              <div className="mt-4 flex flex-col gap-3">
                {assistantState.agendaBlocks.length ? (
                  assistantState.agendaBlocks.map((block) => (
                    <div
                      key={block.id}
                      className={`border-l-4 bg-[#fbfcfb] px-3 py-2 ${agendaTone[block.tone]}`}
                    >
                      <p className="text-sm font-semibold">{block.label}</p>
                      <p className="mt-1 text-xs text-[#65706b]">
                        {block.startTime} to {block.endTime}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyLine text="No agenda blocks yet." />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Recent Captures</h2>
              <div className="mt-4 flex flex-col gap-3">
                {assistantState.captures.length ? (
                  assistantState.captures.map((capture) => (
                    <div key={capture.id} className="border-b border-[#eef2ef] pb-3 last:border-b-0 last:pb-0">
                      <p className="text-sm leading-6">{capture.rawText}</p>
                      <p className="mt-1 text-xs font-medium uppercase text-[#65706b]">
                        {capture.interpretedAs}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyLine text="Captured requests will appear here." />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Storage</h2>
              <p className="mt-3 text-sm leading-6 text-[#53605a]">
                {assistantState.persistence === "d1"
                  ? "D1 persistence is enabled for deployed use."
                  : "Preview mode is using local sample data until D1 is available."}
              </p>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase text-[#53605a]">Local Stack</h2>
                <span className="rounded-md bg-[#edf8f5] px-2 py-1 text-sm font-semibold text-[#0b4f49]">
                  {stackState.online}/{stackState.services.length}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#53605a]">
                {stackState.source === "browser-bridge"
                  ? "Connected through the local browser bridge."
                  : "Connected through the assistant container proxy."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView("stack")}
                  className="h-9 flex-1 rounded-md border border-[#cdd6d1] px-3 text-sm font-semibold text-[#36403b] hover:bg-[#eef2ef]"
                >
                  Stack
                </button>
                <a
                  href={hostedAssistantUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 flex-1 items-center justify-center rounded-md bg-[#171918] px-3 text-sm font-semibold text-white hover:bg-[#2d332f]"
                >
                  Site
                </a>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase text-[#65706b]">{label}</p>
    </div>
  );
}

function DeskView({
  agendaBlocks,
  isLoading,
  notes,
  openTasks,
  onToggleTask,
}: {
  agendaBlocks: AgendaBlock[];
  isLoading: boolean;
  notes: Note[];
  openTasks: Task[];
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Command Desk</h2>
        <p className="mt-1 text-sm text-[#65706b]">The highest-signal view for the next few hours.</p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border-b border-[#d9ded8] p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Focus Queue</h3>
            <span className="text-sm text-[#65706b]">{openTasks.length} open</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {isLoading ? (
              <EmptyLine text="Loading your assistant state." />
            ) : openTasks.length ? (
              openTasks.slice(0, 8).map((task) => (
                <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />
              ))
            ) : (
              <EmptyLine text="All clear. Capture the next thing when it appears." />
            )}
          </div>
        </section>
        <section className="p-5">
          <h3 className="font-semibold">Memory</h3>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-[#65706b]">Next agenda block</p>
              <p className="mt-1 text-lg font-semibold">{agendaBlocks[0]?.label ?? "No block scheduled"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#65706b]">Latest note</p>
              <p className="mt-1 text-base font-semibold">{notes[0]?.title ?? "No notes yet"}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#53605a]">{notes[0]?.body ?? "Capture references, decisions, or ideas."}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StackView({
  isLoading,
  stackState,
  onRefresh,
}: {
  isLoading: boolean;
  stackState: StackState;
  onRefresh: () => void;
}) {
  const groupedServices = stackGroupOrder
    .map((groupKey) => ({
      groupKey,
      label:
        stackServiceDefinitions.find((service) => service.groupKey === groupKey)?.group ?? groupKey,
      services: stackState.services.filter((service) => service.groupKey === groupKey),
    }))
    .filter((group) => group.services.length > 0);
  const servicesById = new Map(stackState.services.map((service) => [service.id, service]));

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[#d9ded8] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Local Stack</h2>
            <p className="mt-1 text-sm text-[#65706b]">
              Containers linked to the assistant site through the local Tools API.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e]"
            >
              Open WebUI
            </a>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-10 rounded-md border border-[#cdd6d1] px-4 text-sm font-semibold text-[#36403b] hover:bg-[#eef2ef] disabled:text-[#8b9690]"
            >
              {isLoading ? "Checking" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Online" value={stackState.online} />
          <Metric label="Degraded" value={stackState.degraded} />
          <Metric label="Offline" value={stackState.offline} />
        </div>

        <div className="mt-4 rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3 text-sm leading-6 text-[#53605a]">
          <p>
            Bridge:{" "}
            <span className="font-semibold text-[#171918]">
              {stackState.source === "browser-bridge" ? "browser to localhost:8765" : "container proxy"}
            </span>
          </p>
          <p>Last check: {new Date(stackState.checkedAt).toLocaleTimeString()}</p>
          {stackState.error ? <p className="text-[#9a3412]">{stackState.error}</p> : null}
        </div>
      </div>

      <section className="border-b border-[#eef2ef] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Functionality</h3>
            <p className="mt-1 text-sm text-[#65706b]">
              Fast paths into the assistant stack, tools, memory, files, automation, and observability.
            </p>
          </div>
          <span className="text-sm text-[#65706b]">{stackFunctionDefinitions.length} actions</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {stackFunctionDefinitions.map((item) => (
            <StackFunctionCard
              key={item.id}
              item={item}
              serviceStatus={servicesById.get(item.serviceId)?.status ?? "offline"}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-0">
        {groupedServices.map((group) => {
          const online = group.services.filter((service) => service.status === "online").length;

          return (
            <section key={group.groupKey} className="border-b border-[#eef2ef] p-5 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{group.label}</h3>
                <span className="text-sm text-[#65706b]">
                  {online}/{group.services.length} online
                </span>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {group.services.map((service) => (
                  <StackServiceCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StackFunctionCard({
  item,
  serviceStatus,
}: {
  item: StackFunctionDefinition;
  serviceStatus: StackStatus;
}) {
  const statusClass =
    serviceStatus === "online"
      ? "border-[#d9ded8] bg-white"
      : serviceStatus === "degraded"
        ? "border-[#e8c27d] bg-[#fff8e8]"
        : "border-[#e1d1ca] bg-[#fff7f3]";

  return (
    <article className={`rounded-md border p-4 ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">{item.name}</h4>
          <p className="mt-1 text-sm leading-6 text-[#53605a]">{item.description}</p>
        </div>
        <span className="rounded-md border border-[#cdd6d1] px-2 py-1 text-xs font-semibold uppercase text-[#65706b]">
          {serviceStatus}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="break-all text-xs text-[#65706b]">{item.publicUrl}</span>
        <a
          href={item.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md bg-[#171918] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2d332f]"
        >
          {item.action}
        </a>
      </div>
    </article>
  );
}

function StackServiceCard({ service }: { service: StackService }) {
  const statusClass =
    service.status === "online"
      ? "border-[#b8ddd6] bg-[#f4fbf9]"
      : service.status === "degraded"
        ? "border-[#e8c27d] bg-[#fff8e8]"
        : "border-[#e1d1ca] bg-[#fff7f3]";
  const dotClass =
    service.status === "online"
      ? "bg-[#1d7f75]"
      : service.status === "degraded"
        ? "bg-[#b7791f]"
        : "bg-[#c2410c]";

  return (
    <article className={`rounded-md border p-4 ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">{service.name}</h4>
          <p className="mt-1 text-sm text-[#53605a]">{service.role}</p>
        </div>
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClass}`} />
      </div>
      <p className="mt-3 break-words text-sm leading-6 text-[#53605a]">{service.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-[#65706b]">{service.status}</span>
        {service.publicUrl ? (
          <a
            href={service.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[#cdd6d1] bg-white px-3 py-1.5 text-sm font-semibold text-[#36403b] hover:bg-[#eef2ef]"
          >
            {service.action}
          </a>
        ) : (
          <span className="rounded-md border border-[#d9ded8] px-3 py-1.5 text-sm font-semibold text-[#65706b]">
            {service.action}
          </span>
        )}
      </div>
    </article>
  );
}

function TasksView({
  isLoading,
  taskPriority,
  taskTitle,
  tasks,
  onAddTask,
  onPriorityChange,
  onTaskTitleChange,
  onToggleTask,
}: {
  isLoading: boolean;
  taskPriority: Priority;
  taskTitle: string;
  tasks: Task[];
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onPriorityChange: (priority: Priority) => void;
  onTaskTitleChange: (title: string) => void;
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div>
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <form onSubmit={onAddTask} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_110px]">
          <input
            value={taskTitle}
            onChange={(event) => onTaskTitleChange(event.target.value)}
            placeholder="Add a task"
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <select
            value={taskPriority}
            onChange={(event) => onPriorityChange(event.target.value as Priority)}
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="h-11 rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e]">
            Add
          </button>
        </form>
      </div>
      <div className="flex flex-col p-5">
        {isLoading ? (
          <EmptyLine text="Loading tasks." />
        ) : tasks.length ? (
          tasks.map((task) => <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />)
        ) : (
          <EmptyLine text="No tasks yet." />
        )}
      </div>
    </div>
  );
}

function NotesView({
  isLoading,
  noteBody,
  noteTitle,
  notes,
  onAddNote,
  onNoteBodyChange,
  onNoteTitleChange,
}: {
  isLoading: boolean;
  noteBody: string;
  noteTitle: string;
  notes: Note[];
  onAddNote: (event: FormEvent<HTMLFormElement>) => void;
  onNoteBodyChange: (body: string) => void;
  onNoteTitleChange: (title: string) => void;
}) {
  return (
    <div>
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Notes</h2>
        <form onSubmit={onAddNote} className="mt-4 grid gap-3">
          <input
            value={noteTitle}
            onChange={(event) => onNoteTitleChange(event.target.value)}
            placeholder="Note title"
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <textarea
            value={noteBody}
            onChange={(event) => onNoteBodyChange(event.target.value)}
            placeholder="Details, links, decisions, or context"
            className="min-h-28 resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <button type="submit" className="h-11 w-full rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e] sm:w-32">
            Save Note
          </button>
        </form>
      </div>
      <div className="grid gap-0">
        {isLoading ? (
          <EmptyLine text="Loading notes." />
        ) : notes.length ? (
          notes.map((note) => (
            <article key={note.id} className="border-b border-[#eef2ef] p-5 last:border-b-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold">{note.title}</h3>
                <span className="w-fit rounded-md border border-[#cdd6d1] px-2 py-1 text-xs font-medium uppercase text-[#53605a]">
                  {note.kind}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#53605a]">{note.body || "No extra details."}</p>
            </article>
          ))
        ) : (
          <EmptyLine text="No notes yet." />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggleTask }: { task: Task; onToggleTask: (task: Task) => void }) {
  return (
    <div className="grid gap-3 border-b border-[#eef2ef] py-3 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center">
      <button
        type="button"
        onClick={() => onToggleTask(task)}
        aria-label={task.status === "done" ? "Mark task open" : "Mark task done"}
        title={task.status === "done" ? "Mark open" : "Mark done"}
        className={`h-9 w-9 rounded-md border text-sm font-semibold ${
          task.status === "done"
            ? "border-[#1d7f75] bg-[#1d7f75] text-white"
            : "border-[#cdd6d1] bg-white text-[#53605a] hover:bg-[#eef2ef]"
        }`}
      >
        {task.status === "done" ? "OK" : ""}
      </button>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${task.status === "done" ? "text-[#7b8580]" : "text-[#171918]"}`}>
          {task.title}
        </p>
        <p className="mt-1 text-xs text-[#65706b]">
          {task.project} - {formatDate(task.dueDate)}
        </p>
      </div>
      <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold uppercase ${priorityTone[task.priority]}`}>
        {task.priority}
      </span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-[#cdd6d1] p-4 text-sm leading-6 text-[#65706b]">{text}</p>;
}
