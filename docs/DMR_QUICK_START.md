# Docker Model Runner - Quick Start Guide

## What You Just Got

A **complete integration** of Docker's native Model Runner with your Open WebUI stack:

- ✅ **Smart Model Router** - Automatically selects best model for each task
- ✅ **N8N Workflow** - Pre-built automation for DMR
- ✅ **Grafana Dashboard** - Real-time performance monitoring
- ✅ **Setup Scripts** - Automated Windows & Linux setup

## 🚀 Quick Start (5 minutes)

### On Windows (PowerShell)

```powershell
# Run the setup script
.\scripts\setup-dmr.ps1
```

### On Linux/Mac (Bash)

```bash
# Make script executable
chmod +x scripts/setup-dmr.sh

# Run the setup script
./scripts/setup-dmr.sh
```

### Or Manual Setup

```python
# Run the integration test
python3 scripts/setup-dmr-integration.py
```

## ✅ Verify Everything Works

### 1. Check Docker Model Runner
```bash
# See available models
curl http://host.docker.internal:50051/v1/models

# Test with a simple request
curl -X POST http://host.docker.internal:50051/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "devstral-small-2:latest",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### 2. Check Open WebUI
```bash
# Visit http://localhost:3000
# The Smart Router should automatically be active
```

### 3. Check N8N
```bash
# Visit http://localhost:5678
# Import the workflow from n8n-workflows/dmr-smart-ai-processing.json
```

### 4. Check Grafana
```bash
# Visit http://localhost:3100 (admin/admin)
# Import the dashboard from monitoring/dmr-dashboard.json
```

## 📊 Three Ways to Use DMR

### Method 1: Smart Router (Recommended)
```
User: "Write a Python function"
         ↓
Smart Router detects: CODING TASK
         ↓
Automatically uses: Devstral (optimized for code)
         ↓
Returns: High-quality code solution
```

### Method 2: N8N Workflow
```
Webhook Request
     ↓
Extract task type
     ↓
Route to appropriate model
     ↓
Save results to PostgreSQL
     ↓
Return response
```

### Method 3: Direct API Call
```bash
curl -X POST http://host.docker.internal:50051/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nemotron3:latest",
    "messages": [
      {"role": "user", "content": "Analyze sales data..."}
    ]
  }'
```

## 🎯 Real-World Examples

### Example 1: Code Generation (Automatic)
```
You: "Create a REST API in Python using FastAPI"
     ↓ [Smart Router detects: CODING]
     ↓ [Selects: devstral-small-2:latest]
System: Generates complete, production-ready FastAPI code
```

### Example 2: Data Analysis (Automatic)
```
You: "Analyze the Q3 sales performance trends"
     ↓ [Smart Router detects: ANALYSIS]
     ↓ [Selects: nemotron3:latest]
System: Provides detailed analysis with insights
```

### Example 3: N8N Workflow
```
Incoming request from external app
     ↓
N8N workflow receives via webhook
     ↓
Routes to appropriate DMR model
     ↓
Saves metrics to PostgreSQL
     ↓
Returns response with token usage
```

## 📈 Monitor Performance

### In Grafana
1. Go to http://localhost:3100 (admin/admin)
2. Click "Dashboards" → Find "Docker Model Runner"
3. See:
   - **Requests by Model** - Which models are used most
   - **Average Inference Time** - Response speed
   - **GPU Memory Usage** - Resource consumption
   - **Throughput** - Requests per second

### Watch Live Metrics
```bash
# Get active models
curl http://host.docker.internal:50051/v1/models | jq

# Get request metrics
docker logs grafana | grep dmr

# Monitor GPU (if available)
nvidia-smi
```

## 🔧 Configuration

### Smart Router Settings
Edit `config/webui/pipelines/smart_model_router.py`:

```python
self.valves = {
    # Prefer DMR models first
    "prefer_dmr": True,
    
    # Fallback to Ollama if DMR unavailable
    "fallback_to_ollama": True,
    
    # Model assignments
    "coding_model_dmr": "devstral-small-2:latest",
    "general_model_dmr": "nemotron3:latest",
    
    # Response settings
    "max_tokens": 1000,
    "temperature": 0.7,
    "timeout": 30,
}
```

### N8N Workflow Configuration
In N8N UI:
1. Open the DMR workflow
2. Click each HTTP Request node
3. Update model names if needed:
   - Coding tasks → `devstral-small-2:latest`
   - General tasks → `nemotron3:latest`

### Grafana Dashboard
Already configured for:
- Prometheus data source
- DMR metrics
- Query visualizations

## 🐛 Troubleshooting

### DMR Not Showing Models
```bash
# Check if Docker Desktop Models are loaded
docker model ls

