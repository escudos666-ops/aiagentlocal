const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const port = Number(process.env.PORT || 8787);
const publicDir = path.join(__dirname, "public");

const serviceGroups = [
  {
    key: "assistant",
    label: "Assistant Core",
    services: [
      {
        id: "open-webui",
        name: "Open WebUI",
        role: "Chat workspace and agent front door",
        kind: "http",
        internalUrl: process.env.OPEN_WEBUI_INTERNAL_URL || "http://open-webui:8080",
        healthPath: process.env.OPEN_WEBUI_HEALTH_PATH || "/health",
        publicUrl: process.env.OPEN_WEBUI_PUBLIC_URL || "http://localhost:3000",
        action: "Open chat"
      },
      {
        id: "ollama",
        name: "Ollama",
        role: "Local model runtime",
        kind: "http",
        internalUrl: process.env.OLLAMA_INTERNAL_URL || "http://ollama:11434",
        healthPath: process.env.OLLAMA_HEALTH_PATH || "/api/tags",
        publicUrl: process.env.OLLAMA_PUBLIC_URL || "http://localhost:11434",
        action: "Model API"
      },
      {
        id: "agentics-mcp",
        name: "Agentics MCP",
        role: "Assistant tools and health automation",
        kind: "http",
        internalUrl: process.env.AGENTICS_MCP_INTERNAL_URL || "http://agentics-mcp:8766",
        healthPath: process.env.AGENTICS_MCP_HEALTH_PATH || "/health",
        publicUrl: process.env.AGENTICS_MCP_PUBLIC_URL || "http://localhost:8766/health",
        action: "Health"
      }
    ]
  },
  {
    key: "automation",
    label: "Automation And Messaging",
    services: [
      {
        id: "n8n",
        name: "n8n",
        role: "Workflow brain for assistant actions",
        kind: "http",
        internalUrl: process.env.N8N_INTERNAL_URL || "http://n8n:5678",
        healthPath: process.env.N8N_HEALTH_PATH || "/healthz",
        publicUrl: process.env.N8N_PUBLIC_URL || "http://localhost:5678",
        action: "Workflows"
      },
      {
        id: "waha",
        name: "WAHA",
        role: "WhatsApp assistant bridge",
        kind: "http",
        internalUrl: process.env.WAHA_INTERNAL_URL || "http://waha:3000",
        healthPath: process.env.WAHA_HEALTH_PATH || "/api/sessions",
        publicUrl: process.env.WAHA_PUBLIC_URL || "http://localhost:3001",
        action: "WhatsApp"
      },
      {
        id: "browser-use",
        name: "Browser Use",
        role: "Browser automation workspace",
        kind: "http",
        internalUrl: process.env.BROWSER_USE_INTERNAL_URL || "http://browser-use-web-ui:7788",
        healthPath: process.env.BROWSER_USE_HEALTH_PATH || "/",
        publicUrl: process.env.BROWSER_USE_PUBLIC_URL || "http://localhost:7788",
        action: "Browser"
      }
    ]
  },
  {
    key: "memory",
    label: "Memory And Data",
    services: [
      {
        id: "postgres",
        name: "Postgres",
        role: "Relational state for workflows",
        kind: "tcp",
        host: process.env.POSTGRES_HOST || "postgres",
        port: Number(process.env.POSTGRES_PORT || 5432),
        publicUrl: process.env.ADMINER_PUBLIC_URL || "http://localhost:8088",
        action: "Adminer"
      },
      {
        id: "redis",
        name: "Redis",
        role: "Fast cache and queue support",
        kind: "tcp",
        host: process.env.REDIS_HOST || "redis",
        port: Number(process.env.REDIS_PORT || 6379),
        publicUrl: process.env.REDIS_PUBLIC_URL || "",
        action: "Internal"
      },
      {
        id: "minio",
        name: "MinIO",
        role: "Assistant file and object storage",
        kind: "http",
        internalUrl: process.env.MINIO_INTERNAL_URL || "http://minio:9000",
        healthPath: process.env.MINIO_HEALTH_PATH || "/minio/health/live",
        publicUrl: process.env.MINIO_PUBLIC_URL || "http://localhost:9001",
        action: "Console"
      },
      {
        id: "chroma",
        name: "Chroma",
        role: "Vector memory for retrieval",
        kind: "http",
        internalUrl: process.env.CHROMA_INTERNAL_URL || "http://chroma:8000",
        healthPath: process.env.CHROMA_HEALTH_PATH || "/api/v2/heartbeat",
        publicUrl: process.env.CHROMA_PUBLIC_URL || "http://localhost:8001",
        action: "API"
      },
      {
        id: "tika",
        name: "Tika",
        role: "Document parsing for assistant files",
        kind: "http",
        internalUrl: process.env.TIKA_INTERNAL_URL || "http://tika:9998",
        healthPath: process.env.TIKA_HEALTH_PATH || "/tika",
        publicUrl: process.env.TIKA_PUBLIC_URL || "http://localhost:9998",
        action: "Parser"
      }
    ]
  },
  {
    key: "observability",
    label: "Observability",
    services: [
      {
        id: "grafana",
        name: "Grafana",
        role: "Dashboards for the full stack",
        kind: "http",
        internalUrl: process.env.GRAFANA_INTERNAL_URL || "http://grafana:3000",
        healthPath: process.env.GRAFANA_HEALTH_PATH || "/api/health",
        publicUrl: process.env.GRAFANA_PUBLIC_URL || "http://localhost:3002",
        action: "Dashboards"
      },
      {
        id: "prometheus",
        name: "Prometheus",
        role: "Metrics collection",
        kind: "http",
        internalUrl: process.env.PROMETHEUS_INTERNAL_URL || "http://prometheus:9090",
        healthPath: process.env.PROMETHEUS_HEALTH_PATH || "/-/healthy",
        publicUrl: process.env.PROMETHEUS_PUBLIC_URL || "http://localhost:9090",
        action: "Metrics"
      },
      {
        id: "loki",
        name: "Loki",
        role: "Container log storage",
        kind: "http",
        internalUrl: process.env.LOKI_INTERNAL_URL || "http://loki:3100",
        healthPath: process.env.LOKI_HEALTH_PATH || "/ready",
        publicUrl: process.env.LOKI_PUBLIC_URL || "http://localhost:3100",
        action: "Logs"
      }
    ]
  }
];

