import { getServiceCatalogEntry, isSensitiveServiceName, toolsApiBaseUrl } from '../config/services';
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentsResult,
  HealthResult,
  ServiceDetailRecord,
  ServiceExposure,
  ServiceStatus,
  ServiceSummary,
} from '../types/agentics';

const request = async <T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${toolsApiBaseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    body: init?.body,
    signal,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed: ${response.status} ${response.statusText}`;

    throw Object.assign(new Error(message), {
      status: response.status,
      details: body,
    });
  }

  return body as T;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTitle = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return undefined;
};

const getPort = (record: Record<string, unknown>): number | string | undefined => {
  const direct = record.port ?? record.ports;
  if (typeof direct === 'number' || typeof direct === 'string') return direct;

  if (Array.isArray(direct) && direct.length > 0) {
    const first = direct[0];
    if (typeof first === 'number' || typeof first === 'string') return first;
    if (isObject(first)) {
      return getString(first, ['published', 'public', 'host', 'target', 'container']);
    }
  }

  return undefined;
};

const detectStatus = (raw: unknown): ServiceStatus => {
  if (!isObject(raw)) return 'unknown';

  if (typeof raw.ok === 'boolean') {
    return raw.ok ? 'online' : 'offline';
  }

  const candidates = [
    raw.status,
    raw.state,
    raw.health,
    raw.healthy,
    raw.running,
    raw.available,
    raw.up,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate ? 'online' : 'offline';
    }

    if (typeof candidate === 'number') {
      if (candidate >= 200 && candidate < 400) return 'online';
      if (candidate >= 400 && candidate < 500) return 'degraded';
      if (candidate >= 500) return 'offline';
    }

    if (typeof candidate === 'string') {
      const value = candidate.toLowerCase();
      if (['ok', 'healthy', 'online', 'running', 'started', 'ready', 'up', 'available'].includes(value)) {
        return 'online';
      }
      if (['warn', 'warning', 'degraded', 'partial', 'unhealthy'].includes(value)) {
        return 'degraded';
      }
      if (['error', 'failed', 'offline', 'stopped', 'down', 'unavailable'].includes(value)) {
        return 'offline';
      }
    }
  }

  return 'unknown';
};

const detectExposure = (name: string, raw: unknown): ServiceExposure => {
  const lowerName = name.toLowerCase();
  if (isSensitiveServiceName(lowerName)) return 'internal';

  const catalogEntry = getServiceCatalogEntry(name);
  if (catalogEntry) return catalogEntry.exposure;

  if (isObject(raw)) {
    const rawExposure = getString(raw, ['exposure', 'category', 'type', 'visibility']);
    if (rawExposure) {
      const normalized = rawExposure.toLowerCase();
      if (normalized.includes('user') || normalized.includes('public') || normalized.includes('app')) {
        return 'user-facing';
      }
      if (normalized.includes('ops') || normalized.includes('monitor')) {
        return 'ops';
      }
      if (normalized.includes('internal') || normalized.includes('admin')) {
        return 'internal';
      }
    }
  }

  if (['open-webui', 'webui', 'n8n', 'browser-use'].some((token) => lowerName.includes(token))) {
    return 'user-facing';
  }

  if (['grafana', 'waha'].some((token) => lowerName.includes(token))) {
    return 'ops';
  }

  if (['minio', 'adminer', 'database', 'db'].some((token) => lowerName.includes(token))) {
    return 'internal';
  }

  return 'ops';
};

const extractUrl = (record: Record<string, unknown>): string | undefined => {
  const direct = getString(record, ['url', 'href', 'endpoint', 'base_url', 'baseUrl', 'public_url', 'publicUrl']);
  if (direct) return direct;

  const host = getString(record, ['host', 'hostname']);
  const port = getPort(record);
  if (host && port) {
    return `http://${host}:${port}`;
  }

  return undefined;
};

const collectTags = (raw: unknown): string[] => {
  if (!isObject(raw)) return [];

  const rawTags = raw.tags ?? raw.labels;
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((tag) => String(tag))
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (isObject(rawTags)) {
    return Object.entries(rawTags)
      .map(([key, value]) => `${key}:${String(value)}`)
      .slice(0, 6);
  }

  return [];
};

export const normalizeService = (nameHint: string, raw: unknown): ServiceSummary => {
  const record = isObject(raw) ? raw : {};
  const name = getString(record, ['name', 'service', 'id', 'container_name', 'containerName']) || nameHint;
  const catalogEntry = getServiceCatalogEntry(name) ?? getServiceCatalogEntry(nameHint);
  const status = detectStatus(raw);
  const exposure = catalogEntry?.exposure ?? detectExposure(name, raw);
  const rawTags = collectTags(raw);
  const tags = Array.from(new Set([...(catalogEntry?.tags ?? []), ...rawTags])).slice(0, 8);

  return {
    name,
    displayName: getString(record, ['displayName', 'display_name', 'title', 'label']) || catalogEntry?.displayName || toTitle(name),
    status,
    exposure,
    url: extractUrl(record) || catalogEntry?.url,
    port: getPort(record),
    host: getString(record, ['host', 'hostname']),
    description: getString(record, ['description', 'summary', 'role']) || catalogEntry?.description,
    image: getString(record, ['image', 'container_image', 'containerImage']),
    version: getString(record, ['version', 'tag']),
    tags,
    raw,
  };
};

