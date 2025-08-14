from __future__ import annotations
import os, json, subprocess
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
APPDATA = os.getenv("LOCALAPPDATA","")
CFG_DIR = os.path.join(APPDATA, "AIEditor")
CFG_PATH = os.path.join(CFG_DIR, "config.json")
Path(CFG_DIR).mkdir(parents=True, exist_ok=True)

WHITELIST = {"git","pip","python","node","npm","powershell","cmd","robocopy"}

def load_cfg()->dict:
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: 
            j=json.load(f) or {}
    except: j={}
    j.setdefault("tasks", [])
    return j

def save_cfg(cfg:dict):
    with open(CFG_PATH,"w",encoding="utf-8") as f: json.dump(cfg,f,indent=2)

class Task(BaseModel):
    name: str
    cmd: str
    args: List[str] = []
    cwd: Optional[str] = None

class RunReq(BaseModel):
    name: Optional[str] = None
    cmd: Optional[str] = None
    args: List[str] = []
    cwd: Optional[str] = None

@router.get("/tasks/list")
def tasks_list():
    return {"tasks": load_cfg().get("tasks",[])}

@router.post("/tasks/save")
def tasks_save(t: Task):
    cfg=load_cfg()
    # upsert by name
    arr = cfg.get("tasks",[])
    arr = [x for x in arr if x.get("name")!=t.name]
    arr.append(t.model_dump())
    cfg["tasks"]=arr
    save_cfg(cfg)
    return {"ok": True, "count": len(arr)}

@router.post("/tasks/run")
def tasks_run(req: RunReq):
    if req.name:
        # run saved task
        for t in load_cfg().get("tasks",[]):
            if t.get("name")==req.name:
                cmd, args, cwd = t["cmd"], t.get("args",[]), t.get("cwd")
                break
        else:
            raise HTTPException(404, "task not found")
    else:
        if not req.cmd: raise HTTPException(400, "cmd required")
        cmd, args, cwd = req.cmd, req.args, req.cwd

    base = (cmd or "").lower()
    if base not in WHITELIST:
        raise HTTPException(400, "command not allowed")

    try:
        p = subprocess.run([cmd, *args], cwd=cwd or None, capture_output=True, text=True, timeout=600)
        return {"ok": p.returncode==0, "code": p.returncode, "out": (p.stdout or p.stderr)}
    except Exception as e:
        raise HTTPException(500, f"exec error: {e}")