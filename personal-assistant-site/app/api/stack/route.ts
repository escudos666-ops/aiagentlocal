const DEFAULT_TOOLS_API_URL = "http://agentics-tools-api:8765";

function servicesUrl() {
  const baseUrl = process.env.AGENTICS_TOOLS_API_INTERNAL_URL ?? DEFAULT_TOOLS_API_URL;
  return `${baseUrl.replace(/\/+$/, "")}/services`;
}

export async function GET() {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.AGENTICS_STACK_PROXY_TIMEOUT_MS ?? 30000);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 30000);

  try {
    const response = await fetch(servicesUrl(), {
      cache: "no-store",
      signal: controller.signal,
    });
    const services = await response.json();

    return Response.json(
      {
        ok: response.ok,
        source: "container-proxy",
        services,
        checkedAt: new Date().toISOString(),
      },
      {
        status: response.ok ? 200 : 502,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stack bridge unavailable";

    return Response.json(
      {
        ok: false,
        source: "container-proxy",
        services: {},
        error: message,
        checkedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