const normalizeServicesPayload = (payload: unknown): Array<[string, unknown]> => {
  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      if (isObject(item)) {
        const name = getString(item, ['name', 'service', 'id', 'container_name', 'containerName']);
        return [name || `service-${index + 1}`, item];
      }

      return [`service-${index + 1}`, item];
    });
  }

  if (isObject(payload)) {
    const nested = payload.services ?? payload.data ?? payload.items;
    if (nested) return normalizeServicesPayload(nested);

    return Object.entries(payload);
  }

  return [];
};

export const normalizeServices = (payload: unknown): ServiceSummary[] => {
  return normalizeServicesPayload(payload)
    .map(([name, raw]) => normalizeService(name, raw))
    .sort((a, b) => {
      const order: Record<ServiceExposure, number> = {
        'user-facing': 0,
        ops: 1,
        internal: 2,
      };

      return order[a.exposure] - order[b.exposure] || a.displayName.localeCompare(b.displayName);
    });
};

const collectEndpoints = (service: ServiceSummary, raw: unknown): ServiceDetailRecord['endpoints'] => {
  const endpoints: ServiceDetailRecord['endpoints'] = [];

  if (service.url) {
    endpoints.push({ label: 'Primary URL', url: service.url });
  }

  if (isObject(raw)) {
    const rawEndpoints = raw.endpoints ?? raw.urls ?? raw.links;

    if (Array.isArray(rawEndpoints)) {
      rawEndpoints.forEach((endpoint, index) => {
        if (typeof endpoint === 'string') {
          endpoints.push({ label: `Endpoint ${index + 1}`, url: endpoint });
        } else if (isObject(endpoint)) {
          const url = getString(endpoint, ['url', 'href', 'endpoint']);
          if (url) {
            endpoints.push({
              label: getString(endpoint, ['label', 'name', 'title']) || `Endpoint ${index + 1}`,
              url,
            });
          }
        }
      });
    }

    if (isObject(rawEndpoints)) {
      Object.entries(rawEndpoints).forEach(([label, value]) => {
        if (typeof value === 'string') {
          endpoints.push({ label: toTitle(label), url: value });
        }
      });
    }
  }

  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    if (seen.has(endpoint.url)) return false;
    seen.add(endpoint.url);
    return true;
  });
};

const objectOfPrimitives = (value: unknown): Record<string, string | number | boolean | null> | undefined => {
  if (!isObject(value)) return undefined;

  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean' || nested === null) {
      result[key] = nested;
    }
  }

  return result;
};

export const normalizeServiceDetail = (nameHint: string, payload: unknown): ServiceDetailRecord => {
  const base = normalizeService(nameHint, payload);
  const record = isObject(payload) ? payload : {};

  const ports = Array.isArray(record.ports)
    ? record.ports.filter((port): port is string | number => typeof port === 'string' || typeof port === 'number')
    : base.port
      ? [base.port]
      : undefined;

  const dependencies = Array.isArray(record.dependencies)
    ? record.dependencies.map(String)
    : Array.isArray(record.depends_on)
      ? record.depends_on.map(String)
      : undefined;

  return {
    ...base,
    endpoints: collectEndpoints(base, payload),
    environment: objectOfPrimitives(record.environment ?? record.env),
    ports,
    dependencies,
  };
};

export const getHealth = async (signal?: AbortSignal): Promise<HealthResult> => {
  const checkedAt = new Date().toISOString();

  try {
    const raw = await request<unknown>('/health', signal);
    const status = detectStatus(raw);
    return {
      ok: status === 'online' || status === 'unknown',
      status: status === 'unknown' ? 'online' : status,
      message: status === 'offline' ? 'Tools API responded but reports offline' : 'Tools API is reachable',
      checkedAt,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'offline',
      message: error instanceof Error ? error.message : 'Tools API is unreachable',
      checkedAt,
      raw: error,
    };
  }
};

export const getServices = async (signal?: AbortSignal): Promise<ServiceSummary[]> => {
  const raw = await request<unknown>('/services', signal);
  return normalizeServices(raw);
};

export const getServiceDetail = async (
  name: string,
  signal?: AbortSignal,
): Promise<ServiceDetailRecord> => {
  const encoded = encodeURIComponent(name);
  const raw = await request<unknown>(`/services/${encoded}`, signal);
  return normalizeServiceDetail(name, raw);
};

export const getAgents = async (signal?: AbortSignal): Promise<AgentsResult> => {
  return request<AgentsResult>('/agents', signal);
};

export const sendAgentMessage = async (
  payload: AgentChatRequest,
  signal?: AbortSignal,
): Promise<AgentChatResponse> => {
  return request<AgentChatResponse>('/agents/chat', signal, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

