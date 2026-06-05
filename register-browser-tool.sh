#!/bin/bash
# Script to register Browser-Use tool in Open WebUI

# Browser-Use Tool for Open WebUI
curl -X POST http://localhost:3000/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "browser_use",
    "displayName": "Browser Use",
    "description": "Execute browser automation tasks - browse websites, fill forms, click buttons",
    "enabled": true,
    "model": "neural-chat:latest",
    "endpoint": "http://n8n:5678/webhook/browser-task",
    "auth_required": false,
    "tags": ["browser", "automation", "web"]
  }'

echo "Browser-Use tool registered in Open WebUI"
