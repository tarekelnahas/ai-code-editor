from __future__ import annotations
import os, json, time, sqlite3, re
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter()
APPDATA = os.getenv("LOCALAPPDATA","")
CFG_PATH = os.path.join(APPDATA,"AIEditor","config.json")
DB_PATH = os.path.join(APPDATA,"AIEditor","index.db")
ROOT_DEFAULT = str(Path(__file__).resolve().parents[1])
CODE_EXT = {".ts",".tsx",".js",".jsx",".py",".json",".md",".yml",".yaml",".toml",".html",".css",".cpp",".h",".c",".cs",".java",".go",".rs",".sql",".sh",".ps1",".bat"}

def ensure_db():
    Path(APPDATA,"AIEditor").mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("PRAGMA journal_mode=WAL;")
        c.execute("CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, mtime REAL, size INTEGER)")
        c.execute("CREATE TABLE IF NOT EXISTS snippets(path TEXT, line_start INTEGER, line_end INTEGER, content TEXT)")
        conn.commit()
    finally:
        return conn

def load_cfg():
    try:
        with open(CFG_PATH,"r",encoding="utf-8") as f: return json.load(f) or {}
    except: return {}

def should_index(p: Path)->bool:
    if not p.is_file(): return False
    if p.suffix.lower() not in CODE_EXT: return False
    if p.stat().st_size > 2_000_000: return False
    return True

def scan_files(root:str)->List[Path]:
    rootp = Path(root)
    out=[]
    for p in rootp.rglob("*"):
        try:
            if should_index(p): out.append(p)
        except: pass
    return out

def chunk_text(text: str, max_lines: int = 50, overlap: int = 5) -> List[Tuple[int, int, str]]:
    lines = text.splitlines()
    chunks = []
    i = 0
    n = len(lines)
    while i < n:
        j = min(n, i + max_lines)
        piece = "\n".join(lines[i:j])
        chunks.append((i+1, j, piece))
        if j >= n: break
        i = j - overlap
        if i < 0: i = 0
    return chunks

def score_chunk(q: str, s: str) -> float:
    ql = q.lower().strip()
    s2 = s.lower()
    words = [w for w in re.split(r"\W+", ql) if w]
    if not words: return 0.0
    c = sum(s2.count(w) for w in words)
    return float(c) / (1 + len(s2)/1000.0)

class IndexReq(BaseModel):
    root: Optional[str]=None
    clean: bool=False
class IndexRes(BaseModel):
    root: str; counted:int; updated:int; skipped:int; took_ms:int

@router.post("/ragpro/index", response_model=IndexRes)
def ragpro_index(req: IndexReq):
    root = req.root or ROOT_DEFAULT
    t0=time.time()
    conn=ensure_db(); cur=conn.cursor()
    if req.clean:
        cur.execute("DELETE FROM files"); cur.execute("DELETE FROM snippets"); conn.commit()
    files=scan_files(root)
    counted=len(files); updated=0; skipped=0
    for p in files:
        try:
            st=p.stat(); mtime=st.st_mtime; size=st.st_size
            row=cur.execute("SELECT mtime,size FROM files WHERE path=?",(str(p),)).fetchone()
            if row and row[0]==mtime and row[1]==size:
                skipped+=1; continue
            text=p.read_text(encoding="utf-8", errors="ignore")
            cur.execute("INSERT OR REPLACE INTO files(path,mtime,size) VALUES(?,?,?)",(str(p),mtime,size))
            cur.execute("DELETE FROM snippets WHERE path=?",(str(p),))
            for (a,b,snip) in chunk_text(text):
                cur.execute("INSERT INTO snippets(path,line_start,line_end,content) VALUES(?,?,?,?)",(str(p),a,b,snip))
            updated+=1
            if updated % 50 == 0: conn.commit()
        except: pass
    conn.commit(); conn.close()
    return IndexRes(root=root, counted=counted, updated=updated, skipped=skipped, took_ms=int((time.time()-t0)*1000))

class SearchReq(BaseModel):
    q:str; k:int=10
class Hit(BaseModel):
    path:str; line_start:int; line_end:int; score:float; snippet:str
class SearchRes(BaseModel):
    hits:List[Hit]; took_ms:int; db:str

@router.post("/ragpro/search", response_model=SearchRes)
def ragpro_search(req:SearchReq):
    t0=time.time()
    conn=ensure_db(); cur=conn.cursor()
    hits=[]
    try:
        for row in cur.execute("SELECT path,line_start,line_end,content FROM snippets WHERE content LIKE ? ORDER BY rowid LIMIT ?", (f"%{req.q}%", req.k)):
            path, line_start, line_end, snippet = row
            score = score_chunk(req.q, snippet)
            if score > 0:
                hits.append(Hit(path=path, line_start=line_start, line_end=line_end, score=round(score,2), snippet=snippet[:1000]))
        hits.sort(key=lambda x: x.score, reverse=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {e}")
    finally:
        conn.close()
    return SearchRes(hits=hits, took_ms=int((time.time()-t0)*1000), db=DB_PATH)

class CtxReq(BaseModel):
    prompt:str; role:Optional[str]="general"; q:Optional[str]=None; k:int=6
class CtxRes(BaseModel):
    model:str; content:str; used:List[Hit]

async def pick_model(role:str|None):
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r=await c.get("http://127.0.0.1:8000/ai/meta"); j=r.json()
            avail=j.get("available",[]); roles=j.get("roles",{})
            pref=[ (roles.get((role or "general").lower())), roles.get("general"), roles.get("completion"), roles.get("planner") ]
            pref=[m for m in pref if m]
            for m in pref:
                if m in avail: return m
            return avail[0] if avail else (pref[0] if pref else "dolphin-phi:latest")
    except: return "dolphin-phi:latest"

@router.post("/ai/complete_with_context_pro", response_model=CtxRes)
async def complete_with_context_pro(req:CtxReq):
    q=req.q or req.prompt
    s=ragpro_search(SearchReq(q=q, k=req.k))
    context="\n\n".join([f"[{i+1}] {h.path}:{h.line_start}-{h.line_end}\n{h.snippet}" for i,h in enumerate(s.hits)])
    prefix=("You are a coding assistant. Use ONLY the provided code context when relevant and cite like [1], [2].\n"
            f"Code Context ({len(s.hits)}):\n{context}\n--- End Context ---\n")
    body={"model": await pick_model(req.role), "prompt": prefix+req.prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=120.0) as c:
            r=await c.post("http://127.0.0.1:11434/api/generate", json=body); r.raise_for_status(); j=r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e}")
    return CtxRes(model=body["model"], content=j.get("response",""), used=s.hits)