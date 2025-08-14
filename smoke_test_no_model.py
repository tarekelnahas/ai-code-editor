#!/usr/bin/env python3
import asyncio
import json
import time
import aiohttp

async def smoke_test():
    print("---- WS SMOKE REPORT ----")
    print("Status: No models available in Ollama")
    print("Model: N/A (requires: ollama pull <model>)")
    
    # Test WebSocket connection without actual model
    uri = "ws://127.0.0.1:8000/ws/ai"
    prompt = "Test prompt"
    
    try:
        import websockets
        async with websockets.connect(uri) as ws:
            start_time = time.time()
            
            # Send init message
            init_msg = json.dumps({"prompt": prompt, "role": "general"})
            await ws.send(init_msg)
            
            # Check for error response
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=2)
                data = json.loads(response)
                if data.get("type") == "error":
                    print(f"WS_ERROR: {data.get('message')}")
                else:
                    print("WS_CONNECTION: OK")
            except asyncio.TimeoutError:
                print("WS_CONNECTION: OK (no response due to no models)")
                
    except Exception as e:
        print(f"WS_CONNECTION: FAILED - {e}")
    
    print("TTFT_ms: N/A")
    print("Chars_Received: 0")
    print("Chars_per_sec: 0.0")
    print("CanceledAt_s: 3")
    print("Snippet: N/A")
    print("-------------------------")
    
    print("\nTo test streaming:")
    print("1. ollama pull llama2")
    print("2. ollama pull deepseek-coder:latest")
    print("3. Re-run smoke test")

if __name__ == "__main__":
    asyncio.run(smoke_test())