# Martin's Personal Assistant Dashboard

A fully-functional, production-grade PA dashboard built with all your container integrations. Office 365 email, WhatsApp messaging, Ollama AI, task management, and more—all in one place.

## 🎯 Features

### Core Dashboard
- **📊 Dashboard**: Real-time statistics, service health, activity feed, quick AI assistant
- **📧 Office 365 Email**: Integrated inbox with full email viewing (Microsoft Graph API ready)
- **💬 WhatsApp Messaging**: Live chat via WAHA (WhatsApp Web Automation) integration
- **✓ Task Management**: Create, filter, and track tasks by status/date
- **🧠 Memory & Notes**: Save and search notes with full-text search
- **💭 AI Chat**: Direct interface to Ollama LLM via your PA service
- **🔗 Integrations**: Real-time health status of all services

### Integrations
- ✅ Ollama (local LLM inference)
- ✅ Open WebUI (Ollama web interface)
- ✅ n8n (workflow automation)
- ✅ PostgreSQL (primary database)
- ✅ Redis (caching & real-time)
- ✅ WAHA (WhatsApp Web Automation)
- ✅ Chroma (vector embeddings)
- ✅ MinIO (S3-compatible storage)
- ⏳ Office 365 (requires API setup)

## 🚀 Quick Start

### 1. Start Everything
```bash
cd C:\DeerpShit\Agentics
docker compose up -d
```

### 2. Access the Dashboard
Open your browser: **http://localhost:3001**

### 3. Configure Integrations

#### Office 365 (Email)
```bash
# Set in .env file
OFFICE365_CLIENT_ID=your_client_id
OFFICE365_CLIENT_SECRET=your_client_secret
```

Then in Dashboard → Settings, add your API credentials.

#### WhatsApp (WAHA)
The dashboard auto-connects to WAHA at `http://waha:3000`. Make sure WAHA container is running:
```bash
docker compose ps | grep waha
```

## 📂 Project Structure

```
dashboard/
├── index.html          # Frontend (dark theme, responsive)
├── styles.css          # Modern UI with animations
├── app.js              # Client-side logic & API calls
├── backend.py          # FastAPI service (bridges all integrations)
├── Dockerfile          # Container definition
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## 🔌 API Endpoints

### Dashboard Backend (runs on :8080)

**Health & Config**
```
GET /health                          # Service health check
GET /api/config                      # Dashboard configuration
GET /api/services/status             # Real-time service status
```

**Email**
```
GET /api/email/inbox                 # Fetch Outlook inbox
POST /api/email/send                 # Send email
```

**WhatsApp**
```
GET /api/whatsapp/chats              # Fetch chat list
POST /api/whatsapp/send              # Send message
```

**Tasks**
```
GET /api/tasks                       # Get all tasks
POST /api/tasks                      # Create new task
```

**Memory**
```
GET /api/memory/notes                # Get all notes
POST /api/memory/notes               # Save note
```

**AI Chat**
```
POST /api/chat/message               # Send message to Ollama
```

## 🎨 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Dashboard Frontend                  │
│              (HTML/CSS/JavaScript)                  │
│    - Dark theme with responsive layout             │
│    - Real-time stats & activity                    │
│    - Tab-based navigation                          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────────────────┐
│          Dashboard Backend (FastAPI)                 │
│    - CORS enabled for cross-domain requests        │
│    - Redis caching for performance                 │
│    - Service discovery & health checks             │
└──────────────────┬──────────────────────────────────┘
                   │ Internal network (agentnet)
        ┌──────────┼──────────────────┬───────────┐
        │          │                  │           │
┌───────▼──┐ ┌────▼──────┐  ┌────────▼──┐  ┌────▼──┐
│ PA Srv   │ │ Ollama    │  │ WAHA      │  │Redis  │
│ (8000)   │ │ (11434)   │  │ (3000)    │  │ (6379)│
└──────────┘ └───────────┘  └───────────┘  └───────┘
        ├──────────┼──────────────────┼───────────┤
        │          │                  │           │
└───────▼──┐ ┌────▼──────┐  ┌────────▼──┐  ┌────▼──┐
│ n8n      │ │ PostgreSQL│  │ Chroma    │  │MinIO  │
│ (5678)   │ │ (5432)    │  │ (8000)    │  │(9000) │
└──────────┘ └───────────┘  └───────────┘  └───────┘
```

