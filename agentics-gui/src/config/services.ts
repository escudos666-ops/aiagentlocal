import type { ServiceExposure } from '../types/agentics';

const readEnv = (key: string, fallback: string): string => {
  const value = import.meta.env[key] as string | undefined;
  return value?.trim() || fallback;
};

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const serviceUrls = {
  toolsApi: trimSlash(readEnv('VITE_TOOLS_API_URL', 'http://127.0.0.1:8765')),
  openWebui: trimSlash(readEnv('VITE_OPEN_WEBUI_URL', 'http://localhost:3000')),
  n8n: trimSlash(readEnv('VITE_N8N_URL', 'http://localhost:5678')),
  browserUse: trimSlash(readEnv('VITE_BROWSER_USE_URL', 'http://localhost:7788')),
  grafana: trimSlash(readEnv('VITE_GRAFANA_URL', 'http://127.0.0.1:3002')),
  waha: trimSlash(readEnv('VITE_WAHA_URL', 'http://127.0.0.1:3001')),
  ollama: trimSlash(readEnv('VITE_OLLAMA_URL', 'http://127.0.0.1:11434')),
  dockerModelRunner: trimSlash(readEnv('VITE_DMR_URL', 'http://127.0.0.1:12434')),
  chroma: trimSlash(readEnv('VITE_CHROMA_URL', 'http://127.0.0.1:8000')),
  tika: trimSlash(readEnv('VITE_TIKA_URL', 'http://127.0.0.1:9998')),
  prometheus: trimSlash(readEnv('VITE_PROMETHEUS_URL', 'http://127.0.0.1:9090')),
  loki: trimSlash(readEnv('VITE_LOKI_URL', 'http://127.0.0.1:3100')),
  postgraphile: trimSlash(readEnv('VITE_POSTGRAPHILE_URL', 'http://127.0.0.1:5000/graphql')),
  minioApi: trimSlash(readEnv('VITE_MINIO_API_URL', 'http://127.0.0.1:9000')),
  minioConsole: trimSlash(readEnv('VITE_MINIO_CONSOLE_URL', 'http://localhost:9001')),
  adminer: trimSlash(readEnv('VITE_ADMINER_URL', 'http://127.0.0.1:8088')),
} as const;

/**
 * In development, the frontend calls Vite's local proxy so CORS does not require
 * changing the running tools API container. Production builds call the configured
 * VITE_TOOLS_API_URL directly.
 */
export const toolsApiBaseUrl = import.meta.env.DEV ? '/api/tools' : serviceUrls.toolsApi;

export interface QuickLink {
  key: string;
  label: string;
  description: string;
  url: string;
  exposure: ServiceExposure;
  badge: string;
}

export interface ServiceCatalogEntry {
  displayName: string;
  description: string;
  url?: string;
  exposure: ServiceExposure;
  tags: string[];
}

