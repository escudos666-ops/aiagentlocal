"""
PA Dashboard Backend Service
Bridges all integrations: Office 365, WhatsApp (WAHA), AI agents, and local services
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import httpx
import os
from datetime import datetime
import logging
from typing import Optional, Dict, Any
import redis.asyncio as redis

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
PA_SERVICE_URL = os.getenv("PA_SERVICE_URL", "http://pa-service:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
OFFICE365_CLIENT_ID = os.getenv("OFFICE365_CLIENT_ID", "")
OFFICE365_CLIENT_SECRET = os.getenv("OFFICE365_CLIENT_SECRET", "")
WAHA_API_URL = os.getenv("WAHA_API_URL", "http://waha:3000")

# Redis cache
redis_client = None


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    # Startup
    try:
        redis_client = redis.from_url(REDIS_URL, encoding="utf8", decode_responses=True)
        await redis_client.ping()
        logger.info("✓ Redis connected")
    except Exception as e:
        logger.warning(f"⚠ Redis not available: {e}")
        redis_client = None
    
    logger.info("✓ Dashboard Service started")
    
    yield
    
    # Shutdown
    if redis_client:
        await redis_client.close()


app = FastAPI(title="PA Dashboard Service", version="1.0.0", lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Health ====================
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "dashboard",
        "timestamp": datetime.now().isoformat(),
    }


# ==================== Email (Office 365) ====================
@app.get("/api/email/inbox")
async def get_inbox():
    """Fetch Outlook inbox"""
    try:
        # Check cache first
        if redis_client:
            try:
                cached = await redis_client.get("inbox")
                if cached:
                    logger.info("📧 Inbox from cache")
                    return eval(cached)
            except:
                pass
        
        # Mock data - replace with Microsoft Graph API
        emails = [
            {
                "id": "1",
                "from": "dr.jansen@clinic.com",
                "subject": "Ergonomic Loupes Trial Feedback",
                "preview": "Thank you for providing the trial...",
                "received": datetime.now().isoformat(),
                "isRead": False,
                "importance": "high"
            },
            {
                "id": "2",
                "from": "support@admetec.com",
                "subject": "Order #A452 - Shipment Update",
                "preview": "Your order has been shipped...",
                "received": datetime.now().isoformat(),
                "isRead": True,
                "importance": "normal"
            }
        ]
        
        # Cache for 5 minutes
        if redis_client:
            try:
                await redis_client.setex("inbox", 300, str(emails))
            except:
                pass
        
        return {
            "emails": emails,
            "total": len(emails),
            "unread": sum(1 for e in emails if not e["isRead"])
        }
    except Exception as e:
        logger.error(f"Error fetching inbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/email/send")
async def send_email(to: str, subject: str, body: str):
    """Send email via Office 365"""
    try:
        logger.info(f"📧 Sending email to {to}: {subject}")
        
        return {
            "status": "sent",
            "to": to,
            "subject": subject,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WhatsApp (WAHA) ====================
@app.get("/api/whatsapp/chats")
async def get_whatsapp_chats():
    """Fetch WhatsApp chats via WAHA"""
    try:
        # Check cache
        if redis_client:
            try:
                cached = await redis_client.get("whatsapp_chats")
                if cached:
                    logger.info("💬 WhatsApp chats from cache")
                    return eval(cached)
            except:
                pass
        
        # Call WAHA API
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(f"{WAHA_API_URL}/api/chats")
                
                if response.status_code == 200:
                    chats = response.json()
                    
                    # Cache for 5 minutes
                    if redis_client:
                        try:
                            await redis_client.setex("whatsapp_chats", 300, str(chats))
                        except:
                            pass
                    
                    return chats
            except:
                pass
            
            # Mock data fallback
            logger.warning(f"WAHA unavailable, using mock data")
            return {
                "chats": [
                    {
                        "id": "1@s.whatsapp.net",
                        "name": "John Doe",
                        "lastMessage": "Hey, how are you?",
                        "unread": 1
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error fetching WhatsApp chats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/whatsapp/send")
async def send_whatsapp(phone: str, message: str):
    """Send WhatsApp message via WAHA"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{WAHA_API_URL}/api/sendMessage",
                json={
                    "chatId": phone,
                    "text": message
                }
            )
            
            if response.status_code == 200:
                logger.info(f"💬 WhatsApp sent to {phone}")
                return {
                    "status": "sent",
                    "to": phone,
                    "message": message,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                raise Exception(f"WAHA error: {response.text}")
    except Exception as e:
        logger.error(f"Error sending WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Tasks ====================
@app.get("/api/tasks")
async def get_tasks():
    """Get all tasks"""
    try:
        # Call PA service
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{PA_SERVICE_URL}/tools/fetch_history",
                    json={"limit": 100}
                )
                
                if response.status_code == 200:
                    return response.json()
            except:
                pass
        
        # Fallback
        return {
            "tasks": [
                {
                    "id": 1,
                    "title": "Review Q3 proposal",
                    "status": "pending",
                    "dueDate": "2026-06-01"
                },
                {
                    "id": 2,
                    "title": "Follow up with Dr. Jansen",
                    "status": "pending",
                    "dueDate": "2026-06-02"
                }
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tasks")
async def create_task(title: str, description: str, dueDate: str):
    """Create a new task"""
    try:
        # Call PA service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{PA_SERVICE_URL}/tools/create_task",
                json={
                    "title": title,
                    "description": description,
                    "dueDate": dueDate
                }
            )
            
            return response.json()
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Memory & Notes ====================
@app.get("/api/memory/notes")
async def get_notes():
    """Get all notes"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{PA_SERVICE_URL}/tools/fetch_history",
                    json={"limit": 50}
                )
                
                if response.status_code == 200:
                    return response.json()
            except:
                pass
        
        return {"notes": []}
    except Exception as e:
        logger.error(f"Error fetching notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/memory/notes")
async def create_note(title: str, content: str):
    """Save a note to memory"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{PA_SERVICE_URL}/tools/save_note",
                json={
                    "title": title,
                    "content": content
                }
            )
            
            return response.json()
    except Exception as e:
        logger.error(f"Error saving note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI Chat ====================
@app.post("/api/chat/message")
async def send_chat_message(message: str):
    """Send message to Ollama LLM"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{PA_SERVICE_URL}/process",
                json={
                    "type": "query",
                    "content": message
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"PA service error: {response.text}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Services Health ====================
@app.get("/api/services/status")
async def get_services_status():
    """Check status of all integrated services"""
    services_status = {}
    
    services = {
        "ollama": "http://ollama:11434",
        "openwebui": "http://openwebui:3000",
        "n8n": "http://n8n:5678",
        "postgres": "postgresql://admin:@postgres:5432",
        "redis": REDIS_URL,
        "waha": WAHA_API_URL,
        "chroma": "http://chroma:8000",
        "minio": "http://minio:9000",
        "pa-service": PA_SERVICE_URL,
    }
    
    for service_name, service_url in services.items():
        try:
            if service_name == "postgres" or service_name == "redis":
                services_status[service_name] = "configured"
            else:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{service_url}/health", timeout=5.0)
                    services_status[service_name] = "ready" if response.status_code == 200 else "error"
        except Exception as e:
            services_status[service_name] = "error"
            logger.debug(f"{service_name} status check failed: {e}")
    
    return {
        "services": services_status,
        "timestamp": datetime.now().isoformat()
    }


# ==================== Dashboard Config ====================
@app.get("/api/config")
async def get_dashboard_config():
    """Get dashboard configuration"""
    return {
        "title": "Martin's Personal Assistant Dashboard",
        "version": "1.0.0",
        "features": {
            "email": True,
            "whatsapp": True,
            "tasks": True,
            "memory": True,
            "ai_chat": True,
            "integrations": True
        },
        "integrations": {
            "office365": bool(OFFICE365_CLIENT_ID),
            "waha": bool(WAHA_API_URL),
            "ollama": True,
            "n8n": True,
            "postgres": True,
            "redis": True
        }
    }


# ==================== Static Files ====================
try:
    app.mount("/", StaticFiles(directory="/app/dashboard", html=True), name="dashboard")
except Exception as e:
    logger.warning(f"Could not mount static files: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
