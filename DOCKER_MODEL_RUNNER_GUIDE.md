# Docker Model Runner Integration Guide

## What is Docker Model Runner?

Docker Model Runner (DMR) is Docker's native solution for:
- Running AI models as isolated containers
- Managing multiple model instances
- Auto-scaling based on demand
- Direct integration with Docker Desktop
- Native GPU support
- Built-in model management UI

## Integration with Your Open WebUI Stack

Your Docker Desktop already shows the Models view with access to:
- `devstral-small-2:latest` — Fast code model (23.57B)
- `nemotron3:latest` — Powerful instruction-tuned model (22.28B)

### Step 1: Enable Docker Model Runner in Open WebUI

```bash
# SSH into openwebui container or edit environment
docker exec openwebui bash -c 'cat >> /app/backend/.env << EOF
# Docker Model Runner Integration
DMR_ENABLED=true
DMR_HOST=host.docker.internal
DMR_PORT=50051
DMR_MODELS=devstral-small-2,nemotron3
EOF'

# Restart Open WebUI
docker restart openwebui
```

### Step 2: Configure Open WebUI to Use DMR Models

Add to Open WebUI admin panel:

1. Go to http://localhost:3000/admin/settings
2. Add model provider:
```json
{
  "name": "Docker Model Runner",
  "type": "dmr",
  "api_base": "http://host.docker.internal:50051",
  "models": [
    "devstral-small-2:latest",
    "nemotron3:latest"
  ],
  "enabled": true
}
```

### Step 3: Use DMR Models in Workflows

#### N8N Integration
```json
{
  "name": "Call Docker Model Runner",
  "type": "httpRequest",
  "typeVersion": 4.1,
  "parameters": {
    "url": "http://host.docker.internal:50051/v1/chat/completions",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "model": "{{ $json.model || 'devstral-small-2:latest' }}",
      "messages": [
        {
          "role": "user",
          "content": "{{ $json.prompt }}"
        }
      ],
      "temperature": 0.7,
      "max_tokens": 1000
    }
  }
}
```

#### Custom Pipeline
```python
# pipelines/docker_model_runner.py
import requests
from typing import Generator

class Pipeline:
    def __init__(self):
        self.name = "Docker Model Runner Pipeline"
        self.valves = {
            "dmr_host": "host.docker.internal",
            "dmr_port": 50051,
            "default_model": "devstral-small-2:latest",
            "temperature": 0.7,
            "max_tokens": 1000,
        }

    async def query_dmr(self, model: str, messages: list) -> str:
        """Query Docker Model Runner"""
        url = f"http://{self.valves['dmr_host']}:{self.valves['dmr_port']}/v1/chat/completions"
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": self.valves["temperature"],
            "max_tokens": self.valves["max_tokens"],
        }
        
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error querying DMR: {str(e)}"

    def pipe(
        self, user_message: str, model_id: str, messages: list, body: dict
    ) -> Generator[str, None, None]:
        """
        Stream responses from Docker Model Runner
        """
        # Default to devstral for coding tasks, nemotron for general tasks
        if "code" in user_message.lower() or "function" in user_message.lower():
            selected_model = "devstral-small-2:latest"
        else:
            selected_model = "nemotron3:latest"

        try:
            # Query DMR
            response = await self.query_dmr(selected_model, messages)
            yield response
        except Exception as e:
            yield f"Error: {str(e)}"
```

## Docker Model Runner vs Ollama

| Feature | DMR | Ollama |
|---------|-----|--------|
| **Native to Docker** | ✅ Yes | ❌ Separate |
| **GUI Management** | ✅ Docker Desktop | ❌ CLI only |
| **Auto-scaling** | ✅ Yes | ❌ Manual |
| **Model versioning** | ✅ Built-in | ⚠️ Manual |
| **GPU Support** | ✅ Native | ✅ Native |
| **Easy switching** | ✅ Instant | ⚠️ Requires reload |
| **Production ready** | ✅ Yes | ✅ Yes |
| **Multi-instance** | ✅ Yes | ✅ Yes |

## Using Both DMR and Ollama Together

Your stack can use **both simultaneously**:

```yaml
# docker-compose.yml addition
services:
  openwebui:
    environment:
      # Both providers available
      - OLLAMA_API_BASE=http://ollama:11434
      - DMR_API_BASE=http://host.docker.internal:50051
      - DMR_ENABLED=true
      - MULTI_MODEL_ROUTING=true
```

