"""
Enhanced AI Chat with Tool Integration
Enables AI models to call backend tools and execute actions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import re
import time
from ai_tools_bridge import ai_tools_bridge
from ai_providers import try_provider, load_cfg

router = APIRouter()

class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system", "function"
    content: str
    function_call: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    functions: Optional[List[Dict[str, Any]]] = None
    function_call: Optional[str] = "auto"  # "none", "auto", or specific function name
    model: Optional[str] = None
    temperature: float = 0.7

class ChatResponse(BaseModel):
    message: ChatMessage
    function_calls_made: List[Dict[str, Any]] = []
    provider: str
    model: str
    cached: bool = False
    took_ms: int

@router.post("/ai/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest):
    """Enhanced chat endpoint with tool integration."""
    
    # Get available functions
    available_functions = ai_tools_bridge.get_function_definitions() if req.functions is None else req.functions
    
    # Build context from messages
    context = "\n".join([f"{msg.role}: {msg.content}" for msg in req.messages])
    
    # Add function calling instructions
    if available_functions and req.function_call != "none":
        function_list = "\n".join([f"- {f['name']}: {f['description']}" for f in available_functions])
        context += f"\n\nYou have access to these tools:\n{function_list}\n"
        context += "\nTo use a tool, respond with: FUNCTION_CALL: tool_name(arguments)\n"
        context += "For example: FUNCTION_CALL: run_tool(tool_name='Git')\n"
    
    # Get AI response
    cfg = load_cfg()
    start_time = time.time()
    
    # Try providers in priority order
    response_content = ""
    provider_used = ""
    model_used = ""
    
    for provider in cfg["ai"]["priority"]:
        result = await try_provider(
            provider, cfg, context, "general", req.model, req.temperature, 
            cfg["network"]["timeoutSec"]
        )
        if result:
            response_content = result["content"]
            provider_used = provider
            model_used = result["model"]
            break
    
    if not response_content:
        raise HTTPException(500, "No AI providers available")
    
    # Check for function calls in response
    function_calls_made = []
    final_content = response_content
    
    # Look for function call patterns
    function_pattern = r'FUNCTION_CALL:\s*(\w+)\(([^)]*)\)'
    matches = re.findall(function_pattern, response_content)
    
    if matches and req.function_call != "none":
        for func_name, args_str in matches:
            try:
                # Parse arguments
                args_dict = {}
                if args_str.strip():
                    # Simple argument parsing (could be enhanced)
                    args_pairs = [arg.strip() for arg in args_str.split(',')]
                    for pair in args_pairs:
                        if '=' in pair:
                            key, value = pair.split('=', 1)
                            key = key.strip().strip("'\"")
                            value = value.strip().strip("'\"")
                            args_dict[key] = value
                
                # Call the function
                result = await ai_tools_bridge.call_function(func_name, **args_dict)
                function_calls_made.append({
                    "function": func_name,
                    "arguments": args_dict,
                    "result": result
                })
                
                # Add result to response
                if result.get("success"):
                    final_content += f"\n\n✅ Executed {func_name}: {result.get('message', 'Success')}"
                    if result.get("result"):
                        final_content += f"\nResult: {json.dumps(result['result'], indent=2)}"
                else:
                    final_content += f"\n\n❌ Failed {func_name}: {result.get('error', 'Unknown error')}"
                    
            except Exception as e:
                function_calls_made.append({
                    "function": func_name,
                    "arguments": args_dict,
                    "result": {"success": False, "error": str(e)}
                })
                final_content += f"\n\n❌ Error calling {func_name}: {str(e)}"
    
    # Remove function call markers from final response
    final_content = re.sub(function_pattern, '', final_content).strip()
    
    took_ms = int((time.time() - start_time) * 1000)
    
    return ChatResponse(
        message=ChatMessage(role="assistant", content=final_content),
        function_calls_made=function_calls_made,
        provider=provider_used,
        model=model_used,
        cached=False,
        took_ms=took_ms
    )

@router.get("/ai/functions")
async def get_available_functions():
    """Get list of available functions for AI."""
    return {
        "functions": ai_tools_bridge.get_function_definitions(),
        "count": len(ai_tools_bridge.get_function_definitions())
    }