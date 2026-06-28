export type ServiceStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export type ServiceExposure = 'user-facing' | 'ops' | 'internal';

export interface HealthResult {
  ok: boolean;
  status: ServiceStatus;
  httpStatus?: number;
  message: string;
  checkedAt: string;
  raw?: unknown;
}

export interface ServiceSummary {
  name: string;
  displayName: string;
  status: ServiceStatus;
  exposure: ServiceExposure;
  url?: string;
  port?: number | string;
  host?: string;
  description?: string;
  image?: string;
  version?: string;
  tags: string[];
  raw: unknown;
}

export interface ServiceDetailRecord extends ServiceSummary {
  endpoints: Array<{
    label: string;
    url: string;
  }>;
  environment?: Record<string, string | number | boolean | null>;
  ports?: Array<string | number>;
  dependencies?: string[];
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

export interface AgentSummary {
  id: string;
  name: string;
  model: string;
  description?: string;
  capabilities?: string[];
  size?: number;
  modified_at?: string;
}

export interface AgentsResult {
  ok: boolean;
  source: string;
  ollama_url?: string;
  default_model: string;
  agents: AgentSummary[];
  error?: string;
}

export interface AgentChatRequest {
  message: string;
  model: string;
  temperature?: number;
  num_ctx?: number;
  num_predict?: number;
}

export interface AgentChatResponse {
  ok: boolean;
  status?: number;
  source: string;
  model?: string;
  response?: string;
  eval_count?: number;
  total_duration?: number;
  error?: string;
  raw?: unknown;
}
