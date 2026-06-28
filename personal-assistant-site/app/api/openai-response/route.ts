type RuntimeEnv = Record<string, string | undefined>;

type RequestPayload = {
  prompt?: string;
  assistantSeed?: string;
  model?: string;
  allowedTools?: string[];
};

type OpenAiOutputPart = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  content?: OpenAiOutputPart[];
};

const runtimeEnv = process.env as RuntimeEnv;
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_MCP_SERVER_URL = "https://remote.mcp.pipedream.net";

function getEnv(name: string) {
  return runtimeEnv[name]?.trim() || process.env[name]?.trim() || "";
}

function getConfig() {
  const config = {
    apiKey: getEnv("OPENAI_API_KEY"),
    model: getEnv("OPENAI_RESPONSES_MODEL") || DEFAULT_MODEL,
    mcpServerUrl: getEnv("PIPEDREAM_MCP_SERVER_URL") || DEFAULT_MCP_SERVER_URL,
    mcpAppSlug: getEnv("PIPEDREAM_MCP_APP_SLUG"),
    mcpAuthorization: getEnv("PIPEDREAM_MCP_AUTHORIZATION"),
  };
  const missing = [
    config.apiKey ? "" : "OPENAI_API_KEY",
    config.mcpAppSlug ? "" : "PIPEDREAM_MCP_APP_SLUG",
    config.mcpAuthorization ? "" : "PIPEDREAM_MCP_AUTHORIZATION",
  ].filter(Boolean);

  return { ...config, missing };
}

function textFromUnknown(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  for (const key of ["error", "message", "detail"]) {
    if (typeof record[key] === "string") {
      return record[key];
    }
  }

  return JSON.stringify(value).slice(0, 1000);
}

function extractOutputText(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (!Array.isArray(record.output)) {
    return "";
  }

  return record.output
    .flatMap((item) => {
      const outputItem = item as OpenAiOutputItem;
      return Array.isArray(outputItem.content) ? outputItem.content : [];
    })
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 1000) };
  }
}

export async function POST(request: Request) {
  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const config = getConfig();
  if (config.missing.length) {
    return Response.json(
      {
        error: "OpenAI MCP response route is not configured for this runtime.",
        missing: config.missing,
      },
      {
        status: 412,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  const model = payload.model?.trim() || config.model;
  const allowedTools = Array.isArray(payload.allowedTools) ? payload.allowedTools : [];
  const prompt = payload.prompt ?? "";
  const assistantSeed = payload.assistantSeed ?? "";

  const openAiBody = {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: assistantSeed,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "text",
      },
      verbosity: "high",
    },
    reasoning: {
      effort: "xhigh",
      summary: "concise",
    },
    tools: [
      {
        type: "mcp",
        server_label: "pipedream",
        server_url: config.mcpServerUrl,
        headers: {
          "x-pd-app-slug": config.mcpAppSlug,
        },
        authorization: config.mcpAuthorization,
        allowed_tools: allowedTools,
        require_approval: "always",
      },
    ],
    store: true,
    include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(openAiBody),
    });
    const body = await readJson(response);

    if (!response.ok) {
      return Response.json(
        {
          error: textFromUnknown(body) || `OpenAI request failed with HTTP ${response.status}.`,
          status: response.status,
        },
        {
          status: response.status,
          headers: { "cache-control": "no-store" },
        }
      );
    }

    return Response.json(
      {
        outputText: extractOutputText(body),
        raw: body,
      },
      {
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "OpenAI request failed.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      }
    );
  }
}