## 💻 Development

### Local Frontend Development
```bash
# Edit HTML/CSS/JS in dashboard/
# Auto-reloaded via Docker volume mount
docker compose up dashboard
```

### Backend API Testing
```bash
# Test email endpoint
curl http://localhost:3001/api/email/inbox

# Test chat
curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!"}'

# Check service status
curl http://localhost:3001/api/services/status
```

## 🔐 Security Best Practices

### 1. API Keys
Store in `.env` (never in code):
```env
OFFICE365_CLIENT_ID=your_id
OFFICE365_CLIENT_SECRET=your_secret
```

### 2. CORS
Currently allows all origins (`*`) for development. In production:
```python
allow_origins=["https://yourdomain.com"]
```

### 3. Redis Persistence
Enabled in compose with `appendonly yes` for data safety.

### 4. Database
PostgreSQL runs with default credentials from `.env`. Change in production:
```env
POSTGRES_USER=secure_user
POSTGRES_PASSWORD=strong_password
```

## 📊 Monitoring

### View Logs
```bash
# Dashboard logs
docker logs agentics-dashboard

# PA service logs
docker logs pa-service

# Real-time log stream
docker compose logs -f dashboard
```

### Resource Usage
```bash
# Check container stats
docker stats agentics-dashboard

# Memory limit: 1GB (can adjust in docker-compose.yml)
```

## 🛠️ Troubleshooting

### Dashboard won't load
```bash
# Check if service is running
docker ps | grep dashboard

# Restart it
docker compose restart dashboard

# Check logs
docker logs agentics-dashboard
```

### Email not showing
- Set `OFFICE365_CLIENT_ID` and `OFFICE365_CLIENT_SECRET` in `.env`
- Go to Dashboard → Settings and add your credentials
- Currently using mock data as fallback

### WhatsApp not connecting
- Ensure WAHA container is running: `docker ps | grep waha`
- Check WAHA logs: `docker logs waha`
- Verify network: `docker network inspect agentnet`

### Services showing "error" status
- All services are optional; dashboard works with subset
- Check individual service logs
- Services auto-retry with exponential backoff

## 🚀 Performance Tips

1. **Redis Caching**: Dashboard caches emails, chats, tasks for 5 minutes
2. **Lazy Loading**: Tabs load data on-demand, not on startup
3. **Polling**: Dashboard polls PA service every 5 seconds (adjustable in app.js)
4. **CDN**: Chart.js and Axios loaded from CDN for speed

## 📝 Future Enhancements

- [ ] WebSocket support for real-time messages
- [ ] OAuth2 integration for Office 365
- [ ] Dark/Light theme toggle (UI ready, needs CSS)
- [ ] Notification center with sound alerts
- [ ] Export tasks/notes to PDF
- [ ] Calendar view for tasks
- [ ] Email thread support
- [ ] WhatsApp media sharing
- [ ] AI agent automation dashboard

## 🤝 Integration Examples

### Send Email from Command Line
```bash
curl -X POST http://localhost:3001/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Test",
    "body": "Hello!"
  }'
```

### Send WhatsApp from PA Service
```bash
# Via your PA service
curl -X POST http://localhost:8000/tools/send_whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "1234567890@s.whatsapp.net",
    "message": "Hi from PA!"
  }'
```

### Create Task Programmatically
```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:3001/api/tasks",
        json={
            "title": "Review proposal",
            "description": "Q3 sales proposal",
            "dueDate": "2026-06-01"
        }
    )
    print(response.json())
```

## 📞 Support

For issues or questions:
1. Check logs: `docker compose logs -f dashboard`
2. Verify all services running: `docker ps`
3. Test API directly: `curl http://localhost:3001/health`

---

**Built with ❤️ for Martin's Personal Assistant ecosystem**
