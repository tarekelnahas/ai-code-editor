from __future__ import annotations
import json, asyncio
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import httpx, os

router = APIRouter()
CONFIG_PATH = os.path.join(os.getenv("LOCALAPPDATA",""), "AIEditor", "config.json")
DEFAULT_ROLES = {"completion":"deepseek-coder:latest","general":"dolphin-phi:latest","planner":"smollm:1.7b"}
FALLBACKS = {
    "completion": ["deepseek-coder:latest","codegemma:2b","smollm:1.7b","dolphin-phi:latest"],
    "general":    ["dolphin-phi:latest","smollm:1.7b","deepseek-coder:latest","codegemma:2b"],
    "planner":    ["smollm:1.7b","dolphin-phi:latest","deepseek-coder:latest","codegemma:2b"],
}

def load_roles() -> dict:
    try:
        import json as _json
        with open(CONFIG_PATH,"r",encoding="utf-8") as f:
            cfg = _json.load(f) or {}
        roles = ((cfg.get("ai") or {}).get("roles") or {}) or {}
    except Exception:
        roles = {}
    return {**DEFAULT_ROLES, **roles}

async def available_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://127.0.0.1:11434/api/tags")
            r.raise_for_status()
            data = r.json()
            return [m.get("name") for m in (data or {}).get("models", []) if m.get("name")]
    except Exception:
        return []

def pick_model(role: Optional[str], explicit: Optional[str], avail: list[str]) -> str:
    if explicit and explicit in avail:
        return explicit
    role = (role or "general").lower()
    roles = load_roles()
    pref = roles.get(role)
    if pref in avail:
        return pref
    for m in FALLBACKS.get(role, []):
        if m in avail:
            return m
    return avail[0] if avail else (pref or DEFAULT_ROLES["general"])

@router.websocket("/ws/ai")
async def ws_ai(ws: WebSocket):
    await ws.accept()
    client: Optional[httpx.AsyncClient] = None
    stream_ctx = None
    cancelled = False
    try:
        # first message from client should be {"prompt": "...", "role": "general"}
        init = await ws.receive_text()
        try:
            init_obj = json.loads(init)
        except Exception:
            await ws.send_json({"type":"error","message":"invalid init json"})
            await ws.close(code=1003); return
        prompt = init_obj.get("prompt","").strip()
        role = init_obj.get("role","general")
        explicit_model = init_obj.get("model")
        if not prompt:
            await ws.send_json({"type":"error","message":"empty prompt"})
            await ws.close(code=1003); return

        avail = await available_models()
        model = pick_model(role, explicit_model, avail)
        await ws.send_json({"type":"start","model":model})

        body = {"model": model, "prompt": prompt, "stream": True}
        client = httpx.AsyncClient(timeout=None)
        stream_ctx = client.stream("POST", "http://127.0.0.1:11434/api/generate", json=body)
        async with stream_ctx as r:
            async for line in r.aiter_lines():
                if not line: 
                    await asyncio.sleep(0) 
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                if obj.get("done"):
                    break
                token = obj.get("response","")
                if token:
                    await ws.send_json({"type":"delta","token":token})
        await ws.send_json({"type":"end"})
    except WebSocketDisconnect:
        cancelled = True
    except Exception as e:
        await ws.send_json({"type":"error","message":str(e)})
    finally:
        if stream_ctx:
            # best-effort cancel
            try: await stream_ctx.aclose()
            except: pass
        if client:
            try: await client.aclose()
            except: pass
        if not cancelled:
            try: await ws.close()
            except: pass