# If empty, download in Docker Desktop:
# - Open Docker Desktop
# - Click "Models"
# - Download devstral and nemotron

# Test endpoint
curl http://host.docker.internal:50051/v1/models
```

### Open WebUI Can't Find Models
```bash
# Restart Open WebUI
docker-compose restart openwebui

# Check logs
docker logs openwebui | grep -i dmr

# Verify pipeline loaded
docker exec openwebui ls /app/backend/pipelines/
```

### N8N Workflow Not Working
```bash
# Check N8N logs
docker logs n8n

# Verify webhook is reachable
curl http://host.docker.internal:5678/webhook/webhook-dmr-001

# Test model endpoint from N8N:
# Add debug node and log responses
```

### Grafana Dashboard Empty
```bash
# Verify Prometheus configured
curl http://localhost:9090/api/v1/targets

# Check if metrics are being collected
curl http://localhost:9090/api/v1/query?query=dmr_requests_total
```

## 📚 File Reference

| File | Purpose |
|------|---------|
| `scripts/setup-dmr-integration.py` | Python setup & testing |
| `scripts/setup-dmr.sh` | Linux/Mac setup (automated) |
| `scripts/setup-dmr.ps1` | Windows PowerShell setup |
| `config/webui/pipelines/smart_model_router.py` | Smart routing logic |
| `n8n-workflows/dmr-smart-ai-processing.json` | N8N workflow |
| `monitoring/dmr-dashboard.json` | Grafana dashboard |
| `DOCKER_MODEL_RUNNER_GUIDE.md` | Detailed documentation |

## ⚡ Performance Tips

1. **Preload Models**
   - Download frequently-used models in Docker Desktop
   - Models stay in memory for faster startup

2. **Use Appropriate Model**
   - Devstral (23.5GB) - Coding tasks only
   - Nemotron (22.2GB) - Everything else
   - Save resources by routing correctly

3. **Monitor GPU**
   - Use `nvidia-smi` to watch GPU utilization
   - Scale up/down based on usage

4. **Cache Responses**
   - N8N workflow can cache common queries
   - Redis caches session data

5. **Load Balance**
   - For high traffic, run multiple DMR instances
   - Kong gateway distributes load

## 🎓 What Happens Behind the Scenes

```
User Input
    ↓
[Smart Router Pipeline]
    - Analyzes message
    - Detects task type
    - Selects best model
    ↓
[Docker Model Runner API]
    - Routes to selected model
    - Loads if not in memory
    - Runs inference on GPU
    ↓
[Response Processing]
    - Streams tokens back
    - Counts usage
    - Records metrics
    ↓
[Monitoring]
    - Prometheus scrapes metrics
    - Grafana visualizes
    - N8N logs to database
    ↓
User Sees Response
```

## 🚀 Next Steps

1. ✅ Run setup script (already done above)
2. ✅ Test in Open WebUI at http://localhost:3000
3. ✅ Import N8N workflow at http://localhost:5678
4. ✅ View metrics in Grafana at http://localhost:3100
5. 🔄 Use the routing intelligence:
   - Ask for code → Gets Devstral
   - Ask for analysis → Gets Nemotron
   - Ask general question → Gets smart routing

## 📞 Support

Check these for help:
- `DOCKER_MODEL_RUNNER_GUIDE.md` - Detailed guide
- `ENTERPRISE_SETUP.md` - Advanced features
- `QUICK_START.md` - General setup
- Container logs: `docker logs openwebui | grep -i error`

## ✨ You're All Set!

Your Docker Model Runner integration is ready to:
- ✅ Automatically select best models
- ✅ Route N8N workflows intelligently  
- ✅ Monitor performance in real-time
- ✅ Scale with your workload

Start using it now at **http://localhost:3000**!
