# Unified Docker Setup & Logging Guide

## Current Situation

You have mixed container deployments:
- **Standalone containers**: `openwebui-extension-service`, `ollama` (jovial_bhabha), `redis`, `minio`, `qdrant`, `n8n`, `postgres`
- **Docker Compose services**: Defined but not all running under compose orchestration
- **Issue**: Containers can't communicate due to different networks or naming

## Solution: Unified Compose-Based Deployment

### Step 1: Stop & Remove Old Containers

```bash
# Stop all running containers from old deployments
docker container stop $(docker container ls -q)

# Remove old containers (CAUTION - this removes data)
docker container prune -f
```

### Step 2: Verify Clean State

```bash
docker ps -a
# Should show empty or only images you want to keep
```

### Step 3: Start with Docker Compose

```bash
# For standard multi-service setup with logging
docker-compose -f docker-compose.yml -f docker-compose.logging.yml up -d

# For multi-instance + logging
docker-compose -f docker-compose.yml -f docker-compose.multi-instance.yml -f docker-compose.logging.yml up -d

# For enterprise features + logging
docker-compose -f docker-compose.yml -f docker-compose.enterprise.yml -f docker-compose.logging.yml up -d
```

### Step 4: Verify All Services Are Running

```bash
docker-compose ps

# Expected output should show all services as "Up"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Step 5: Access Centralized Logging

Open Docker Desktop Logs view:
- **URL**: docker-desktop://dashboard/logs
- **Alternative**: http://localhost:3100 (Grafana with Loki datasource)

### Step 6: View Logs by Container

```bash
# All Open WebUI logs
docker-compose logs -f openwebui

# All Ollama logs
docker-compose logs -f ollama

# All services
docker-compose logs -f

# Specific service with tail
docker-compose logs --tail=50 openwebui
```

## Access Points After Setup

| Service | URL | Port | Purpose |
|---------|-----|------|---------|
| Open WebUI | http://localhost:3000 | 3000 | Main AI interface |
| Ollama API | http://localhost:11434 | 11434 | Model server |
| Redis | localhost | 6379 | Cache/sessions |
| PostgreSQL | localhost | 5432 | Database |
| MinIO | http://localhost:9000 | 9000 | Object storage |
| MinIO Console | http://localhost:9001 | 9001 | Storage UI |
| Qdrant | http://localhost:6333 | 6333 | Vector DB |
| N8N | http://localhost:5678 | 5678 | Workflow automation |
| Chroma | http://localhost:8000 | 8000 | Vector search |
| Tika | http://localhost:9998 | 9998 | Document extraction |
| **Grafana (Logs)** | **http://localhost:3100** | **3100** | **Centralized Logging** |
| Loki | http://localhost:3101 | 3101 | Log aggregation |

## Centralized Logging Architecture

### How It Works

1. **Promtail** - Reads logs from all Docker containers
2. **Loki** - Stores logs in compressed format
3. **Grafana** - Visualizes logs with searching and filtering

```
All Container Logs
        ↓
    Promtail (reads /var/lib/docker/containers)
        ↓
    Loki (aggregates)
        ↓
    Grafana UI (search, filter, alert)
```

### Accessing Logs in Grafana

1. Go to http://localhost:3100
2. Login: `admin` / `${GRAFANA_PASSWORD}` (default: `admin`)
3. Click **Explore** (top left)
4. Select **Loki** datasource
5. Build query:
   ```logql
   {service="openwebui"}
   ```

### Common Log Queries (LogQL)

```logql
# All Open WebUI logs
{service="openwebui"}

# Errors only
{service="openwebui"} | json | level="ERROR"

# Ollama connection errors
{service="openwebui"} | "Connection error"

# PostgreSQL logs
{service="postgres"}

# Redis operations
{service="redis"}

# Last 100 lines of Open WebUI
{service="openwebui"} | tail(100)

# Logs from last 5 minutes
{service="openwebui"} | since(5m)

# Filter by text
{service="openwebui"} | "model"

# Count errors
{service="openwebui"} | json | level="ERROR" | count()
```

## Health Check Dashboard

Create a simple Grafana dashboard to monitor all services:

```bash
# Check individual service health
curl http://localhost:3000/api/health           # Open WebUI
curl http://localhost:11434/api/tags             # Ollama
curl http://localhost:6379 -c PING               # Redis
curl http://localhost:6333/health                # Qdrant
curl http://localhost:9998/v1/meta               # Tika
curl http://localhost:8000/api/v1/heartbeat      # Chroma
curl http://localhost:9000/minio/health/live     # MinIO
```

## Troubleshooting

### Container Won't Start

```bash
# Check docker-compose logs
docker-compose logs -f

# Check specific service logs
docker-compose logs openwebui

# Restart service
docker-compose restart openwebui
```

### Network Issues (Containers Can't Talk)

```bash
# Verify network exists
docker network ls
docker network inspect agentnet

# All containers should be connected to 'agentnet'
docker inspect openwebui | grep -A 20 NetworkSettings
```

### No Logs Appearing in Loki

```bash
# Check Promtail is running
docker-compose ps promtail

# Check Promtail logs
docker-compose logs promtail

# Test Loki connectivity
curl http://localhost:3101/ready
```

### Can't Access Grafana

```bash
# Verify Grafana container running
docker ps | grep grafana

# Check Grafana logs
docker-compose logs grafana

# Restart
docker-compose restart grafana
```

## Backing Up Data

```bash
# PostgreSQL backup
docker-compose exec postgres pg_dump -U ${POSTGRES_USER:-admin} ${POSTGRES_DB:-agentdb} > backup.sql

# Redis backup (snapshot)
docker-compose exec redis redis-cli BGSAVE

# MinIO backup
docker-compose exec minio mc mirror /data ./backup/minio

# Full data directory
cp -r ./data ./backup/data-$(date +%Y%m%d)
```

## Production Recommendations

1. **Use named volumes instead of bind mounts**:
   ```yaml
   volumes:
     - postgres_data:/var/lib/postgresql/data
   ```

2. **Enable log rotation** in docker-compose:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

3. **Set resource limits** (already in compose files)

4. **Use health checks** for monitoring

5. **Set up automated backups**:
   ```bash
   # Daily backup cron job
   0 2 * * * docker-compose -f /path/docker-compose.yml exec postgres pg_dump -U admin agentdb > /backup/db-$(date +\%Y\%m\%d).sql
   ```

6. **Configure alerts** in Prometheus/Grafana for:
   - High error rates
   - Service downtime
   - Memory usage
   - Disk usage

## Quick Start Command

```bash
# One-line setup (assuming you're in the project directory)
docker-compose -f docker-compose.yml -f docker-compose.logging.yml up -d && \
docker-compose ps && \
echo "Open WebUI: http://localhost:3000" && \
echo "Logs: http://localhost:3100"
```