export const serviceCatalog: Record<string, ServiceCatalogEntry> = {
  ollama: {
    displayName: 'Ollama',
    description: 'Local model runtime and model tag API.',
    url: serviceUrls.ollama,
    exposure: 'ops',
    tags: ['llm', 'models', 'runtime'],
  },
  docker_model_runner: {
    displayName: 'Docker Model Runner',
    description: 'Docker-hosted llama.cpp-compatible model endpoint.',
    url: serviceUrls.dockerModelRunner,
    exposure: 'ops',
    tags: ['llm', 'docker', 'inference'],
  },
  n8n: {
    displayName: 'n8n',
    description: 'Workflow automation and webhook orchestration.',
    url: serviceUrls.n8n,
    exposure: 'user-facing',
    tags: ['automation', 'workflows', 'webhooks'],
  },
  tika: {
    displayName: 'Apache Tika',
    description: 'Document parsing, OCR-adjacent extraction, and file text detection.',
    url: serviceUrls.tika,
    exposure: 'internal',
    tags: ['documents', 'parser'],
  },
  chroma: {
    displayName: 'Chroma',
    description: 'Vector database heartbeat and retrieval backend.',
    url: serviceUrls.chroma,
    exposure: 'internal',
    tags: ['vectors', 'memory', 'rag'],
  },
  minio: {
    displayName: 'MinIO',
    description: 'S3-compatible object storage and artifact buckets.',
    url: serviceUrls.minioConsole,
    exposure: 'internal',
    tags: ['storage', 's3'],
  },
  grafana: {
    displayName: 'Grafana',
    description: 'Metrics dashboards and operational observability.',
    url: serviceUrls.grafana,
    exposure: 'ops',
    tags: ['metrics', 'dashboards'],
  },
  prometheus: {
    displayName: 'Prometheus',
    description: 'Metrics scraper and time-series monitoring backend.',
    url: serviceUrls.prometheus,
    exposure: 'internal',
    tags: ['metrics', 'scraper'],
  },
  loki: {
    displayName: 'Loki',
    description: 'Log aggregation backend for local observability.',
    url: serviceUrls.loki,
    exposure: 'internal',
    tags: ['logs', 'observability'],
  },
  browser_use: {
    displayName: 'Browser Use',
    description: 'Browser automation UI/service for agent workflows.',
    url: serviceUrls.browserUse,
    exposure: 'user-facing',
    tags: ['browser', 'automation', 'agent'],
  },
  postgraphile: {
    displayName: 'PostGraphile',
    description: 'GraphQL API generated from the Postgres database.',
    url: serviceUrls.postgraphile,
    exposure: 'internal',
    tags: ['graphql', 'postgres'],
  },
};

export const getServiceCatalogEntry = (name: string): ServiceCatalogEntry | undefined => {
  const normalized = name.toLowerCase().replace(/[\s-]+/g, '_');
  return serviceCatalog[normalized];
};

export const quickLinks: QuickLink[] = [
  {
    key: 'open-webui',
    label: 'Open WebUI',
    description: 'Chat and model interaction UI',
    url: serviceUrls.openWebui,
    exposure: 'user-facing',
    badge: 'App',
  },
  {
    key: 'n8n',
    label: 'n8n',
    description: 'Workflow automation',
    url: serviceUrls.n8n,
    exposure: 'user-facing',
    badge: 'Flow',
  },
  {
    key: 'browser-use',
    label: 'browser-use',
    description: 'Browser automation service',
    url: serviceUrls.browserUse,
    exposure: 'user-facing',
    badge: 'Agent',
  },
  {
    key: 'grafana',
    label: 'Grafana',
    description: 'Metrics and operational dashboards',
    url: serviceUrls.grafana,
    exposure: 'ops',
    badge: 'Ops',
  },
  {
    key: 'waha',
    label: 'WAHA',
    description: 'WhatsApp HTTP API console',
    url: serviceUrls.waha,
    exposure: 'ops',
    badge: 'Ops',
  },
  {
    key: 'ollama',
    label: 'Ollama API',
    description: 'Model runtime API and installed model list',
    url: `${serviceUrls.ollama}/api/tags`,
    exposure: 'ops',
    badge: 'LLM',
  },
  {
    key: 'tools-api',
    label: 'Tools API',
    description: 'Agentics service health endpoint',
    url: `${serviceUrls.toolsApi}/services`,
    exposure: 'ops',
    badge: 'API',
  },
  {
    key: 'minio-console',
    label: 'MinIO Console',
    description: 'Object storage administration',
    url: serviceUrls.minioConsole,
    exposure: 'internal',
    badge: 'Internal',
  },
  {
    key: 'adminer',
    label: 'Adminer',
    description: 'Database administration',
    url: serviceUrls.adminer,
    exposure: 'internal',
    badge: 'Internal',
  },
];

export const sensitiveServiceNamePatterns = [
  'postgres',
  'postgresql',
  'redis',
  'prometheus',
  'loki',
  'node-exporter',
  'node_exporter',
];

export const isSensitiveServiceName = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return sensitiveServiceNamePatterns.some((pattern) => normalized.includes(pattern));
};
