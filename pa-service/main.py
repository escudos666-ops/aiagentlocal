"""
Martin's Personal Agent (PA) - Main Service
Orchestrates all sub-agents and tools
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import json
from typing import Optional, Dict, Any
from datetime import datetime
import logging

app = FastAPI(title="Martin's Personal Agent", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Service discovery
SERVICES = {
    "ollama": "http://ollama:11434",
    "openwebui": "http://openwebui:3000",
    "n8n": "http://n8n:5678",
    "browser_use": "http://browser-use-webui:7788",
    "postgres": "postgresql://admin:admin@postgres:5432/agentdb",
    "redis": "redis://redis:6379",
    "minio": "http://minio:9000",
    "chroma": "http://chroma:8000",
    "waha": "http://waha:3000",  # WhatsApp API
}

# Sub-agent endpoints
SUB_AGENTS = {
    "messaging": "http://pa-agent-messaging:8001",
    "memory": "http://pa-agent-memory:8002",
    "task": "http://pa-agent-task:8003",
    "browser": "http://pa-agent-browser:8004",
    "writing": "http://pa-agent-writing:8005",
}

# Agent state
agent_state = {
    "status": "active",
    "started_at": datetime.now().isoformat(),
    "sub_agents_ready": {},
    "last_action": None,
    "memory_context": {},
}


@app.on_event("startup")
async def startup_event():
    """Initialize PA and check sub-agents on startup"""
    logger.info("Personal Agent starting up...")
    
    # Check service health
    for service_name, service_url in SERVICES.items():
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                if service_name == "postgres":
                    logger.info(f"✓ {service_name} configured: {service_url}")
                elif service_name == "redis":
                    logger.info(f"✓ {service_name} configured: {service_url}")
                else:
                    response = await client.get(f"{service_url}/api/health", timeout=5.0)
                    if response.status_code == 200:
                        logger.info(f"✓ {service_name} is healthy")
                    else:
                        logger.warning(f"⚠ {service_name} returned {response.status_code}")
        except Exception as e:
            logger.warning(f"⚠ {service_name} not available yet: {str(e)}")
    
    logger.info("Personal Agent ready!")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "martin-pa",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/status")
async def get_status():
    """Get PA status and sub-agent readiness"""
    return {
        "status": agent_state["status"],
        "started_at": agent_state["started_at"],
        "sub_agents": SUB_AGENTS,
        "services": {k: v for k, v in SERVICES.items() if k != "postgres"},
        "last_action": agent_state["last_action"],
    }


@app.post("/process")
async def process_command(command: Dict[str, Any]):
    """
    Main entry point for commands from Martin
    Routes to appropriate sub-agent
    """
    command_type = command.get("type")
    intent = command.get("intent")
    content = command.get("content")
    
    logger.info(f"Processing command: type={command_type}, intent={intent}")
    
    # Route to appropriate sub-agent
    if intent == "message" or intent == "send_whatsapp":
        return await call_sub_agent("messaging", command)
    elif intent == "memory" or intent == "save_note":
        return await call_sub_agent("memory", command)
    elif intent == "task" or intent == "create_task":
        return await call_sub_agent("task", command)
    elif intent == "browse" or intent == "browser":
        return await call_sub_agent("browser", command)
    elif intent == "write" or intent == "compose":
        return await call_sub_agent("writing", command)
    else:
        # Default: route to Ollama via OpenWebUI
        return await call_llm(command)


async def call_sub_agent(agent_name: str, command: Dict[str, Any]):
    """Call a sub-agent with the command"""
    try:
        agent_url = SUB_AGENTS.get(agent_name)
        if not agent_url:
            raise HTTPException(status_code=404, detail=f"Sub-agent {agent_name} not found")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{agent_url}/process",
                json=command,
            )
            response.raise_for_status()
            
            result = response.json()
            agent_state["last_action"] = {
                "agent": agent_name,
                "timestamp": datetime.now().isoformat(),
                "status": "success",
            }
            
            return result
    except Exception as e:
        logger.error(f"Error calling sub-agent {agent_name}: {str(e)}")
        agent_state["last_action"] = {
            "agent": agent_name,
            "timestamp": datetime.now().isoformat(),
            "status": "error",
            "error": str(e),
        }
        raise HTTPException(status_code=500, detail=str(e))


async def call_llm(command: Dict[str, Any]):
    """Call Ollama LLM for general questions"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Call Ollama via OpenWebUI
            response = await client.post(
                f"{SERVICES['ollama']}/api/generate",
                json={
                    "model": "neural-chat:latest",
                    "prompt": command.get("content", ""),
                    "stream": False,
                },
            )
            response.raise_for_status()
            
            result = response.json()
            return {
                "agent": "ollama",
                "response": result.get("response"),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error calling LLM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/{tool_name}")
async def execute_tool(tool_name: str, payload: Dict[str, Any]):
    """Execute a specific tool"""
    logger.info(f"Executing tool: {tool_name}")
    
    # Tool routing
    if tool_name == "send_whatsapp":
        return await tool_send_whatsapp(payload)
    elif tool_name == "read_whatsapp":
        return await tool_read_whatsapp(payload)
    elif tool_name == "save_note":
        return await tool_save_note(payload)
    elif tool_name == "fetch_history":
        return await tool_fetch_history(payload)
    elif tool_name == "create_task":
        return await tool_create_task(payload)
    else:
        raise HTTPException(status_code=404, detail=f"Tool {tool_name} not found")


async def tool_send_whatsapp(payload: Dict[str, Any]):
    """Send a WhatsApp message via WAHA"""
    try:
        phone = payload.get("phone")
        message = payload.get("message")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{SERVICES['waha']}/api/sendMessage",
                json={
                    "chatId": phone,
                    "text": message,
                },
            )
            response.raise_for_status()
            return {
                "status": "sent",
                "phone": phone,
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def tool_read_whatsapp(payload: Dict[str, Any]):
    """Read WhatsApp messages from WAHA"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SERVICES['waha']}/api/getMessages",
                params={"chatId": payload.get("chat_id")},
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Error reading WhatsApp messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def tool_save_note(payload: Dict[str, Any]):
    """Save a note to memory (Postgres)"""
    try:
        note_content = payload.get("content")
        note_title = payload.get("title", "Untitled")
        
        # For now, return success
        # In production, this would write to Postgres
        return {
            "status": "saved",
            "title": note_title,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error saving note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def tool_fetch_history(payload: Dict[str, Any]):
    """Fetch conversation history from memory"""
    try:
        limit = payload.get("limit", 10)
        
        # For now, return empty list
        # In production, this would query Postgres
        return {
            "history": [],
            "limit": limit,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def tool_create_task(payload: Dict[str, Any]):
    """Create a task in task management system"""
    try:
        task_title = payload.get("title")
        task_description = payload.get("description")
        
        return {
            "status": "created",
            "title": task_title,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