function flattenServices() {
  return serviceGroups.flatMap((group) =>
    group.services.map((service) => ({ ...service, group: group.label, groupKey: group.key }))
  );
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

function checkHttp(service, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const target = new URL(service.healthPath || "/", service.internalUrl);
    const client = target.protocol === "https:" ? https : http;
    const startedAt = Date.now();
    const request = client.request(
      target,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: { "user-agent": "agentics-webui/0.1" }
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          const durationMs = Date.now() - startedAt;
          const ok = response.statusCode >= 200 && response.statusCode < 400;
          const degraded = response.statusCode >= 400 && response.statusCode < 500;
          resolve({
            ok,
            status: ok ? "online" : degraded ? "degraded" : "offline",
            code: response.statusCode,
            durationMs,
            checkedAt: new Date().toISOString()
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Health check timed out"));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        status: "offline",
        error: error.code || error.message,
        checkedAt: new Date().toISOString()
      });
    });

    request.end();
  });
}

function checkTcp(service, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = net.createConnection({ host: service.host, port: service.port });

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      socket.destroy();
      resolve({
        ok: true,
        status: "online",
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      });
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve({
        ok: false,
        status: "offline",
        error: "timeout",
        checkedAt: new Date().toISOString()
      });
    });

    socket.once("error", (error) => {
      resolve({
        ok: false,
        status: "offline",
        error: error.code || error.message,
        checkedAt: new Date().toISOString()
      });
    });
  });
}

async function checkService(service) {
  const result = service.kind === "tcp" ? await checkTcp(service) : await checkHttp(service);
  return {
    id: service.id,
    name: service.name,
    role: service.role,
    group: service.group,
    groupKey: service.groupKey,
    kind: service.kind,
    publicUrl: service.publicUrl,
    action: service.action,
    ...result
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function triggerWorkflow(req, res) {
  const webhookUrl = process.env.N8N_AGENT_WEBHOOK_URL;
  if (!webhookUrl) {
    sendJson(res, 409, {
      ok: false,
      message: "Set N8N_AGENT_WEBHOOK_URL to enable one-click workflow dispatch."
    });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const body = JSON.stringify({
      source: "agentics-webui",
      createdAt: new Date().toISOString(),
      ...payload
    });

    const target = new URL(webhookUrl);
    const client = target.protocol === "https:" ? https : http;
    const request = client.request(
      target,
      {
        method: "POST",
        timeout: 8000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          sendJson(res, response.statusCode >= 200 && response.statusCode < 300 ? 200 : 502, {
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            response: Buffer.concat(chunks).toString("utf8").slice(0, 1000)
          });
        });
      }
    );

    request.on("error", (error) => {
      sendJson(res, 502, { ok: false, message: error.message });
    });

    request.write(body);
    request.end();
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, "http://localhost");

  if (requestUrl.pathname === "/api/manifest") {
    sendJson(res, 200, {
      name: "Agentics Personal Assistant",
      groups: serviceGroups.map((group) => ({
        key: group.key,
        label: group.label,
        services: group.services.map(({ internalUrl, host, port, healthPath, ...service }) => service)
      }))
    });
    return;
  }

  if (requestUrl.pathname === "/api/services") {
    const checks = await Promise.all(flattenServices().map(checkService));
    const online = checks.filter((service) => service.ok).length;
    sendJson(res, 200, {
      checkedAt: new Date().toISOString(),
      total: checks.length,
      online,
      degraded: checks.filter((service) => service.status === "degraded").length,
      offline: checks.length - online,
      services: checks
    });
    return;
  }

  if (requestUrl.pathname === "/api/workflow" && req.method === "POST") {
    await triggerWorkflow(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Agentics personal assistant WebUI listening on ${port}`);
});
