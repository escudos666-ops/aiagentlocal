import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { agentRuns } from "../../../db/schema";

type AgentIntent = "question" | "browse" | "research" | "task" | "memory" | "write" | "message";
type AgentStatus = "completed" | "failed" | "needs_confirmation";

type AgentPayload = {
  message?: string;
  mode?: AgentIntent | "auto";
  confirm?: boolean;
};

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv = process.env as RuntimeEnv;
const DEFAULT_TOOLS_API_URL = "http://agentics-tools-api:8765";

function getOwnerEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? "local-preview@example.com";
}

function cleanUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function getEnv(name: string) {
  return runtimeEnv[name]?.trim() || "";
}

function getAgentConfig() {
  return {
    paServiceUrl: cleanUrl(getEnv("PA_AGENT_URL")),
    paWebhookUrl: cleanUrl(getEnv("N8N_PA_WEBHOOK_URL")),
    browserAgentUrl: cleanUrl(getEnv("BROWSER_AGENT_URL")),
    browserWebhookUrl: cleanUrl(getEnv("N8N_BROWSER_WEBHOOK_URL")),
    toolsApiUrl: cleanUrl(getEnv("AGENTICS_TOOLS_API_INTERNAL_URL")) || DEFAULT_TOOLS_API_URL,
    toolsAgentModel: getEnv("AGENTICS_DEFAULT_AGENT_MODEL") || "agentics-assistant:latest",
    paToken: getEnv("PA_AGENT_TOKEN"),
    browserToken: getEnv("BROWSER_AGENT_TOKEN"),
  };
}

function classifyIntent(message: string, mode: AgentPayload["mode"]): AgentIntent {
  if (mode && mode !== "auto") {
    return mode;
  }

  const lower = message.toLowerCase();

  if (lower.includes("research") || lower.includes("compare sources")) {
    return "research";
  }

  if (
    lower.includes("browse") ||
    lower.includes("search") ||
    lower.includes("web") ||
    lower.includes("website") ||
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("latest") ||
    lower.includes("current")
  ) {
    return "browse";
  }

  if (lower.startsWith("task") || lower.includes("todo") || lower.includes("remind me")) {
    return "task";
  }

  if (lower.startsWith("note") || lower.includes("remember")) {
    return "memory";
  }

  if (lower.includes("write") || lower.includes("draft") || lower.includes("compose")) {
    return "write";
  }

  if (lower.includes("send whatsapp") || lower.includes("send message")) {
    return "message";
  }

  return "question";
}

function requiresConfirmation(message: string, intent: AgentIntent) {
  if (intent !== "message") {
    return false;
  }

  return /\b(send|post|publish|delete|buy|purchase|pay|transfer)\b/i.test(message);
}

