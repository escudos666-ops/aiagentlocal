CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pa_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  source TEXT NOT NULL DEFAULT 'open-webui',
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  status TEXT NOT NULL DEFAULT 'created',
  risk_level TEXT NOT NULL DEFAULT 'low',
  approval_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pa_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_call_id UUID REFERENCES pa_tool_calls(id),
  title TEXT NOT NULL,
  requested_action JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pa_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id UUID REFERENCES pa_agent_tasks(id),
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pa_memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  vector_id TEXT,
  importance INT DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pa_email_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  thread_id TEXT,
  from_address TEXT,
  to_addresses TEXT[],
  subject TEXT,
  received_at TIMESTAMPTZ,
  summary TEXT,
  importance_score INT DEFAULT 0,
  requires_reply BOOLEAN DEFAULT false,
  raw_metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE(provider, external_message_id)
);
