from __future__ import annotations
import os, json, time, asyncio
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import keyring
from diskcache import Cache
from pathlib import Path
from utils.security import SecurityValidator, require_safe_execution

router = APIRouter()
APPDATA = os.getenv("LOCALAPPDATA","")
CFG_DIR = os.path.join(APPDATA, "AIEditor")
CFG_PATH = os.path.join(CFG_DIR, "config.json")
CACHE_DIR = os.path.join(CFG_DIR, "cache")
Path(CFG_DIR).mkdir(parents=True, exist_ok=True)
Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)
cache = Cache(CACHE_DIR)

SERVICE = "MidoAIEditor"   # Windows Credential Manager service name

DEFAULT = {
  "network": {"allowExternalAI": True, "timeoutSec": 60},
  "ai": {
    "providers": ["ollama","openai","anthropic","openai_compat"],
    "offlineOnly": False,
    "priority": ["ollama","openai","anthropic","openai_compat"],
    "roles": {
      "completion": "deepseek-coder:latest",
      "general": "dolphin-phi:latest",
      "planner": "smollm:1.7b"
    },
    "remote": {
      "openai":     {"baseUrl": "https://api.openai.com/v1", "defaultModel": "gpt-4o-mini"},
      "anthropic":  {"baseUrl": "https://api.anthropic.com/v1", "defaultModel": "claude-3-5-haiku-20241022", "version":"2023-06-01"},
      "openai_compat": {"name":"moonshot", "baseUrl":"https://api.moonshot.cn/v1", "defaultModel":"moonshot-v1-8k"}
    }
  }
}

def load_cfg()->dict:
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: 
            j=json.load(f) or {}
    except: 
        j={}
    # merge shallow defaults
    out=json.loads(json.dumps(DEFAULT))
    def deepmerge(a,b):
        for k,v in b.items():
            if isinstance(v,dict): a[k]=deepmerge(a.get(k,{ }), v)
            else: a[k]=v
        return a
    return deepmerge(out, j)

def save_cfg(cfg:dict):
    Path(CFG_DIR).mkdir(parents=True, exist_ok=True)
    with open(CFG_PATH,"w",encoding="utf-8") as f: json.dump(cfg,f,indent=2)

def set_secret(name:str, value:str):
    keyring.set_password(SERVICE, name, value)

def get_secret(name:str)->Optional[str]:
    try:
        return keyring.get_password(SERVICE, name)
    except:
        return None

# ---------- Models ----------
class ProviderMeta(BaseModel):
    providers: List[str]
    available: List[str]
    roles: Dict[str,str]
    offlineOnly: bool
    priority: List[str]
    remote: Dict[str,Any]
    hasKeys: Dict[str,bool]
    allowExternalAI: bool
    timeoutSec: int

class SetKeyReq(BaseModel):
    provider: str  # "openai" | "anthropic" | "openai_compat"
    apiKey: str

class SetCfgReq(BaseModel):
    offlineOnly: Optional[bool] = None
    priority: Optional[List[str]] = None
    roles: Optional[Dict[str,str]] = None
    remote: Optional[Dict[str,Any]] = None
    allowExternalAI: Optional[bool] = None
    timeoutSec: Optional[int] = None

class RouteReq(BaseModel):
    prompt: str
    role: Optional[str] = "general"
    provider: Optional[str] = None    # force a provider
    model: Optional[str] = None       # force a model
    temperature: Optional[float] = 0.2
    cacheKey: Optional[str] = None

class RouteRes(BaseModel):
    provider: str
    model: str
    content: str
    cached: bool = False
    took_ms: int

# ---------- Core ----------
def detect_ollama_models()->List[str]:
    try:
        import requests
        r = requests.get("http://127.0.0.1:11434/api/tags", timeout=1.5)
        return [m["name"] for m in (r.json().get("models") or [])]
    except: 
        return []

async def call_ollama(model:str, prompt:str, temperature:float, timeout:int)->str:
    body={"model": model, "prompt": prompt, "stream": False, "options":{"temperature": temperature}}
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post("http://127.0.0.1:11434/api/generate", json=body)
        r.raise_for_status()
        return (r.json() or {}).get("response","")

async def call_openai(base:str, key:str, model:str, prompt:str, temperature:float, timeout:int)->str:
    url = base.rstrip("/") + "/chat/completions"
    headers={"Authorization": f"Bearer {key}"}
    payload={"model": model, "temperature": temperature, "messages":[{"role":"system","content":"You are a helpful coding assistant."},{"role":"user","content":prompt}]}
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(url, headers=headers, json=payload)
        r.raise_for_status()
        j=r.json()
        return j.get("choices",[{}])[0].get("message",{}).get("content","")

async def call_anthropic(base:str, key:str, version:str, model:str, prompt:str, temperature:float, timeout:int)->str:
    url = base.rstrip("/") + "/messages"
    headers={"x-api-key": key, "anthropic-version": version}
    payload={"model":model,"max_tokens":1024,"temperature":temperature,"messages":[{"role":"user","content":prompt}]}
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(url, headers=headers, json=payload)
        r.raise_for_status()
        j=r.json()
        # unify text extraction
        content = ""
        for blk in j.get("content",[]):
            if isinstance(blk,dict) and blk.get("type")=="text":
                content += blk.get("text","")
        return content

def has_key(name:str)->bool:
    return bool(get_secret(name) or "")

