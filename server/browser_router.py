from __future__ import annotations
import os, json, time
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
CFG_PATH = os.path.join(os.getenv("LOCALAPPDATA",""),"AIEditor","config.json")
TOOLS_DIR = os.path.join(os.path.dirname(__file__),"tools")

def load_cfg():
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: return json.load(f) or {}
    except: return {}

def driver_path():
    p = os.path.join(TOOLS_DIR, "msedgedriver.exe")
    return p if os.path.exists(p) else None

class OpenReq(BaseModel):
    url: str
class DLReq(BaseModel):
    url: str
    dest: str

@router.post("/browser/open")
def browser_open(req:OpenReq):
    cfg = load_cfg()
    if not (cfg.get("browserAutomation") or {}).get("allow", False):
        raise HTTPException(403, "Browser automation disabled")
    dp = driver_path()
    if not dp: raise HTTPException(400,"msedgedriver.exe missing in server/tools")
    try:
        from selenium import webdriver
        from selenium.webdriver.edge.service import Service
        svc = Service(executable_path=dp)
        opts = webdriver.EdgeOptions(); opts.add_argument("--headless=new")
        drv = webdriver.Edge(service=svc, options=opts)
        drv.get(req.url); time.sleep(1.0); title = drv.title
        drv.quit()
        return {"ok": True, "title": title}
    except Exception as e:
        raise HTTPException(500, f"selenium error: {e}")

@router.post("/browser/download")
def browser_download(req:DLReq):
    # Simplified: use requests (no headless complexity) when allowed
    cfg = load_cfg()
    if not (cfg.get("network") or {}).get("allowDownloads", True):
        raise HTTPException(403, "Downloads disabled")
    try:
        import requests, pathlib
        r = requests.get(req.url, timeout=120); r.raise_for_status()
        pathlib.Path(os.path.dirname(req.dest)).mkdir(parents=True, exist_ok=True)
        with open(req.dest,"wb") as f: f.write(r.content)
        return {"ok": True, "bytes": len(r.content)}
    except Exception as e:
        raise HTTPException(500, f"download error: {e}")