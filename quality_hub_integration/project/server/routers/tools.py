"""API routes for tool operations.

This router exposes endpoints to list all tools and to invoke a
specific tool. Tools are defined in ``services/tool_runner.py``. The
run endpoint accepts a JSON payload with a ``name`` field and
returns the execution result. These endpoints are intended for
internal use by the client UI and are not exposed externally by
default.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import tool_runner


router = APIRouter()


class RunToolRequest(BaseModel):
    name: str


@router.get("/tools")
async def list_tools():
    """Return metadata for all registered tools.

    Each tool entry includes its name and category. The client can
    display this list and allow the user to select tools to run.
    """
    return tool_runner.list_tools()


@router.post("/tools/run")
async def run_tool(req: RunToolRequest):
    """Execute a single tool by name.

    Parameters
    ----------
    req: RunToolRequest
        A request body containing the ``name`` of the tool to run.

    Returns
    -------
    dict
        An object describing the result of the run. See
        ``tool_runner.run_tool`` for details.
    """
    result = tool_runner.run_tool(req.name)
    if result["status"] == "error" and result["output"].startswith("Unknown tool"):
        raise HTTPException(status_code=404, detail=result["output"])
    return result