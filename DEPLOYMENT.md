# Agentics Deployment Guide

## Quick Start

### Development
```bash
# Uses docker-compose.override.yml automatically (lighter resources)
docker compose up -d
```

### Production
```bash
# Use production compose file with GPU and higher resource limits
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Variables

### Development
```bash
docker compose --env-file .env.dev up -d
```

### Production
```bash
# Fill in sensitive values first
export SECURE_POSTGRES_PASSWORD=your_secure_password
export SECURE_MINIO_PASSWORD=your_secure_password
export AZURE_CLIENT_ID=your_client_id
export AZURE_CLIENT_SECRET=your_client_secret
export AZURE_TENANT_ID=your_tenant_id

docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## GPU Configuration

### Prerequisites
- **NVIDIA GPU**: Install [NVIDIA Container Runtime](https://github.com/NVIDIA/nvidia-container-runtime)
- **AMD GPU**: Use `driver: amd` in docker-compose.yml
- **Intel GPU**: Use `driver: intel` in docker-compose.yml

### Check GPU availability
```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi
```

### Enable GPU in docker-compose.yml
Uncomment the GPU section in the `ollama` service:
```yaml
deploy:
  resources:
    devices:
      - driver: nvidia
        count: 1  # or 'all' for all GPUs
        capabilities: [gpu]
```

### Verify GPU is working
```bash
docker logs ollama | grep -i gpu
```

## Healthchecks

All services include healthchecks with:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start period**: 30-60 seconds (initial startup grace period)

Monitor service health:
```bash
docker compose ps
```

## Automated Backups

### Manual Backup
```bash
./backup.sh dev     # Backup development environment
./backup.sh prod    # Backup production environment
```

Backups include:
- PostgreSQL database dump
- Qdrant vector database
- MinIO object storage
- n8n workflows and configs
- Redis state (optional)

Backups are stored in `./backups/{environment}/` and compressed with gzip.

### Automated Daily Backups (Linux/macOS)
```bash
./setup-backups.sh
```

This configures a cron job to run backups daily at 2:00 AM.

View logs:
```bash
tail -f ./backups/cron.log
```

## Resource Limits

### Development (docker-compose.override.yml)
- Ollama: 2 CPU, 4GB RAM
- OpenWebUI: 1 CPU, 1.5GB RAM
- Qdrant: 0.75 CPU, 768MB RAM
- PostgreSQL: 1 CPU, 1GB RAM
- Total: ~6.5 CPU, ~8GB RAM

### Production (docker-compose.prod.yml)
- Ollama: 8 CPU, 16GB RAM (+ GPU)
- OpenWebUI: 3 CPU, 4GB RAM
- PostgreSQL: 3 CPU, 3GB RAM
- n8n: 2 CPU, 2GB RAM
- Qdrant: 2 CPU, 2GB RAM
- MinIO: 2 CPU, 2GB RAM
- Redis: 1 CPU, 1GB RAM
- Total: ~21 CPU, ~30GB RAM

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| OpenWebUI | 3000 | LLM web interface |
| Ollama | 11434 | LLM API |
| Qdrant | 6333/6334 | Vector database API/gRPC |
| n8n | 5678 | Workflow automation |
| MinIO API | 9000 | Object storage API |
| MinIO Console | 9001 | Object storage UI |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Caching/messaging |
| Nginx UI | 8088 | Support dashboard |

## Troubleshooting

### Check service status
```bash
docker compose ps
```

### View logs
```bash
docker compose logs -f [service_name]
```

### Verify healthchecks
```bash
docker inspect --format='{{json .State.Health}}' [container_name] | jq
```

### Disk usage
```bash
docker system df
```

### Memory/CPU stats
```bash
docker stats
```

## Production Checklist

- [ ] Use `.env.prod` with secure passwords
- [ ] Enable GPU if available (check `docker-compose.prod.yml`)
- [ ] Configure automated backups (`./setup-backups.sh`)
- [ ] Set up SSL/TLS reverse proxy (Nginx, Traefik, or CloudFlare)
- [ ] Configure firewall rules (only expose ports 80, 443 externally)
- [ ] Set up monitoring (Docker events, log aggregation)
- [ ] Regular backup verification (restore test)
- [ ] Monitor resource usage and adjust limits if needed
