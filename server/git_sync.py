from __future__ import annotations
import os, json, subprocess, time, threading, fnmatch
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import keyring
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from utils.security import SecurityValidator, require_safe_execution

router = APIRouter()
APPDATA = os.getenv("LOCALAPPDATA","")
CFG_DIR = os.path.join(APPDATA, "AIEditor")
CFG_PATH = os.path.join(CFG_DIR, "config.json")
SERVICE = "MidoAIEditor"
GIT_TOKEN_KEY = "github_pat"

def load_cfg()->dict:
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: 
            j=json.load(f) or {}
    except: j={}
    j.setdefault("git", {"repoPath":"", "branch":"main", "userName":"Mido", "userEmail":"mido@example.local", "autoSync": False, "ignoreGlobs": ["*.log","*.tmp","node_modules/**","dist/**","release/**",".venv/**","**/*.zip","**/*.7z","**/*.rar"]})
    return j

def save_cfg(cfg:dict):
    Path(CFG_DIR).mkdir(parents=True, exist_ok=True)
    with open(CFG_PATH,"w",encoding="utf-8") as f: json.dump(cfg,f,indent=2)

@require_safe_execution
def run(cmd:list[str], cwd:Optional[str]=None, timeout:int=120)->tuple[int,str]:
    # Sanitize command arguments
    try:
        sanitized_cmd = SecurityValidator.sanitize_command_args(cmd)
        # Remove quotes for subprocess.run
        clean_cmd = [arg.strip("'\"") for arg in sanitized_cmd]
    except ValueError as e:
        raise HTTPException(400, f"Security validation failed: {str(e)}")
    
    # Validate working directory
    if cwd:
        try:
            SecurityValidator.validate_file_path(cwd)
        except ValueError as e:
            raise HTTPException(400, f"Invalid working directory: {str(e)}")
    
    p = subprocess.run(clean_cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, shell=False)
    return p.returncode, (p.stdout or "") + (p.stderr or "")

def over_size(path:Path)->bool:
    try: return path.is_file() and path.stat().st_size > 10*1024*1024
    except: return False

def is_ignored(path:Path, globs:list[str])->bool:
    rel = str(path).replace("\\","/")
    for g in globs:
        if fnmatch.fnmatch(rel, g): return True
    return False

# -------- Models ----------
class GitConfigReq(BaseModel):
    repoPath: str
    branch: str = "main"
    userName: Optional[str] = None
    userEmail: Optional[str] = None
    autoSync: Optional[bool] = None
    ignoreGlobs: Optional[list[str]] = None

class TokenReq(BaseModel):
    token: str   # PAT with 'repo' scope
    user: str    # GitHub username (only used for remote URL)

class PushReq(BaseModel):
    repoPath: str
    message: str = "chore: auto-sync"
    branch: str = "main"
    dry: bool = False

class StatusRes(BaseModel):
    branch: str
    ahead: int
    behind: int
    changes: int
    lastCommit: str

# -------- Watcher (debounced) --------
_observer: Optional[Observer] = None
_debounce_time = 2.0
_last_event_ts = 0.0

class Handler(FileSystemEventHandler):
    def on_any_event(self, event):
        global _last_event_ts
        _last_event_ts = time.time()

def ensure_watcher(repo:str, enable:bool):
    global _observer
    if enable:
        if _observer: return
        h = Handler()
        _observer = Observer()
        _observer.schedule(h, repo, recursive=True)
        _observer.daemon = True
        _observer.start()
    else:
        if _observer:
            _observer.stop()
            _observer.join(timeout=2.0)
            _observer = None

def tick_auto(repo:str, branch:str, globs:list[str]):
    # call periodically from a lightweight thread
    global _last_event_ts
    if _observer is None: return
    if time.time() - _last_event_ts < _debounce_time: 
        return
    if _last_event_ts == 0.0:
        return
    _last_event_ts = 0.0
    try:
        do_commit_push(repo, f"chore: auto-sync {int(time.time())}", branch, globs, dry=False)
    except Exception:
        pass

