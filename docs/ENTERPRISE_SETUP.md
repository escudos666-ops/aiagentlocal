# Enterprise Open WebUI Setup Guide

## Overview

This setup adds complete enterprise-grade capabilities to Open WebUI:
- **Identity Management**: LDAP/AD integration with phpLDAPAdmin
- **Model Flexibility**: Multiple local model servers (Ollama, LM-Studio, Text-Gen-WebUI)
- **Workflow Automation**: N8N + Temporal for advanced orchestration
- **API Gateway**: Kong with rate limiting, authentication, routing
- **Observability**: Prometheus, Grafana, Loki, Jaeger, and Vault
- **Secrets Management**: Vault for credential and secret rotation

## Component Overview

### Identity & Authentication Layer

#### LDAP Server
- **Container**: `ldap` on port 389 (LDAP) and 636 (LDAPS)
- **Admin Panel**: `phpldapadmin` on port 6443
- **Use Case**: Centralized authentication for enterprise AD/LDAP
- **Config**: Edit `.env` for `LDAP_ADMIN_PASSWORD`

**Connecting Open WebUI to LDAP:**
```env
OPENWEBUI_AUTH_PROVIDER=ldap
OPENWEBUI_LDAP_HOST=ldap
OPENWEBUI_LDAP_PORT=389
OPENWEBUI_LDAP_BASE_DN=dc=example,dc=com
OPENWEBUI_LDAP_BIND_DN=cn=admin,dc=example,dc=com
OPENWEBUI_LDAP_BIND_PASSWORD=${LDAP_ADMIN_PASSWORD}
OPENWEBUI_LDAP_USER_FILTER=(&(objectClass=person)(uid={username}))
```

### Model Provider Flexibility

#### 1. Ollama (Default)
- **Container**: `ollama` on port 11434
- **URL**: `http://ollama:11434`
- **Best For**: Production, optimized inference
- **Model Types**: LLMs, embeddings
- **Command to load models**:
  ```bash
  docker exec ollama ollama pull llama2
  docker exec ollama ollama pull neural-chat
  docker exec ollama ollama pull nomic-embed-text
  ```

#### 2. LM Studio
- **Container**: `lm-studio` on port 1234
- **URL**: `http://lm-studio:1234`
- **Best For**: Development, model experimentation
- **UI**: Available at `http://localhost:1234`
- **Models**: GGUF format

#### 3. Text Generation WebUI
- **Container**: `text-generation-webui` on port 7860
- **URL**: `http://text-gen-webui:7860`
- **Best For**: Advanced features (LoRAs, quantization settings)
- **UI**: Available at `http://localhost:7860`
- **Models**: GPTQ, AWQ, GGUF

**Configure Open WebUI to use multiple providers:**
```env
OPENWEBUI_MODEL_PROVIDERS=[
  {
    "name": "ollama",
    "api_base": "http://ollama:11434",
    "type": "local",
    "models": ["llama2", "neural-chat", "mistral"]
  },
  {
    "name": "lm-studio",
    "api_base": "http://lm-studio:1234/v1",
    "type": "local",
    "models": ["custom-model"]
  },
  {
    "name": "azure-openai",
    "api_base": "https://<your-deployment>.openai.azure.com",
    "api_key": "${AZURE_OPENAI_KEY}",
    "type": "proprietary",
    "deployment_id": "your-deployment"
  }
]
```

### Workflow Automation & Orchestration

#### N8N (Already in base compose)
- **Container**: `n8n` on port 5678
- **URL**: http://localhost:5678
- **Use**: Integrate Open WebUI with business workflows
- **Capabilities**: Webhooks, triggers, data transformations

**Example N8N workflow to Open WebUI:**
1. Trigger: Slack message received
2. Action: Send to Open WebUI via API
3. Action: Process response with LLM
4. Action: Post result back to Slack

#### Temporal (Advanced Orchestration)
- **Container**: `temporal` on port 7233
- **UI**: `temporal-ui` on port 8080
- **Use**: Long-running, fault-tolerant workflows
- **Best For**: Multi-step AI workflows with retry logic and state management