function firstUrl(message: string) {
  return message.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function extractSources(value: unknown) {
  const json = JSON.stringify(value);
  const urls = Array.from(new Set(json.match(/https?:\/\/[^\s"'<>)}]+/g) ?? []));

  return urls.slice(0, 8).map((url) => ({ url }));
}

function resultText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "The agent returned an empty result.";
  }

  const result = value as Record<string, unknown>;
  const candidates = [
    result.response,
    result.result,
    result.answer,
    result.message,
    result.output,
    result.data,
    result.detail,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return JSON.stringify(value, null, 2).slice(0, 4000);
}

function jsonHeaders(token: string) {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callJson(url: string, payload: unknown, token = "") {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(resultText(body));
  }

  return body;
}

async function callBrowserRoute(message: string, config: ReturnType<typeof getAgentConfig>) {
  const browserUrl = config.browserWebhookUrl || config.browserAgentUrl;

  if (!browserUrl) {
    return null;
  }

  const url = config.browserWebhookUrl ? browserUrl : `${browserUrl}/api/browse`;
  const body = await callJson(
    url,
    {
      task: message,
      url: firstUrl(message),
      timeout: 60000,
    },
    config.browserToken
  );

  return {
    route: config.browserWebhookUrl ? "n8n-browser-webhook" : "browser-use",
    body,
  };
}

async function callPaRoute(
  message: string,
  intent: AgentIntent,
  ownerEmail: string,
  config: ReturnType<typeof getAgentConfig>
) {
  const paUrl = config.paWebhookUrl || config.paServiceUrl;

  if (!paUrl) {
    return null;
  }

  const body = await callJson(
    config.paWebhookUrl ? paUrl : `${paUrl}/process`,
    {
      type: "command",
      intent: intent === "research" ? "browse" : intent,
      content: message,
      metadata: {
        ownerEmail,
        source: "personal-assistant-site",
      },
    },
    config.paToken
  );

  return {
    route: config.paWebhookUrl ? "n8n-pa-webhook" : "pa-service",
    body,
  };
}

async function callLocalToolsAgentRoute(message: string, config: ReturnType<typeof getAgentConfig>) {
  if (!config.toolsApiUrl) {
    return null;
  }

  const body = await callJson(`${config.toolsApiUrl}/agents/chat`, {
    message,
    model: config.toolsAgentModel,
    num_predict: 512,
  });

  if (body && typeof body === "object" && (body as Record<string, unknown>).ok === false) {
    throw new Error(resultText(body));
  }

  return {
    route: "local-tools-agent",
    body,
  };
}

async function saveRun(
  request: Request,
  values: {
    requestText: string;
    intent: AgentIntent;
    route: string;
    status: AgentStatus;
    responseText: string;
    sources: { url: string; title?: string }[];
    raw: unknown;
  }
) {
  try {
    const db = getDb();
    const [run] = await db
      .insert(agentRuns)
      .values({
        ownerEmail: getOwnerEmail(request),
        requestText: values.requestText,
        intent: values.intent,
        route: values.route,
        status: values.status,
        responseText: values.responseText.slice(0, 6000),
        sourcesJson: JSON.stringify(values.sources).slice(0, 6000),
        rawJson: JSON.stringify(values.raw).slice(0, 6000),
      })
      .returning();

    return run
      ? {
          ...run,
          sources: JSON.parse(run.sourcesJson) as { url: string; title?: string }[],
        }
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const config = getAgentConfig();
  let runs: unknown[] = [];
  let error: string | undefined;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.ownerEmail, getOwnerEmail(request)))
      .orderBy(desc(agentRuns.createdAt), desc(agentRuns.id))
      .limit(8);
    runs = rows.map((run) => ({
      ...run,
      sources: JSON.parse(run.sourcesJson) as { url: string; title?: string }[],
    }));
  } catch {
    error = "Agent run history is waiting for the D1 migration.";
  }

  return Response.json({
    routes: {
      paService: Boolean(config.paServiceUrl),
      paWebhook: Boolean(config.paWebhookUrl),
      browserAgent: Boolean(config.browserAgentUrl),
      browserWebhook: Boolean(config.browserWebhookUrl),
      localAgent: Boolean(config.toolsApiUrl),
    },
    runs,
    error,
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as AgentPayload;
  const message = payload.message?.trim() ?? "";

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const ownerEmail = getOwnerEmail(request);
  const config = getAgentConfig();
  const intent = classifyIntent(message, payload.mode);

  if (requiresConfirmation(message, intent) && !payload.confirm) {
    const responseText = "This looks like it may send or publish something. Confirm the exact action first, then run it again.";
    const run = await saveRun(request, {
      requestText: message,
      intent,
      route: "confirmation-gate",
      status: "needs_confirmation",
      responseText,
      sources: [],
      raw: {},
    });

    return Response.json({
      responseText,
      route: "confirmation-gate",
      status: "needs_confirmation",
      sources: [],
      run,
    });
  }

  try {
    const canUseLocalAgent = intent !== "message";
    const routed =
      intent === "browse" || intent === "research"
        ? (await callBrowserRoute(message, config)) ??
          (await callPaRoute(message, intent, ownerEmail, config)) ??
          (canUseLocalAgent ? await callLocalToolsAgentRoute(message, config) : null)
        : (await callPaRoute(message, intent, ownerEmail, config)) ??
          (await callBrowserRoute(message, config)) ??
          (canUseLocalAgent ? await callLocalToolsAgentRoute(message, config) : null);

    if (!routed) {
      const responseText =
        "No reachable PA route is configured yet. Set PA_AGENT_URL or N8N_PA_WEBHOOK_URL for the orchestrator, and BROWSER_AGENT_URL or N8N_BROWSER_WEBHOOK_URL for web browsing.";
      const run = await saveRun(request, {
        requestText: message,
        intent,
        route: "unconfigured",
        status: "failed",
        responseText,
        sources: [],
        raw: {},
      });

      return Response.json({
        responseText,
        route: "unconfigured",
        status: "failed",
        sources: [],
        run,
      });
    }

    const responseText = resultText(routed.body);
    const sources = extractSources(routed.body);
    const run = await saveRun(request, {
      requestText: message,
      intent,
      route: routed.route,
      status: "completed",
      responseText,
      sources,
      raw: routed.body,
    });

    return Response.json({
      responseText,
      route: routed.route,
      status: "completed",
      sources,
      raw: routed.body,
      run,
    });
  } catch (error) {
    const responseText = error instanceof Error ? error.message : "The PA agent failed.";
    const run = await saveRun(request, {
      requestText: message,
      intent,
      route: "error",
      status: "failed",
      responseText,
      sources: [],
      raw: { error: responseText },
    });

    return Response.json(
      {
        responseText,
        route: "error",
        status: "failed",
        sources: [],
        run,
        error: responseText,
      },
      { status: 502 }
    );
  }
}