def do_commit_push(repoPath:str, msg:str, branch:str, globs:list[str], dry:bool)->str:
    repo = Path(repoPath)
    if not repo.exists(): raise HTTPException(400, "repoPath missing")
    # init if not git
    if not (repo / ".git").exists():
        code,out = run(["git","init","-b", branch], cwd=str(repo))
        if code!=0: raise HTTPException(500, "git init failed: "+out)
    cfg = load_cfg()
    # set user
    userName = cfg["git"].get("userName") or "Mido"
    userEmail = cfg["git"].get("userEmail") or "mido@example.local"
    run(["git","config","user.name", userName], cwd=str(repo))
    run(["git","config","user.email", userEmail], cwd=str(repo))

    # stage respecting ignore + size
    # first, `git add -A`, then reset ignored/oversize
    run(["git","add","-A"], cwd=str(repo))
    # remove big/ignored from index
    for p in repo.rglob("*"):
        if is_ignored(p, globs) or over_size(p):
            rel = str(p.relative_to(repo)).replace("\\","/")
            run(["git","reset","-q", rel], cwd=str(repo))

    # commit if there are changes
    code, out = run(["git","status","--porcelain"], cwd=str(repo))
    if code!=0: raise HTTPException(500, "git status failed: "+out)
    if not out.strip():
        return "No changes."

    if dry:
        return "DRY RUN:\n"+out

    code, out = run(["git","commit","-m", msg], cwd=str(repo))
    if code!=0: raise HTTPException(500, "git commit failed: "+out)

    # push using temporary remote with PAT from keyring
    token = keyring.get_password(SERVICE, "github_pat") or ""
    user  = keyring.get_password(SERVICE, "github_user") or "mido"
    code, remote_out = run(["git","remote"], cwd=str(repo))
    has_origin = "origin" in (remote_out or "")
    remote_name = "mido-tmp"
    # get current remote URL (if exists)
    if has_origin:
        code, rurl = run(["git","remote","get-url","origin"], cwd=str(repo))
    else:
        rurl = ""
    if "github.com" not in rurl:
        # user must set it once with `git remote add origin https://github.com/<user>/<repo>.git`
        pass

    if token:
        # temporary remote with embedded credentials (not saved to config)
        url = f"https://{user}:{token}@github.com/"
        if rurl.strip():
            # replace domain part only
            if rurl.startswith("https://github.com/"):
                path = rurl.split("https://github.com/")[1]
                url = url + path
            else:
                # cannot infer: require full origin already set by user
                url = rurl
        else:
            # if no origin, error out
            raise HTTPException(400, "No remote origin set. Please add: git remote add origin https://github.com/<user>/<repo>.git")

        run(["git","remote","remove", remote_name], cwd=str(repo))
        code, out2 = run(["git","remote","add", remote_name, url], cwd=str(repo))
        if code!=0: raise HTTPException(500, "git remote add failed: "+out2)
        code, pout = run(["git","push", remote_name, f"HEAD:{branch}"], cwd=str(repo), timeout=240)
        run(["git","remote","remove", remote_name], cwd=str(repo))
        if code!=0: raise HTTPException(500, "git push failed: "+pout)
    else:
        # try push to origin (will use GCM/UI if available)
        code, pout = run(["git","push","-u","origin", f"HEAD:{branch}"], cwd=str(repo), timeout=240)
        if code!=0: raise HTTPException(500, "git push failed (no token): "+pout)

    return "Pushed."

def repo_status(repoPath:str, branch:str)->StatusRes:
    code, out = run(["git","rev-parse","--abbrev-ref","HEAD"], cwd=repoPath)
    cur = out.strip() if code==0 else branch
    code, out = run(["git","status","--porcelain"], cwd=repoPath)
    changes = len([l for l in out.splitlines() if l.strip()])
    code, last = run(["git","log","-1","--pretty=%h %s"], cwd=repoPath)
    # ahead/behind (best-effort)
    run(["git","fetch","--quiet"], cwd=repoPath)
    code, ab = run(["git","rev-list","--left-right","--count", f"origin/{branch}...HEAD"], cwd=repoPath)
    ahead, behind = 0, 0
    try:
        if code==0 and ab.strip():
            parts = ab.strip().split()
            behind = int(parts[0]); ahead = int(parts[1])
    except: pass
    return StatusRes(branch=cur, ahead=ahead, behind=behind, changes=changes, lastCommit=last.strip())

# -------- Endpoints --------
class WatchReq(BaseModel):
    enable: bool = True

@router.post("/git/config")
@require_safe_execution
def git_config(req:GitConfigReq):
    cfg=load_cfg()
    g=cfg["git"]
    g["repoPath"]=req.repoPath or g["repoPath"]
    g["branch"]=req.branch or g["branch"]
    if req.userName: g["userName"]=req.userName
    if req.userEmail: g["userEmail"]=req.userEmail
    if req.ignoreGlobs: g["ignoreGlobs"]=req.ignoreGlobs
    if req.autoSync is not None: g["autoSync"]=bool(req.autoSync)
    save_cfg(cfg)
    return {"ok": True, "git": g}

@router.post("/git/set_token")
@require_safe_execution
def git_set_token(req:TokenReq):
    keyring.set_password(SERVICE, "github_pat", req.token)
    keyring.set_password(SERVICE, "github_user", req.user)
    return {"ok": True}

@router.get("/git/status", response_model=StatusRes)
def git_status(repoPath: Optional[str]=None, branch: Optional[str]=None):
    cfg=load_cfg(); g=cfg["git"]
    repo=repoPath or g["repoPath"]; br=branch or g["branch"]
    if not repo: raise HTTPException(400,"repoPath not set")
    return repo_status(repo, br)

@router.post("/git/push")
@require_safe_execution
def git_push(req:PushReq):
    cfg=load_cfg(); g=cfg["git"]
    repo=req.repoPath or g["repoPath"]
    br=req.branch or g["branch"]
    globs=g.get("ignoreGlobs") or []
    out = do_commit_push(repo, req.message, br, globs, req.dry)
    return {"ok": True, "out": out}

@router.post("/git/watch")
@require_safe_execution
def git_watch(req:WatchReq):
    cfg=load_cfg(); g=cfg["git"]
    repo=g.get("repoPath")
    if not repo: raise HTTPException(400,"repoPath not set")
    ensure_watcher(repo, req.enable)
    if req.enable:
        # background ticker thread
        def loop():
            while True:
                if _observer is None: break
                tick_auto(repo, g.get("branch") or "main", g.get("ignoreGlobs") or [])
                time.sleep(1.0)
        t=threading.Thread(target=loop, daemon=True); t.start()
    return {"ok": True, "watching": req.enable}