**Example Temporal workflow:**
```python
@workflow.defn
class DocumentProcessingWorkflow:
    @workflow.run
    async def run(self, doc_id: str) -> str:
        # Extract
        extracted = await workflow.execute_activity(
            extract_content,
            doc_id,
            start_to_close_timeout=timedelta(minutes=10)
        )
        # Embed
        embeddings = await workflow.execute_activity(
            create_embeddings,
            extracted,
            start_to_close_timeout=timedelta(minutes=5)
        )
        # Index
        await workflow.execute_activity(
            index_vectors,
            embeddings,
            start_to_close_timeout=timedelta(minutes=5)
        )
        return "completed"
```

### API Gateway & Rate Limiting

#### Kong
- **Container**: `kong` on ports 8000 (proxy), 8001 (admin), 8443 (HTTPS), 8444 (admin HTTPS)
- **Admin UI**: `konga` on port 1337
- **Use**: Route all client traffic through Kong for:
  - Rate limiting
  - Authentication (JWT, OAuth, Key Auth)
  - Request transformation
  - Response modification
  - Load balancing

**Configure Kong routes:**
```bash
# Create upstream service
curl -X POST http://localhost:8001/upstreams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openwebui",
    "algorithm": "round-robin"
  }'

# Add targets
curl -X POST http://localhost:8001/upstreams/openwebui/targets \
  -H "Content-Type: application/json" \
  -d '{"target": "openwebui-1:8080"}'

curl -X POST http://localhost:8001/upstreams/openwebui/targets \
  -H "Content-Type: application/json" \
  -d '{"target": "openwebui-2:8080"}'

# Create route with rate limiting
curl -X POST http://localhost:8001/routes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openwebui",
    "paths": ["/"],
    "service": {"id": "openwebui"}
  }'

# Add rate limiting plugin
curl -X POST http://localhost:8001/routes/openwebui/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rate-limiting",
    "config": {
      "minute": 1000,
      "policy": "redis",
      "redis_host": "redis"
    }
  }'
```

### Observability & Monitoring

#### Prometheus (Metrics)
- **Port**: 9090
- **URL**: http://localhost:9090
- **Retention**: Default 15 days
- **Metrics collected**:
  - Kong API gateway requests/latency
  - PostgreSQL queries
  - Redis operations
  - Model inference times
  - Temporal workflow metrics
  - Chroma vector search performance

#### Grafana (Visualization)
- **Port**: 3100
- **URL**: http://localhost:3100
- **Default**: admin/admin (change in `.env`)
- **Pre-built dashboards**: Automatically provisioned
- **Create custom dashboard** for:
  - Open WebUI request latency
  - Model inference time by provider
  - Workflow completion rates
  - Storage usage (PostgreSQL, MinIO)

#### Loki (Log Aggregation)
- **Port**: 3101
- **URL**: http://localhost:3101 (via Grafana)
- **Log sources**: All containers via Promtail
- **Query syntax**: LogQL (similar to PromQL)
- **Example query**: 
  ```
  {job="openwebui"} | json | status="error"
  ```

#### Jaeger (Distributed Tracing)
- **Port**: 16686
- **URL**: http://localhost:16686
- **Use**: Trace requests across:
  - Open WebUI → Ollama
  - N8N → Open WebUI → PostgreSQL
  - Kong → Backend services
- **Enable in OpenWebUI**:
  ```env
  OPENWEBUI_JAEGER_AGENT_HOST=jaeger
  OPENWEBUI_JAEGER_AGENT_PORT=6831
  ```

#### Vault (Secrets Management)
- **Port**: 8200
- **URL**: http://localhost:8200
- **Token**: `${VAULT_TOKEN:-root}` (change in production!)
- **Use**: Store and rotate:
  - API keys for external services (OpenAI, Azure)
  - Database credentials
  - LDAP passwords
  - S3/MinIO credentials
  - Encryption keys

