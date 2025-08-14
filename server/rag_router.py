from __future__ import annotations
import os, sys, json, subprocess, shlex, time, re
from typing import List, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from pathlib import Path

router = APIRouter()

CONFIG_PATH = os.path.join(os.getenv("LOCALAPPDATA",""), "AIEditor", "config.json")
ROOT_DEFAULT = str(Path(__file__).resolve().parents[1])  # F:\ai_code_editor
RG_CANDIDATES = [
    "rg",  # system
    str(Path(ROOT_DEFAULT, "node_modules", "@vscode", "ripgrep", "bin", "rg.exe")),
    str(Path(ROOT_DEFAULT, "node_modules", "vscode-ripgrep", "bin", "rg.exe")),
]

CODE_EXT = {".ts",".tsx",".js",".jsx",".py",".json",".md",".yml",".yaml",".toml",".html",".css",".cpp",".h",".c",".cs",".java",".go",".rs",".sql",".sh",".ps1"}

def load_cfg() -> dict:
    try:
        with open(CONFIG_PATH,"r",encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}

def find_rg() -> str:
    env_path = os.environ.get("RG_PATH")
    if env_path and Path(env_path).exists(): return env_path
    for p in RG_CANDIDATES:
        try:
            if Path(p).exists(): return p
        except: pass
    return "rg"

def safe_root(request_root: Optional[str]) -> str:
    if request_root and Path(request_root).exists():
        return request_root
    return ROOT_DEFAULT

class SearchReq(BaseModel):
    q: str
    root: Optional[str] = None
    max_results: int = 200

class SearchHit(BaseModel):
    path: str
    line: int
    text: str

class SearchRes(BaseModel):
    hits: List[SearchHit]
    took_ms: int
    rg_path: str
    root: str

@router.post("/search", response_model=SearchRes)
def search(req: SearchReq):
    root = safe_root(req.root)
    t0 = time.time()
    rg = find_rg()
    # vimgrep format: file:line:col:text
    args = [rg, "--vimgrep", "-n", "--no-heading", "-S", req.q, root]
    try:
        out = subprocess.check_output(args, stderr=subprocess.DEVNULL, text=True, encoding="utf-8", errors="ignore")
    except subprocess.CalledProcessError as e:
        out = e.output or ""
    hits: List[SearchHit] = []
    for line in out.splitlines():
        try:
            # path:line:col:text
            path, ln, col, text = line.split(":", 3)
            hits.append(SearchHit(path=path, line=int(ln), text=text.strip()))
            if len(hits) >= req.max_results: break
        except: continue
    took_ms = int((time.time()-t0)*1000)
    return SearchRes(hits=hits, took_ms=took_ms, rg_path=rg, root=root)

# --- RAG: simple chunking + scoring ---
def read_file(path: str) -> Optional[str]:
    try:
        p = Path(path)
        if p.suffix.lower() not in CODE_EXT: return None
        if p.stat().st_size > 2_000_000: return None  # 2MB cap
        return p.read_text(encoding="utf-8", errors="ignore")
    except: return None

def chunk_text(text: str, max_lines: int = 120, overlap: int = 20) -> List[Tuple[int,int,str]]:
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
    # simple: count matches of words
    words = [w for w in re.split(r"\W+", ql) if w]
    if not words: return 0.0
    c = sum(s2.count(w) for w in words)
    return float(c) / (1 + len(s2)/5000.0)

class RagQueryReq(BaseModel):
    q: str
    root: Optional[str] = None
    k: int = 5

class RagChunk(BaseModel):
    path: str
    start_line: int
    end_line: int
    score: float
    snippet: str

class RagQueryRes(BaseModel):
    chunks: List[RagChunk]
    took_ms: int

@router.post("/rag/query", response_model=RagQueryRes)
def rag_query(req: RagQueryReq):
    # candidate files via ripgrep for speed
    sr = search(SearchReq(q=req.q, root=req.root, max_results=300))
    candidates = {}
    for h in sr.hits:
        candidates[h.path] = candidates.get(h.path, 0) + 1
    # read/score chunks
    t0 = time.time()
    scored: List[RagChunk] = []
    for path in list(candidates.keys())[:80]:
        txt = read_file(path)
        if not txt: continue
        for (a,b,snip) in chunk_text(txt):
            sc = score_chunk(req.q, snip)
            if sc <= 0: continue
            scored.append(RagChunk(path=path, start_line=a, end_line=b, score=round(sc,4), snippet=snip[:2000]))
    scored.sort(key=lambda x: x.score, reverse=True)
    return RagQueryRes(chunks=scored[:max(1,req.k)], took_ms=int((time.time()-t0)*1000))

# --- Complete with context ---
class CtxReq(BaseModel):
    prompt: str
    role: Optional[str] = "general"
    model: Optional[str] = None
    q: Optional[str] = None
    root: Optional[str] = None
    k: int = 4

class CtxRes(BaseModel):
    model: str
    content: str
    used_chunks: List[RagChunk]

async def choose_model(role: Optional[str], explicit: Optional[str]) -> str:
    # mirror ws/ai & ai_router selections in existing code
    # ask /ai/meta if exists
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://127.0.0.1:8000/ai/meta")
            data = r.json()
            available = data.get("available",[]) if isinstance(data, dict) else []
            roles = (data.get("roles") or {}) if isinstance(data, dict) else {}
    except Exception:
        available, roles = [], {}
    pref = explicit or (roles.get((role or "general").lower()))
    order = [pref, roles.get("general"), roles.get("completion"), roles.get("planner")]
    order = [m for m in order if m]
    if available:
        for m in order:
            if m in available: return m
        return available[0]
    return pref or "dolphin-phi:latest"

@router.post("/ai/complete_with_context", response_model=CtxRes)
async def complete_with_context(req: CtxReq):
    # build context if q present, else try from prompt
    query = req.q or req.prompt
    rag = rag_query(RagQueryReq(q=query, root=req.root, k=req.k))
    context_blocks = []
    for i,ch in enumerate(rag.chunks,1):
        context_blocks.append(f"[{i}] {ch.path}:{ch.start_line}-{ch.end_line}\n{ch.snippet}")
    context_text = "\n\n".join(context_blocks)
    system_prefix = (
        "You are a code assistant. Use ONLY the provided code context when relevant. "
        "Cite the chunk index like [1], [2] when referencing.\n\n"
        f"Code Context ({len(rag.chunks)} chunks):\n{context_text}\n\n"
        "--- End of Context ---\n"
    )
    body = {
        "model": await choose_model(req.role, req.model),
        "prompt": system_prefix + req.prompt,
        "stream": False
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post("http://127.0.0.1:11434/api/generate", json=body)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e}")
    return CtxRes(model=body["model"], content=(data or {}).get("response",""), used_chunks=rag.chunks)