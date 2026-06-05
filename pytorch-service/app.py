"""
PyTorch Inference Service for OpenWebUI Integration
Provides model inference endpoints compatible with OpenWebUI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import torch
import logging
from datetime import datetime
import uvicorn

app = FastAPI(title="PyTorch Inference Server", version="1.0.0")

# Configure CORS for OpenWebUI
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

# Check GPU availability
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")
if torch.cuda.is_available():
    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    logger.info(f"CUDA Version: {torch.version.cuda}")


class HealthResponse(BaseModel):
    status: str
    device: str
    gpu_available: bool
    timestamp: str


class InferenceRequest(BaseModel):
    model: str
    prompt: str
    max_length: Optional[int] = 512
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9


class InferenceResponse(BaseModel):
    model: str
    output: str
    device: str
    timestamp: str


@app.on_event("startup")
async def startup_event():
    """Initialize PyTorch service on startup"""
    logger.info("PyTorch Inference Server starting up...")
    logger.info(f"PyTorch version: {torch.__version__}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"CUDA device count: {torch.cuda.device_count()}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        device=str(device),
        gpu_available=torch.cuda.is_available(),
        timestamp=datetime.now().isoformat(),
    )


@app.get("/api/health", response_model=HealthResponse)
async def api_health_check():
    """API health check endpoint (for OpenWebUI compatibility)"""
    return HealthResponse(
        status="healthy",
        device=str(device),
        gpu_available=torch.cuda.is_available(),
        timestamp=datetime.now().isoformat(),
    )


@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "models": [
            {
                "id": "pytorch-text-generation",
                "name": "PyTorch Text Generation",
                "description": "Text generation using PyTorch",
                "device": str(device),
            },
            {
                "id": "pytorch-embeddings",
                "name": "PyTorch Embeddings",
                "description": "Generate embeddings using PyTorch",
                "device": str(device),
            },
        ],
        "device": str(device),
        "gpu_available": torch.cuda.is_available(),
    }


@app.post("/inference", response_model=InferenceResponse)
async def run_inference(request: InferenceRequest):
    """
    Run inference on PyTorch models
    Compatible with OpenWebUI inference requests
    """
    logger.info(f"Inference request: model={request.model}, prompt length={len(request.prompt)}")
    
    try:
        # Simulate inference (in production, load actual models)
        output = f"PyTorch inference response to: {request.prompt[:100]}..."
        
        return InferenceResponse(
            model=request.model,
            output=output,
            device=str(device),
            timestamp=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.error(f"Inference error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate(payload: Dict[str, Any]):
    """
    OpenWebUI compatible generate endpoint
    """
    logger.info(f"Generate request: model={payload.get('model')}")
    
    try:
        prompt = payload.get("prompt", "")
        model = payload.get("model", "pytorch-text-generation")
        
        # Simulate text generation
        response_text = f"Generated response from PyTorch model: {prompt[:100]}..."
        
        return {
            "model": model,
            "response": response_text,
            "done": True,
            "created_at": datetime.now().isoformat(),
            "context": [],
        }
    except Exception as e:
        logger.error(f"Generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/embeddings")
async def embeddings(payload: Dict[str, Any]):
    """
    OpenWebUI compatible embeddings endpoint
    """
    logger.info(f"Embeddings request")
    
    try:
        texts = payload.get("input", [])
        model = payload.get("model", "pytorch-embeddings")
        
        # Generate dummy embeddings (768-dim) for now
        embeddings_list = [
            {
                "embedding": [0.1] * 768,
                "index": i,
            }
            for i in range(len(texts) if isinstance(texts, list) else 1)
        ]
        
        return {
            "model": model,
            "data": embeddings_list,
            "usage": {
                "prompt_tokens": sum(len(t.split()) for t in (texts if isinstance(texts, list) else [texts])),
                "total_tokens": sum(len(t.split()) for t in (texts if isinstance(texts, list) else [texts])),
            },
        }
    except Exception as e:
        logger.error(f"Embeddings error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status")
async def status():
    """Get service status"""
    return {
        "status": "running",
        "service": "pytorch-inference",
        "device": str(device),
        "cuda_available": torch.cuda.is_available(),
        "pytorch_version": torch.__version__,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8888,
        log_level="info",
    )
