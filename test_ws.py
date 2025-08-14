import asyncio
import websockets
import json

async def test_ws():
    try:
        async with websockets.connect('ws://127.0.0.1:8000/ws/ai') as websocket:
            message = json.dumps({"prompt": "Hello, how are you?", "role": "general"})
            await websocket.send(message)
            
            print("Connected to WebSocket!")
            
            async for response in websocket:
                data = json.loads(response)
                print(f"Received: {data}")
                if data.get("type") == "end":
                    break
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())