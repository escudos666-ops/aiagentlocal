import os
import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

MODEL_ID = os.getenv("HF_MODEL_ID", "HuggingFaceTB/SmolLM2-360M-Instruct")
HF_TOKEN = os.getenv("HUGGING_FACE_HUB_TOKEN") or None

app = FastAPI(title="Agentics Hugging Face API")

generator = None

class GenerateRequest(BaseModel):
    prompt: str
    max_new_tokens: int = 256
    temperature: float = 0.4

@app.on_event("startup")
def load_model():
    global generator

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_ID,
        token=HF_TOKEN,
        trust_remote_code=True
    )

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        token=HF_TOKEN,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )

    generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=-1
    )

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID
    }

@app.post("/generate")
def generate(req: GenerateRequest):
    output = generator(
        req.prompt,
        max_new_tokens=req.max_new_tokens,
        temperature=req.temperature,
        do_sample=True if req.temperature > 0 else False,
        return_full_text=False
    )

    return {
        "model": MODEL_ID,
        "text": output[0]["generated_text"]
    }
