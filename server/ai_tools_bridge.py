"""
AI Tools Bridge - Connects AI models to backend tools and services.
Enables AI models to call functions like running tools, executing commands, etc.
"""

import json
import time
from typing import Dict, Any, List, Optional
from services.tool_runner import run_tool, list_tools
import httpx
import asyncio

class AIToolsBridge:
    """Bridge that allows AI models to call backend tools and services."""
    
    def __init__(self):
        self.available_functions = {
            "run_tool": self._run_tool,
            "list_tools": self._list_tools,
            "run_command": self._run_command,
            "search_files": self._search_files,
            "get_system_info": self._get_system_info,
            "open_browser": self._open_browser,
            "search_web": self._search_web,
            "mouse_click": self._mouse_click,
            "keyboard_type": self._keyboard_type,
            "take_screenshot": self._take_screenshot,
        }
    
    async def _run_tool(self, tool_name: str) -> Dict[str, Any]:
        """Run a development tool by name."""
        try:
            result = run_tool(tool_name)
            return {
                "success": True,
                "result": result,
                "message": f"Ran tool '{tool_name}' successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to run tool '{tool_name}'"
            }
    
    async def _list_tools(self) -> Dict[str, Any]:
        """List all available development tools."""
        try:
            tools = list_tools()
            return {
                "success": True,
                "tools": tools,
                "count": len(tools),
                "message": f"Found {len(tools)} available tools"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to list tools"
            }
    
    async def _run_command(self, command: str, args: List[str] = None) -> Dict[str, Any]:
        """Run a system command safely."""
        try:
            # Use system router for safe command execution
            async with httpx.AsyncClient() as client:
                response = await client.post("http://127.0.0.1:8000/system/run", 
                    json={"cmd": command, "args": args or [], "dry": False})
                result = response.json()
                return {
                    "success": result.get("ok", False),
                    "result": result,
                    "message": f"Command '{command}' executed"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to run command '{command}'"
            }
    
    async def _search_files(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """Search files in the project."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post("http://127.0.0.1:8000/search", 
                    json={"q": query, "max_results": max_results})
                result = response.json()
                return {
                    "success": True,
                    "result": result,
                    "message": f"Found {len(result.get('hits', []))} search results"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to search files for '{query}'"
            }
    
    async def _get_system_info(self) -> Dict[str, Any]:
        """Get system metrics and information."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get("http://127.0.0.1:8000/sys/metrics")
                result = response.json()
                return {
                    "success": True,
                    "result": result,
                    "message": "Retrieved system information"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to get system information"
            }
    
    async def _open_browser(self, url: str = None) -> Dict[str, Any]:
        """Open browser with optional URL."""
        try:
            import subprocess
            if url:
                # Open specific URL in Chrome
                try:
                    subprocess.run(['chrome', url], check=False, timeout=5)
                except:
                    # Fallback to default browser
                    subprocess.run(['start', url], shell=True, check=False, timeout=5)
            else:
                # Just open Chrome
                try:
                    subprocess.run(['chrome'], check=False, timeout=5)
                except:
                    subprocess.run(['start', 'chrome'], shell=True, check=False, timeout=5)
            
            return {
                "success": True,
                "message": f"Opened browser{'with ' + url if url else ''}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to open browser"
            }
    
    async def _search_web(self, query: str, engine: str = "google") -> Dict[str, Any]:
        """Open browser and search for a query."""
        try:
            import urllib.parse
            import subprocess
            
            # Construct search URL
            if engine.lower() == "google":
                search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
            elif engine.lower() == "bing":
                search_url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
            else:
                search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
            
            # Open browser with search
            try:
                subprocess.run(['chrome', search_url], check=False, timeout=5)
            except:
                subprocess.run(['start', search_url], shell=True, check=False, timeout=5)
            
            return {
                "success": True,
                "result": {"search_url": search_url, "query": query, "engine": engine},
                "message": f"Opened browser and searched for '{query}' on {engine}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to search for '{query}'"
            }
    
    async def _mouse_click(self, x: int, y: int, button: str = "left") -> Dict[str, Any]:
        """Click mouse at specific coordinates."""
        try:
            import pyautogui
            pyautogui.FAILSAFE = True  # Safety feature
            
            if button.lower() == "left":
                pyautogui.click(x, y)
            elif button.lower() == "right":
                pyautogui.rightClick(x, y)
            elif button.lower() == "middle":
                pyautogui.middleClick(x, y)
            
            return {
                "success": True,
                "result": {"x": x, "y": y, "button": button},
                "message": f"Clicked {button} mouse button at ({x}, {y})"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to click mouse at ({x}, {y})"
            }
    
    async def _keyboard_type(self, text: str, interval: float = 0.1) -> Dict[str, Any]:
        """Type text using keyboard automation."""
        try:
            import pyautogui
            pyautogui.FAILSAFE = True
            pyautogui.write(text, interval=interval)
            
            return {
                "success": True,
                "result": {"text": text, "interval": interval},
                "message": f"Typed text: '{text}'"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to type text: '{text}'"
            }
    
    async def _take_screenshot(self, save_path: str = None) -> Dict[str, Any]:
        """Take a screenshot of the screen."""
        try:
            import pyautogui
            import tempfile
            import os
            
            if not save_path:
                save_path = os.path.join(tempfile.gettempdir(), f"screenshot_{int(time.time())}.png")
            
            screenshot = pyautogui.screenshot()
            screenshot.save(save_path)
            
            return {
                "success": True,
                "result": {"path": save_path, "size": screenshot.size},
                "message": f"Screenshot saved to: {save_path}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to take screenshot"
            }
    
    async def call_function(self, function_name: str, **kwargs) -> Dict[str, Any]:
        """Call a function by name with arguments."""
        if function_name not in self.available_functions:
            return {
                "success": False,
                "error": f"Unknown function: {function_name}",
                "available": list(self.available_functions.keys())
            }
        
        try:
            func = self.available_functions[function_name]
            result = await func(**kwargs)
            return result
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Error calling function '{function_name}'"
            }
    
    def get_function_definitions(self) -> List[Dict[str, Any]]:
        """Get OpenAI-compatible function definitions for AI models."""
        return [
            {
                "name": "run_tool",
                "description": "Run a development tool (linters, formatters, tests, etc.)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tool_name": {"type": "string", "description": "Name of the tool to run"}
                    },
                    "required": ["tool_name"]
                }
            },
            {
                "name": "list_tools", 
                "description": "List all available development tools",
                "parameters": {"type": "object", "properties": {}}
            },
            {
                "name": "run_command",
                "description": "Run a system command safely",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Command to run"},
                        "args": {"type": "array", "items": {"type": "string"}, "description": "Command arguments"}
                    },
                    "required": ["command"]
                }
            },
            {
                "name": "search_files",
                "description": "Search for files in the project",
                "parameters": {
                    "type": "object", 
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "max_results": {"type": "integer", "description": "Maximum results to return"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_system_info",
                "description": "Get current system metrics and information",
                "parameters": {"type": "object", "properties": {}}
            },
            {
                "name": "open_browser",
                "description": "Open browser with optional URL",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to open (optional)"}
                    }
                }
            },
            {
                "name": "search_web",
                "description": "Search the web using Google or Bing",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "engine": {"type": "string", "description": "Search engine (google or bing)", "default": "google"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "mouse_click",
                "description": "Click mouse at specific screen coordinates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate"},
                        "y": {"type": "integer", "description": "Y coordinate"},
                        "button": {"type": "string", "description": "Mouse button (left, right, middle)", "default": "left"}
                    },
                    "required": ["x", "y"]
                }
            },
            {
                "name": "keyboard_type",
                "description": "Type text using keyboard automation",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to type"},
                        "interval": {"type": "number", "description": "Typing speed interval", "default": 0.1}
                    },
                    "required": ["text"]
                }
            },
            {
                "name": "take_screenshot",
                "description": "Take a screenshot of the current screen",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "save_path": {"type": "string", "description": "Path to save screenshot (optional)"}
                    }
                }
            }
        ]

# Global instance
ai_tools_bridge = AIToolsBridge()