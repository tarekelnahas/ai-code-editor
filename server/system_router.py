from __future__ import annotations
import os, json, subprocess, shlex
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import DEVICE, APP_SEED
from utils.security import SecurityValidator, require_safe_execution

router = APIRouter()

class StatusRes(BaseModel):
    device: str
    seed: int

@router.get("/system/status", response_model=StatusRes)
async def system_status() -> StatusRes:
    """Returns the current system status, including device and seed."""
    return StatusRes(device=DEVICE.type, seed=APP_SEED)

CFG_PATH = os.path.join(os.getenv("LOCALAPPDATA",""),"AIEditor","config.json")
WHITELIST = {"git","pip","python","node","npm","powershell","cmd","robocopy"}

def load_cfg():
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: return json.load(f) or {}
    except: return {}

class RunReq(BaseModel):
    cmd: str
    args: List[str] = []
    cwd: Optional[str] = None
    dry: bool = False

class RunRes(BaseModel):
    ok: bool
    code: int
    out: str

@router.post("/system/run", response_model=RunRes)
@require_safe_execution
def system_run(req:RunReq):
    cfg = load_cfg()
    mode = (cfg.get("mode") or "Power-User")
    if mode != "Power-User":
        raise HTTPException(403, "Power-User mode required")
    base = req.cmd.lower()
    if base not in WHITELIST: raise HTTPException(400, "Command not allowed")
    
    # Sanitize command arguments
    try:
        sanitized_args = SecurityValidator.sanitize_command_args(req.args)
    except ValueError as e:
        raise HTTPException(400, f"Security validation failed: {str(e)}")
    
    # Validate working directory if provided
    if req.cwd:
        try:
            SecurityValidator.validate_file_path(req.cwd)
        except ValueError as e:
            raise HTTPException(400, f"Invalid working directory: {str(e)}")
    
    if req.dry:
        return RunRes(ok=True, code=0, out=f"DRY: {base} {' '.join(sanitized_args)}")
    try:
        # Use original cmd but sanitized args
        p = subprocess.run([req.cmd] + [arg.strip("'\"") for arg in sanitized_args], 
                          cwd=req.cwd or None, capture_output=True, text=True, timeout=300)
        return RunRes(ok=(p.returncode==0), code=p.returncode, out=(p.stdout or p.stderr))
    except Exception as e:
        raise HTTPException(500, f"exec error: {e}")