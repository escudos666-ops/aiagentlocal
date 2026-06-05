#!/bin/bash
# Register Personal Agent as a tool in Open WebUI

OPENWEBUI_URL="http://localhost:3000"
PA_WEBHOOK_URL="http://localhost:5678/webhook/martin-command"
PA_API_URL="http://localhost:8000"

echo "Registering Martin's Personal Agent with Open WebUI..."

# 1. Register PA as a tool in Open WebUI
curl -X POST "$OPENWEBUI_URL/api/tools" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "personal_agent",
    "displayName": "Martin Personal Agent",
    "description": "Martin'\''s Personal Agent - Execute commands, manage tasks, send messages, and more",
    "enabled": true,
    "model": "neural-chat:latest",
    "endpoint": "'$PA_API_URL'",
    "auth_required": false,
    "tags": ["agent", "personal", "tools"],
    "icon": "🤖"
  }' 2>/dev/null

echo "✓ PA tool registered"

# 2. Register PA as a backend connector
curl -X POST "$OPENWEBUI_URL/api/backends" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "personal_agent_backend",
    "type": "external_api",
    "url": "'$PA_API_URL'",
    "description": "Martin'\''s Personal Agent Backend",
    "enabled": true,
    "config": {
      "health_endpoint": "/health",
      "process_endpoint": "/process"
    }
  }' 2>/dev/null

echo "✓ PA backend registered"

# 3. Create custom system prompt for PA in Open WebUI
curl -X POST "$OPENWEBUI_URL/api/prompts" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Martin Personal Agent System Prompt",
    "content": "You are Martin'\''s Personal Agent (PA). Your role is to:\n\n1. Process commands and intents from Martin\n2. Route requests to appropriate sub-agents (messaging, memory, task, browser, writing)\n3. Execute tools (send WhatsApp, save notes, create tasks, browse web)\n4. Maintain context from previous conversations\n5. Proactively help Martin with his priorities\n\nAvailable intents: message, memory, task, browse, write, question\nAvailable tools: send_whatsapp, read_whatsapp, save_note, fetch_history, create_task\n\nAlways respond clearly and ask for clarification if needed."
  }' 2>/dev/null

echo "✓ PA system prompt created"

echo ""
echo "Integration complete!"
echo ""
echo "Open WebUI PA Tool Endpoints:"
echo "  Main: $PA_API_URL/process"
echo "  Health: $PA_API_URL/health"
echo "  Status: $PA_API_URL/status"
echo ""
echo "Next steps:"
echo "  1. Go to Open WebUI (http://localhost:3000)"
echo "  2. Chat with neural-chat model"
echo "  3. The model will have access to PA tools"
echo "  4. Test: 'Send a WhatsApp message' or 'Create a task for me'"
