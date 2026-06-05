# Multi-Instance Open WebUI Deployment Guide

## Overview
Your setup now includes all components required for production multi-instance deployments:

### Infrastructure Components Added

#### 1. **Chroma Vector Database**
- **Why**: Replaces single-instance ChromaDB with HTTP server mode for multi-instance access
- **Container**: `chroma:latest` on port 8000
- **Storage**: Persistent at `./data/chroma`
- **Config**: Set to persistent mode with anonymous telemetry disabled

#### 2. **Apache Tika**
- **Why**: Production-grade document extraction to replace memory-leaking pypdf
- **Container**: `apache/tika:latest` on port 9998
- **Features**: Supports PDFs, Word, Excel, PowerPoint, images, and 1000+ formats
- **Memory**: Configured with 512MB child process memory

#### 3. **PostgreSQL pgvector**
- **Why**: Store embeddings as vectors alongside relational data (OpenWebUI data)
- **Extension**: pgvector enabled automatically via init script
- **Database**: Separate `openwebui` database created
- **Config**: Supports multi-instance concurrent reads/writes

#### 4. **Nginx Load Balancer**
- **Why**: Distribute traffic across multiple Open WebUI instances
- **Features**: Least-conn load balancing, WebSocket support, gzip compression
- **Session**: Uses least_conn to maintain connection reuse
- **Health**: Built-in `/health` endpoint for monitoring

#### 5. **Redis Integration**
- **Already running** - Used for:
  - Session management across instances
  - WebSocket coordination
  - Cache layer

### Configuration Updates

#### Updated Environment Variables (.env)
```bash
# Multi-instance deployment config
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin
POSTGRES_DB=agentdb

MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin123

# Content Extraction
TIKA_SERVER_ENDPOINT=http://tika:9998

# Embedding
EMBEDDING_MODEL=nomic-embed-text
```

#### Open WebUI Environment Variables
```bash
DATABASE_URL=postgresql://admin:admin@postgres:5432/openwebui
REDIS_URL=redis://redis:6379
CHROMA_API_HOST=chroma
CHROMA_API_PORT=8000
S3_ENDPOINT_URL=http://minio:9000
S3_BUCKET_NAME=webui
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=admin123
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
TIKA_SERVER_ENDPOINT=http://tika:9998
```

## Deployment Modes

### Mode 1: Single-Instance (Current)
```bash
docker-compose up -d
```
- Runs: ollama, openwebui, qdrant, redis, postgres, minio, n8n, webui_preview, chroma, tika
- Access Open WebUI at: http://localhost:3000

### Mode 2: Multi-Instance Production
```bash
docker-compose -f docker-compose.yml -f docker-compose.multi-instance.yml up -d
```
- Adds: `openwebui-1`, `openwebui-2`, and `nginx` load balancer
- Access Open WebUI at: http://localhost:3000 (load balanced)
- Individual instances: http://localhost:3001 and http://localhost:3002

## Scaling Beyond 2 Instances

Add more instances to `docker-compose.multi-instance.yml`:

```yaml
openwebui-3:
  image: ghcr.io/open-webui/open-webui:main
  ports:
    - "3003:8080"
  environment:
    # Same as openwebui-1 and openwebui-2
  # ... rest of config
```

Update `nginx.conf` upstream block:
```nginx
upstream openwebui_backend {
    least_conn;
    server openwebui-1:8080 max_fails=3 fail_timeout=30s;
    server openwebui-2:8080 max_fails=3 fail_timeout=30s;
    server openwebui-3:8080 max_fails=3 fail_timeout=30s;
}
```

## Data Flow

```
User Request
    ↓
Nginx (Load Balancer on :3000)
    ↓
OpenWebUI Instance (1 or 2)
    ↓
Database Layer:
├── PostgreSQL (relational data + pgvector embeddings)
├── Redis (session + cache)
├── Chroma (vector search)
└── MinIO (file storage)
    ↓
Processing:
├── Ollama (LLM + embeddings: nomic-embed-text)
└── Tika (document extraction)
```

## Monitoring & Health Checks

### Health Check Endpoints
```bash
# Nginx load balancer
curl http://localhost:3000/health

# Individual OpenWebUI instances
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health

# Vector database
curl http://localhost:8000/api/v1/heartbeat

# Tika
curl http://localhost:9998/v1/meta

# PostgreSQL
docker exec postgres pg_isready -U admin

# Redis
docker exec redis redis-cli ping

# MinIO
curl http://localhost:9000/minio/health/live

# Ollama
curl http://localhost:11434/api/tags
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f openwebui-1
docker-compose logs -f chroma
docker-compose logs -f tika

# Nginx load balancer
docker-compose logs -f nginx
```

## Production Checklist

- [ ] Change all default credentials in `.env.prod`
- [ ] Set `SECURE_POSTGRES_PASSWORD` in production
- [ ] Set `SECURE_MINIO_PASSWORD` in production
- [ ] Set `SECURE_S3_*` credentials if using cloud S3
- [ ] Configure domain name in nginx.conf
- [ ] Set up SSL/TLS certificates (use certbot + Let's Encrypt)
- [ ] Update `CHROMA_API_HOST` and `TIKA_SERVER_ENDPOINT` for cloud deployments
- [ ] Configure resource limits per your infrastructure
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Enable PostgreSQL backups
- [ ] Enable MinIO backups
- [ ] Configure log rotation and centralized logging

## Troubleshooting

### OpenWebUI not connecting to PostgreSQL
```bash
# Check connectivity
docker exec openwebui psql -h postgres -U admin -d openwebui -c "SELECT version();"

# Check DATABASE_URL is set
docker exec openwebui env | grep DATABASE_URL
```

### Tika not extracting documents
```bash
# Test Tika endpoint
curl -X PUT --data-binary @/path/to/file.pdf http://localhost:9998/tika

# Check logs
docker-compose logs tika
```

### Chroma vector search not working
```bash
# Test Chroma heartbeat
curl http://localhost:8000/api/v1/heartbeat

# Check if collections exist
curl http://localhost:8000/api/v1/collections
```

### Session loss between instances
- Verify Redis is running: `docker exec redis redis-cli ping`
- Check Redis connectivity from OpenWebUI: logs should show Redis connection success
- Ensure `REDIS_URL=redis://redis:6379` is set on all instances

## Performance Tuning

### For High Concurrency
- Increase PostgreSQL `max_connections` (default 100)
- Increase Redis `maxmemory` if caching large sessions
- Increase Chroma memory limits
- Add more OpenWebUI instances

### For Large Documents
- Increase Tika `TIKA_CHILD_PROCESS_MEMORY` (default 512MB)
- Increase Chroma memory limit
- Set larger `client_max_body_size` in nginx (default 100M)

### For Memory-Constrained Systems
- Reduce resource reservations in docker-compose
- Use Ollama remote (not local) for embedding models
- Use smaller embedding models (default nomic-embed-text is 274MB)
