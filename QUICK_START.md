# Your Enterprise Open WebUI Stack - Quick Start

## 🎯 What You Have Now

Your deployment includes:

### Core Services (Running)
- ✅ **Open WebUI** - AI chat interface on http://localhost:3000
- ✅ **Ollama** - Local model server (jovial_bhabha container)
- ✅ **PostgreSQL** - Relational database
- ✅ **Redis** - Cache & sessions
- ✅ **MinIO** - S3-compatible object storage
- ✅ **Qdrant** - Vector database
- ✅ **N8N** - Workflow automation
- ✅ **Grafana** - Monitoring & logging UI on http://localhost:3100
- ✅ **Loki** - Centralized log aggregation

### Administrative Interfaces

| Service | URL | Login | Purpose |
|---------|-----|-------|---------|
| **Open WebUI** | http://localhost:3000 | admin@localhost | Main AI interface |
| **Grafana (Logs)** | http://localhost:3100 | admin / admin | View all container logs |
| **MinIO** | http://localhost:9001 | admin / admin123 | File storage management |
| **N8N** | http://localhost:5678 | | Workflow automation |
| **Ollama API** | http://localhost:11434 | | Model server |
| **Redis** | localhost:6379 | | Cache/sessions |
| **PostgreSQL** | localhost:5432 | admin/admin | Database |

## 🚀 Next Steps - What to Do Now

### 1. **View All Logs in One Place** (Centralized Logging)
```bash
# Go to Grafana
http://localhost:3100

# Login: admin / admin
# Click "Explore" → Select Loki
# View logs from all containers
```

### 2. **Load Models into Ollama**
```bash
# List available models
docker exec jovial_bhabha ollama list

# Pull a new model (examples)
docker exec jovial_bhabha ollama pull llama2
docker exec jovial_bhabha ollama pull mistral
docker exec jovial_bhabha ollama pull neural-chat

# View in Open WebUI: http://localhost:3000
# Models appear automatically
```

### 3. **Upload Files to MinIO**
```bash
# MinIO Console: http://localhost:9001
# Login: admin / admin123
# Create bucket: webui
# Upload documents for vector search
```

### 4. **Create Workflows in N8N**
```bash
# N8N UI: http://localhost:5678
# Build automations connecting:
# - Open WebUI for AI processing
# - MinIO for file storage
# - PostgreSQL for data
# - Slack/Email for notifications
```

### 5. **Monitor Everything in Grafana**
```bash
# Grafana: http://localhost:3100
# Default dashboard shows:
# - Request counts
# - Error rates
# - Container health
# - Resource usage
```

## 📊 Viewing Logs by Service

### In Grafana (Easiest)
1. Go to http://localhost:3100
2. Click **Explore** (top left)
3. Use queries like:
   ```logql
   {container="openwebui"}
   {container="ollama"}
   {container="postgres"}
   {container="n8n"}
   ```

### In Docker CLI
```bash
# All Open WebUI logs
docker logs openwebui

# Ollama logs
docker logs jovial_bhabha

# PostgreSQL logs
docker logs postgres

# Follow logs (live stream)
docker logs -f openwebui
```

## 🔧 Common Tasks

### Add More Ollama Models
```bash
docker exec jovial_bhabha ollama pull mistral:7b
docker exec jovial_bhabha ollama pull neural-chat:7b-v3-2-q6_K
```

### Backup Your Data
```bash
# PostgreSQL backup
docker exec postgres pg_dump -U admin agentdb > backup.sql

# MinIO files
docker exec minio mc mirror /data ./minio-backup

# Full data directory
cp -r ./data ./backup-$(date +%Y%m%d)
```

### Restart Everything
```bash
docker-compose restart
```

### Stop Everything
```bash
docker-compose down
```

### Clean Up Old Logs
```bash
docker system prune -a
```

## 🎓 Feature Walkthroughs

### Using Open WebUI with Ollama
1. Go to http://localhost:3000
2. Login (admin@localhost / password)
3. Select model from top dropdown
4. Start chatting
5. Upload documents for knowledge base

### Creating an N8N Workflow
1. Go to http://localhost:5678
2. Click **New Workflow**
3. Add HTTP Request node pointing to Open WebUI
4. Add database node for PostgreSQL
5. Add notification node for email/Slack
6. Connect and activate

### Checking System Health
1. Go to http://localhost:3100 (Grafana)
2. Click **Explore**
3. Run query: `{job="docker"} | json | level="error"`
4. See only errors from all containers

## 📈 What's Production-Ready

✅ **Multi-instance deployment** - Scale with load balancer  
✅ **Centralized logging** - Grafana + Loki  
✅ **Database** - PostgreSQL with pgvector  
✅ **Object storage** - MinIO (S3-compatible)  
✅ **Vector search** - Qdrant  
✅ **Workflow automation** - N8N  
✅ **Model serving** - Ollama  
✅ **Caching & sessions** - Redis  
✅ **Health checks** - All services monitored  
✅ **Resource limits** - CPU & memory constrained  

## ❌ What Still Needs Setup

For production deployment:
- [ ] SSL/TLS certificates
- [ ] External database (RDS, Cloud SQL)
- [ ] Kubernetes deployment
- [ ] Backup automation
- [ ] Secret rotation (Vault)
- [ ] Identity management (LDAP/AD)
- [ ] Advanced monitoring (Prometheus)
- [ ] High availability setup

See `ENTERPRISE_SETUP.md` for all features.

## 🆘 Troubleshooting

### Open WebUI can't find models
```bash
# Check Ollama is running
docker ps | grep ollama

# Check connectivity
curl http://localhost:11434/api/tags

# Restart Open WebUI
docker restart openwebui
```

### Logs not appearing in Grafana
```bash
# Verify Loki running
curl http://localhost:3101/ready

# Check docker logs directly
docker logs openwebui | tail -20
```

### PostgreSQL won't start
```bash
docker logs postgres
# Look for permission or volume mount errors
```

### Out of disk space
```bash
# See what's using space
docker system df

# Clean up old images
docker image prune -a

# Clean up stopped containers
docker container prune
```

## 📚 Full Documentation

- **Multi-instance setup**: See `MULTI_INSTANCE_SETUP.md`
- **Enterprise features**: See `ENTERPRISE_SETUP.md`  
- **Custom extensions**: See `EXTENSIBILITY_GUIDE.md`
- **Architecture**: See `UNIFIED_SETUP_AND_LOGGING.md`

## 🎉 You're All Set!

Your Open WebUI deployment is now:
- **Running** - All core services active
- **Monitored** - Logs in Grafana
- **Scalable** - Ready for multi-instance
- **Extensible** - Pipelines, tools, workflows ready
- **Production-capable** - Enterprise features available

Start with Open WebUI at http://localhost:3000 and explore!

Questions? Check the docs or dive into any service:
- Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- N8N docs: https://docs.n8n.io
- Grafana docs: https://grafana.com/docs/grafana/latest
