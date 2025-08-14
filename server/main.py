# Load application-wide configuration and set random seed
import config

"""
FastAPI backend for the AI Code Editor. This service provides both
WebSocket and REST endpoints for interacting with local language
models, performing RAG searches, and orchestrating collaborative
agents. To keep the example concise the current implementation only
implements an echo assistant. Feel free to swap the stub logic in
AgentManager for calls into llama.cpp, Ollama or any other local
model runner.
"""

import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai_router import router as ai_router
from ws_ai import router as ws_ai_router
from rag_router import router as rag_router
from rag_pro import router as ragpro_router
from agents import router as agents_router
from system_router import router as system_router
from browser_router import router as browser_router
from ai_providers import router as providers_router
from git_sync import router as git_router
from sys_metrics import router as sys_router
from tasks import router as tasks_router
from routers.experiments_router import router as experiments_router

# GitHub integration router
try:
    from routers.github_router import router as github_router
except Exception:
    github_router = None

# Code analysis router
try:
    from routers.analysis_router import router as analysis_router_new
except Exception:
    analysis_router_new = None

# AI completion router
try:
    from routers.completion_router import router as completion_router
except Exception:
    completion_router = None

# Codex integration router
try:
    from routers.codex_router import router as codex_router
except Exception:
    codex_router = None

# 2090 add‑on routers
try:
    # Quantum orchestrator endpoints
    from quantum import router as quantum_router  # type: ignore
except Exception:
    quantum_router = None  # placeholder if module missing

try:
    # Temporal timeline endpoints
    from temporal import router as temporal_router  # type: ignore
except Exception:
    temporal_router = None  # placeholder if module missing

# analysis and additional extension routers
try:
    # Static analysis endpoints
    from analysis import router as analysis_router  # type: ignore
except Exception:
    analysis_router = None

try:
    # Security scanning endpoints
    from security import router as security_router  # type: ignore
except Exception:
    security_router = None

try:
    # Code search endpoints
    from search import router as search_router  # type: ignore
except Exception:
    search_router = None

try:
    # Performance profiling endpoints
    from performance import router as performance_router  # type: ignore
except Exception:
    performance_router = None

try:
    # Test runner endpoints
    from tests import router as tests_router  # type: ignore
except Exception:
    tests_router = None

try:
    # Refactoring suggestion endpoints
    from refactor import router as refactor_router  # type: ignore
except Exception:
    refactor_router = None

try:
    # Tool runner endpoints (quality hub)
    from routers.tools import router as tools_router  # type: ignore
except Exception:
    tools_router = None

try:
    # Enhanced AI chat with function calling
    from ai_chat import router as ai_chat_router  # type: ignore
except Exception:
    ai_chat_router = None

app = FastAPI(title="AI Code Editor API")

# Allow the renderer (running on localhost:5173) to connect during
# development. In production you may want to tighten these settings.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include AI router
app.include_router(ai_router)
app.include_router(ws_ai_router)
app.include_router(rag_router)
app.include_router(ragpro_router)
app.include_router(agents_router)
app.include_router(system_router)
app.include_router(browser_router)
app.include_router(providers_router)
app.include_router(git_router)
app.include_router(sys_router)
app.include_router(tasks_router)
app.include_router(experiments_router, prefix="/api", tags=["experiments"])

# Include GitHub router
if github_router is not None:
    app.include_router(github_router, prefix="/api", tags=["github"])

# Include Code Analysis router
if analysis_router_new is not None:
    app.include_router(analysis_router_new, prefix="/api", tags=["analysis"])

# Include AI Completion router
if completion_router is not None:
    app.include_router(completion_router, prefix="/api", tags=["completion"])

# Include Codex router
if codex_router is not None:
    app.include_router(codex_router, prefix="/api", tags=["codex"])

# Include 2090 add‑on routers (conditionally)
if quantum_router is not None:
    app.include_router(quantum_router, prefix="/api/quantum", tags=["quantum2090"])
if temporal_router is not None:
    app.include_router(temporal_router, prefix="/api/temporal", tags=["temporal2090"])

# Additional analysis/utility routers (conditionally)
if analysis_router is not None:
    app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
if security_router is not None:
    app.include_router(security_router, prefix="/api/security", tags=["security"])
if search_router is not None:
    app.include_router(search_router, prefix="/api/search", tags=["search"])
if performance_router is not None:
    app.include_router(performance_router, prefix="/api/performance", tags=["performance"])
if tests_router is not None:
    app.include_router(tests_router, prefix="/api/tests", tags=["tests"])
if refactor_router is not None:
    app.include_router(refactor_router, prefix="/api/refactor", tags=["refactor"])

# Include tool runner router
if tools_router is not None:
    app.include_router(tools_router, prefix="/api", tags=["tools"])

# Include enhanced AI chat with function calling
if ai_chat_router is not None:
    app.include_router(ai_chat_router, prefix="/api", tags=["ai-chat"])


class UserMessage(BaseModel):
    type: str
    content: str
    path: str | None = None


class AgentManager:
    """
    AgentManager coordinates one or more AI agents. For now it simply
    echoes the user's input. Replace the handle_user_message method
    with calls into your model of choice. The manager could also
    maintain history and context across interactions.
    """

    async def handle_user_message(self, message: UserMessage) -> list[dict]:
        # In a real implementation, spin up multiple tasks for each agent
        # (writer, reviewer, tester) and aggregate their responses.
        content = message.content.strip()
        if not content:
            return []
        # Stub: reverse the user's message as a fake response. Wait a bit to
        # simulate model latency.
        await asyncio.sleep(0.5)
        return [
            {"type": "assistant", "content": content[::-1]},
        ]


agent_manager = AgentManager()


@app.get("/ping")
async def ping() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint for production deployment."""
    return {"status": "ok", "service": "ai-code-editor"}


@app.websocket("/ws/ai")
async def ai_websocket(ws: WebSocket) -> None:
    """
    WebSocket endpoint used by the renderer to stream messages to and
    from the AI agent. Receives JSON objects from the client and
    dispatches them to the AgentManager. Sends zero or more JSON
    messages back to the client per input. The protocol is very
    simple: the client sends an object with a `type` field and the
    manager returns a list of objects with type and content fields.
    """
    await ws.accept()
    try:
        while True:
            try:
                text = await ws.receive_text()
            except WebSocketDisconnect:
                break
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({"type": "error", "content": "Invalid JSON"}))
                continue
            msg = UserMessage(**data)
            if msg.type == 'user':
                # Simulate thinking message
                await ws.send_text(json.dumps({"type": "thinking", "content": "Thinking…"}))
                responses = await agent_manager.handle_user_message(msg)
                for resp in responses:
                    await ws.send_text(json.dumps(resp))
            elif msg.type == 'update':
                # Handle document update events (e.g. for code completions). In a
                # full implementation this would trigger a streaming
                # completion. Here we ignore updates.
                continue
            else:
                await ws.send_text(json.dumps({"type": "error", "content": f"Unsupported message type: {msg.type}"}))
    finally:
        try:
            await ws.close()
        except Exception:
            pass