### Intelligent Model Routing
```python
# pipelines/smart_model_routing.py
class Pipeline:
    def __init__(self):
        self.name = "Smart Model Routing"
        self.providers = {
            "fast": {"type": "dmr", "model": "devstral-small-2:latest"},
            "powerful": {"type": "dmr", "model": "nemotron3:latest"},
            "local": {"type": "ollama", "model": "mistral"},
            "coding": {"type": "dmr", "model": "devstral-small-2:latest"},
            "analysis": {"type": "ollama", "model": "neural-chat"},
        }

    def route_to_best_model(self, task: str, user_message: str) -> dict:
        """Route to the best model for the task"""
        keywords = {
            "coding": ["code", "function", "debug", "algorithm", "python", "javascript"],
            "analysis": ["analyze", "summary", "report", "data", "statistics"],
            "fast": ["quick", "simple", "brief", "short"],
            "powerful": ["complex", "detailed", "reasoning", "explain"],
        }

        # Find best match
        for category, words in keywords.items():
            if any(word in user_message.lower() for word in words):
                return self.providers.get(category, self.providers["powerful"])
        
        # Default to powerful
        return self.providers["powerful"]

    def pipe(self, user_message: str, model_id: str, messages: list, body: dict):
        selected = self.route_to_best_model("task", user_message)
        
        if selected["type"] == "dmr":
            # Query Docker Model Runner
            yield f"[Using DMR: {selected['model']}]\n"
        else:
            # Query Ollama
            yield f"[Using Ollama: {selected['model']}]\n"
```

## Managing Models in Docker Desktop

### View Running Models
1. Open Docker Desktop
2. Click **Models** tab
3. See all available models with:
   - Memory usage
   - Model size
   - Last used time
   - Quick load/run buttons

### Preload Models for Fast Startup
```bash
# Start model in Docker Desktop UI
# Or via CLI:
docker model load devstral-small-2:latest
docker model load nemotron3:latest

# Check status
docker model ls
```

### Monitor Model Performance
```bash
# Real-time monitoring
docker model stats

# Detailed model info
docker model inspect devstral-small-2:latest

# Model logs
docker model logs devstral-small-2:latest
```

## Production Configuration for DMR

### Enable GPU Support
```yaml
services:
  docker-model-runner:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
        limits:
          memory: 24G
```

### Auto-scaling Config
```bash
# Allow DMR to scale instances based on load
DOCKER_MODEL_RUNNER_SCALING=enabled
DOCKER_MODEL_RUNNER_MIN_INSTANCES=1
DOCKER_MODEL_RUNNER_MAX_INSTANCES=4
DOCKER_MODEL_RUNNER_SCALE_THRESHOLD=0.8  # Scale up at 80% load
```

### Load Balancing
```python
# pipelines/load_balanced_dmr.py
import random

class Pipeline:
    def __init__(self):
        self.name = "Load-Balanced DMR"
        self.dmr_instances = [
            "http://dmr-1:50051",
            "http://dmr-2:50051",
            "http://dmr-3:50051",
        ]
        self.current_instance = 0

    def get_next_instance(self) -> str:
        """Round-robin load balancing"""
        instance = self.dmr_instances[self.current_instance]
        self.current_instance = (self.current_instance + 1) % len(self.dmr_instances)
        return instance

    def pipe(self, user_message: str, model_id: str, messages: list, body: dict):
        # Get next instance in rotation
        endpoint = self.get_next_instance()
        # Query that instance...
```

## Monitoring DMR in Your Stack

### Add to Prometheus
```yaml
# monitoring/prometheus.yml
scrape_configs:
  - job_name: 'docker-model-runner'
    static_configs:
      - targets: ['host.docker.internal:9090']
    metrics_path: '/v1/metrics'
```

### Grafana Dashboard for DMR
```json
{
  "dashboard": {
    "title": "Docker Model Runner",
    "panels": [
      {
        "title": "Active Models",
        "targets": [
          {
            "expr": "dmr_active_models"
          }
        ]
      },
      {
        "title": "Average Inference Time",
        "targets": [
          {
            "expr": "avg(dmr_inference_duration_seconds)"
          }
        ]
      },
      {
        "title": "GPU Memory Usage",
        "targets": [
          {
            "expr": "dmr_gpu_memory_bytes"
          }
        ]
      },
      {
        "title": "Throughput (req/sec)",
        "targets": [
          {
            "expr": "rate(dmr_requests_total[1m])"
          }
        ]
      }
    ]
  }
}
```

## Next Steps

1. **Download more models** via Docker Desktop:
   - Click Models tab
   - Browse available models
   - Click to download/run

2. **Set up model routing** in Open WebUI:
   - Create pipelines that intelligently choose between DMR and Ollama
   - Route coding tasks to Devstral
   - Route general tasks to Nemotron

3. **Monitor performance**:
   - Track model response times
   - Monitor GPU usage
   - Optimize model selection

4. **Scale for production**:
   - Use load balancing across DMR instances
   - Enable auto-scaling based on demand
   - Implement caching for common queries

## Troubleshooting DMR

### Models not appearing in Open WebUI
```bash
# Check DMR is running
curl http://host.docker.internal:50051/v1/models

# Verify Open WebUI can reach DMR
docker exec openwebui curl http://host.docker.internal:50051/v1/models

# Check logs
docker logs docker-model-runner
```

### High latency
```bash
# Check GPU utilization
nvidia-smi

# Monitor DMR performance
docker model stats

# Check for CPU throttling
docker stats --no-stream
```

### Out of memory
```bash
# List loaded models
docker model ls

# Unload unused models
docker model unload unused-model:latest

# Increase system memory or reduce model size
```

## Performance Tips

1. **Preload frequently-used models** on startup
2. **Use smaller quantizations** for faster inference
3. **Batch requests** for better throughput
4. **Monitor and cache responses** in Redis
5. **Use appropriate model for task complexity**