@router.get("/providers/meta", response_model=ProviderMeta)
def providers_meta():
    cfg = load_cfg()
    available = detect_ollama_models()
    hasKeys = {
        "openai": bool(get_secret("openai_api_key")),
        "anthropic": bool(get_secret("anthropic_api_key")),
        "openai_compat": bool(get_secret("openai_compat_api_key")),
    }
    return ProviderMeta(
        providers=cfg["ai"]["providers"],
        available=available,
        roles=cfg["ai"]["roles"],
        offlineOnly=cfg["ai"]["offlineOnly"],
        priority=cfg["ai"]["priority"],
        remote=cfg["ai"]["remote"],
        hasKeys=hasKeys,
        allowExternalAI=cfg["network"]["allowExternalAI"],
        timeoutSec=cfg["network"]["timeoutSec"],
    )

@router.post("/providers/set_key")
def providers_set_key(req: SetKeyReq):
    prov = req.provider.lower().strip()
    if prov not in {"openai","anthropic","openai_compat"}:
        raise HTTPException(400, "unknown provider")
    set_secret(f"{prov}_api_key", req.apiKey.strip())
    return {"ok": True}

@router.post("/providers/config")
def providers_config(req: SetCfgReq):
    cfg = load_cfg()
    if req.offlineOnly is not None: cfg["ai"]["offlineOnly"]=bool(req.offlineOnly)
    if req.priority is not None: cfg["ai"]["priority"]=list(req.priority)
    if req.roles is not None: cfg["ai"]["roles"]=dict(req.roles)
    if req.remote is not None: cfg["ai"]["remote"]=dict(req.remote)
    if req.allowExternalAI is not None: cfg["network"]["allowExternalAI"]=bool(req.allowExternalAI)
    if req.timeoutSec is not None: cfg["network"]["timeoutSec"]=int(req.timeoutSec)
    save_cfg(cfg)
    return {"ok": True, "cfg": cfg}

async def try_provider(provider:str, cfg:dict, prompt:str, role:str, model_override:Optional[str], temperature:float, timeout:int)->Optional[Dict[str,str]]:
    role = (role or "general").lower()
    if provider=="ollama":
        models = detect_ollama_models()
        chosen = model_override or cfg["ai"]["roles"].get(role) or (models[0] if models else None)
        if not chosen: return None
        try:
            content = await call_ollama(chosen, prompt, temperature, timeout)
            return {"provider":"ollama","model":chosen,"content":content}
        except: return None

    if provider=="openai":
        key = get_secret("openai_api_key")
        if not key: return None
        base = cfg["ai"]["remote"]["openai"]["baseUrl"]
        chosen = model_override or cfg["ai"]["remote"]["openai"]["defaultModel"]
        try:
            content = await call_openai(base, key, chosen, prompt, temperature, timeout)
            return {"provider":"openai","model":chosen,"content":content}
        except: return None

    if provider=="anthropic":
        key = get_secret("anthropic_api_key")
        if not key: return None
        base = cfg["ai"]["remote"]["anthropic"]["baseUrl"]
        ver  = cfg["ai"]["remote"]["anthropic"]["version"]
        chosen = model_override or cfg["ai"]["remote"]["anthropic"]["defaultModel"]
        try:
            content = await call_anthropic(base, key, ver, chosen, prompt, temperature, timeout)
            return {"provider":"anthropic","model":chosen,"content":content}
        except: return None

    if provider=="openai_compat":
        key = get_secret("openai_compat_api_key")
        if not key: return None
        base = cfg["ai"]["remote"]["openai_compat"]["baseUrl"]
        chosen = model_override or cfg["ai"]["remote"]["openai_compat"]["defaultModel"]
        try:
            content = await call_openai(base, key, chosen, prompt, temperature, timeout)
            return {"provider": cfg["ai"]["remote"]["openai_compat"].get("name","openai_compat"),"model":chosen,"content":content}
        except: return None

    return None

@router.post("/ai/route", response_model=RouteRes)
@require_safe_execution
async def ai_route(req: RouteReq):
    # Validate and sanitize user prompt
    try:
        if req.prompt:
            req.prompt = SecurityValidator.validate_ai_prompt(req.prompt)
    except ValueError as e:
        raise HTTPException(400, f"Invalid prompt: {str(e)}")
    cfg = load_cfg()
    offline = bool(cfg["ai"]["offlineOnly"]) or not bool(cfg["network"]["allowExternalAI"])
    timeout = int(cfg["network"]["timeoutSec"] or 60)
    # cache
    if req.cacheKey:
        cval = cache.get(req.cacheKey)
        if cval:
            return RouteRes(provider=cval["provider"], model=cval["model"], content=cval["content"], cached=True, took_ms=0)

    t0=time.time()
    order: List[str] = []
    if req.provider:
        order = [req.provider]
    else:
        order = cfg["ai"]["priority"][:] if not offline else ["ollama"]

    # always try ollama first if offline or no keys present
    if offline:
        if "ollama" not in order: order = ["ollama"] + order

    for prov in order:
        ans = await try_provider(prov, cfg, req.prompt, req.role, req.model, req.temperature or 0.2, timeout)
        if ans:
            took = int((time.time()-t0)*1000)
            data = RouteRes(provider=ans["provider"], model=ans["model"], content=ans["content"], cached=False, took_ms=took)
            if req.cacheKey: cache.set(req.cacheKey, ans, expire=3600)
            return data

    raise HTTPException(502, "No provider succeeded (check keys or offline mode).")