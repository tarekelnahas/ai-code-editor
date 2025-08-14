#!/usr/bin/env python3
import asyncio
import json
import time
import aiohttp

async def smoke_test():
    print("---- WS SMOKE REPORT ----")
    
    try:
        # Check available models
        async with aiohttp.ClientSession() as session:
            async with session.get('http://127.0.0.1:11434/api/tags') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m['name'] for m in data.get('models', [])]
                    model = models[0] if models else "llama2"
                else:
                    model = "llama2"
    except:
        model = "llama2"
    
    uri = "ws://127.0.0.1:8000/ws/ai"
    prompt = "Write a short Python hello-world, one line only. Explain in 1 short sentence."
    
    try:
        import websockets
        # First check if we can list available models
        import aiohttp
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get('http://127.0.0.1:11434/api/tags') as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        models = [m['name'] for m in data.get('models', [])]
                        if models:
                            model = models[0]
                        else:
                            print("No models found, using default")
                            model = "llama2"
                    else:
                        model = "llama2"
            except Exception as e:
                print(f"Model check error: {e}")
                model = "llama2"
        
        async with websockets.connect(uri) as ws:
            start_time = time.time()
            first_token_time = None
            acc = ""
            
            # Send init message with specific model
            init_msg = json.dumps({"prompt": prompt, "role": "general"})
            await ws.send(init_msg)
            
            # Receive loop with 3s cancel
            cancel_time = start_time + 3
            
            async for message in ws:
                current_time = time.time()
                
                try:
                    data = json.loads(message)
                    if data.get("type") == "start":
                        model = data.get("model", model)
                    elif data.get("type") == "delta":
                        if first_token_time is None:
                            first_token_time = current_time
                        token = data.get("response", "")
                        acc += token
                    elif data.get("type") == "end":
                        break
                    elif data.get("type") == "error":
                        print(f"WS_ERROR: {data.get('message')}")
                        break
                except json.JSONDecodeError:
                    pass
                
                # Cancel after 3 seconds
                if current_time >= cancel_time:
                    await ws.close()
                    break
                
                # Safety exit after 10 seconds
                if current_time - start_time >= 10:
                    break
            
            elapsed = time.time() - start_time
            chars_received = len(acc)
            ttft_ms = (first_token_time - start_time) * 1000 if first_token_time else None
            chars_per_sec = chars_received / elapsed if elapsed > 0 else 0
            
            print(f"Model: {model}")
            print(f"TTFT_ms: {ttft_ms:.0f}" if ttft_ms else "TTFT_ms: N/A")
            print(f"Chars_Received: {chars_received}")
            print(f"Chars_per_sec: {chars_per_sec:.1f}")
            print(f"CanceledAt_s: 3")
            snippet = acc[:120].replace('\r', ' ').replace('\n', ' ')
            print(f"Snippet: {snippet}")
            
    except Exception as e:
        print(f"ERROR: {e}")
    
    print("-------------------------")

if __name__ == "__main__":
    asyncio.run(smoke_test())