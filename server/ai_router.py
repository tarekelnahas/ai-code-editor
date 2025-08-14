from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx, os, json

router = APIRouter()

CONFIG_PATH = os.path.join(os.getenv("LOCALAPPDATA",""), "AIEditor", "config.json")
DEFAULT_ROLES = {"completion":"deepseek-coder:latest","general":"dolphin-phi:latest","planner":"smollm:1.7b"}
FALLBACKS = {
    "completion": ["deepseek-coder:latest","codegemma:2b","smollm:1.7b","dolphin-phi:latest"],
    "general":    ["dolphin-phi:latest","smollm:1.7b","deepseek-coder:latest","codegemma:2b"],
    "planner":    ["smollm:1.7b","dolphin-phi:latest","deepseek-coder:latest","codegemma:2b"],
}

def load_cfg():
    try:
        with open(CONFIG_PATH,"r",encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}

def load_roles() -> dict:
    cfg = load_cfg()
    roles = ((cfg.get("ai") or {}).get("roles") or {}) or {}
    merged = {**DEFAULT_ROLES, **roles}
    return merged

async def list_available_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://127.0.0.1:11434/api/tags")
            r.raise_for_status()
            data = r.json()
            return [m.get("name") for m in (data or {}).get("models", []) if m.get("name")]
    except Exception:
        return []

def select_model(role: str|None, explicit: str|None, available: list[str]) -> str:
    # explicit model if available
    if explicit and explicit in available:
        return explicit
    role = (role or "general").lower()
    roles = load_roles()
    # role-preferred if available
    pref = roles.get(role)
    if pref in available:
        return pref
    # fallbacks for the role
    for m in FALLBACKS.get(role, []):
        if m in available:
            return m
    # last resort
    return available[0] if available else (pref or DEFAULT_ROLES["general"])

class MetaRes(BaseModel):
    roles: dict
    available: list[str]

@router.get("/ai/meta", response_model=MetaRes)
async def ai_meta():
    return {"roles": load_roles(), "available": await list_available_models()}

class CompleteReq(BaseModel):
    prompt: str
    role: str | None = "general"
    model: str | None = None

class CompleteRes(BaseModel):
    model: str
    content: str

@router.post("/ai/complete", response_model=CompleteRes)
async def ai_complete(req: CompleteReq):
    available = await list_available_models()
    model = select_model(req.role, req.model, available)
    body = {"model": model, "prompt": req.prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post("http://127.0.0.1:11434/api/generate", json=body)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e}")
    return {"model": model, "content": (data or {}).get("response","")}