**Example Vault operations:**
```bash
# Unseal vault (in dev mode, auto-unsealed)
vault operator unseal

# Enable KV secrets engine
vault secrets enable -path=secret kv-v2

# Store API key
vault kv put secret/openwebui-providers/openai \
  api_key="sk-..."

# Retrieve secret
vault kv get secret/openwebui-providers/openai

# Enable database secrets engine for auto-rotation
vault secrets enable database
vault write database/config/postgresql \
  plugin_name=postgresql-database-plugin \
  allowed_roles="readonly" \
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/openwebui" \
  username="vault" \
  password="${DB_PASSWORD}"
```

## Deployment Guide

### Single-Instance with Enterprise Features
```bash
docker-compose -f docker-compose.yml \
               -f docker-compose.enterprise.yml \
               up -d
```

### Multi-Instance with Enterprise Features
```bash
docker-compose -f docker-compose.yml \
               -f docker-compose.multi-instance.yml \
               -f docker-compose.enterprise.yml \
               up -d
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Open WebUI | http://localhost:3000 | admin@localhost / password |
| N8N | http://localhost:5678 | Setup required |
| Temporal UI | http://localhost:8080 | No auth by default |
| Kong Admin | http://localhost:1337 (Konga) | Admin setup required |
| Prometheus | http://localhost:9090 | No auth |
| Grafana | http://localhost:3100 | admin / ${GRAFANA_PASSWORD} |
| Jaeger | http://localhost:16686 | No auth |
| Vault | http://localhost:8200 | Token: ${VAULT_TOKEN} |
| LDAP Admin | https://localhost:6443 | cn=admin,dc=example,dc=com |
| LM Studio | http://localhost:1234 | No auth |
| Text-Gen-WebUI | http://localhost:7860 | No auth |

## Production Checklist

- [ ] Change all default passwords in `.env`
- [ ] Set up SSL/TLS for all services
- [ ] Configure external PostgreSQL for Kong and Temporal
- [ ] Enable LDAP/AD authentication in Open WebUI
- [ ] Configure Kong authentication policies
- [ ] Set up Grafana dashboards for your SLAs
- [ ] Enable audit logging in Vault
- [ ] Configure automated backups for PostgreSQL and MinIO
- [ ] Set up alerting rules in Prometheus
- [ ] Implement network policies (if using Kubernetes)
- [ ] Set resource limits based on your infrastructure
- [ ] Enable TLS for all inter-service communication
- [ ] Set up log retention policies in Loki
- [ ] Enable Jaeger sampling based on traffic volume

## Model Provider Selection Guide

| Provider | Latency | Cost | Privacy | Best For |
|----------|---------|------|---------|----------|
| Ollama (Local) | Low | Free | Max | Development, on-premise |
| LM Studio | Low | Free | Max | Fine-tuning, experimentation |
| Text-Gen-WebUI | Low | Free | Max | Advanced quantization |
| OpenAI | Medium | High | Low | Production, cutting-edge models |
| Azure OpenAI | Medium | High | Medium | Enterprise compliance |
| Anthropic Claude | Medium | High | Medium | Long context windows |
| Together AI | Medium | Medium | Medium | Open models at scale |

## Troubleshooting

### LDAP not connecting
```bash
# Test LDAP connectivity
docker exec ldap ldapwhoami -H ldap://localhost -D cn=admin,dc=example,dc=com -w admin

# Check Open WebUI logs
docker-compose logs openwebui | grep -i ldap
```

### Kong routes not working
```bash
# List all routes
curl http://localhost:8001/routes

# Test route directly
curl -H "Host: api.example.com" http://localhost:8000/

# Check Kong logs
docker-compose logs kong
```

### Prometheus scrape failures
```bash
# Check targets
curl http://localhost:9090/api/v1/targets

# View alerts
curl http://localhost:9090/api/v1/alerts
```

### Vault sealed
```bash
# Check status
curl http://localhost:8200/v1/sys/seal-status

# Unseal (development only)
vault operator unseal [key]
```
