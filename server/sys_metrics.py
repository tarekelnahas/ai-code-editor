from __future__ import annotations
import os, time, psutil, json
from fastapi import APIRouter
from typing import Dict, Any
import httpx

router = APIRouter()

def proc_mem_mb()->float:
    p = psutil.Process()
    return p.memory_info().rss / (1024*1024)

@router.get("/sys/metrics")
async def sys_metrics()->Dict[str,Any]:
    vm = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=0.05)
    mem_used_mb = (vm.total - vm.available) / (1024*1024)
    mem_total_mb = vm.total / (1024*1024)
    # provider snapshot (best-effort)
    meta = {}
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get("http://127.0.0.1:8000/providers/meta")
            meta = r.json()
    except:
        meta = {}
    return {
        "cpu_percent": cpu,
        "mem_used_mb": int(mem_used_mb),
        "mem_total_mb": int(mem_total_mb),
        "mem_percent": round((mem_used_mb / mem_total_mb) * 100, 1),
        "proc_mem_mb": int(proc_mem_mb()),
        "provider_hint": {
            "priority": meta.get("priority"),
            "offlineOnly": meta.get("offlineOnly"),
            "available": meta.get("available")
        },
        "ts": int(time.time())
    }