import json
import logging
import traceback
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mcp_client import list_mcp_tools, disconnect_mcp
from llm_bridge import stream_chat
from models import StreamRequest

logger = logging.getLogger(__name__)

app = FastAPI(title="BlenderMCP Studio Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost", "http://localhost:1420"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/tools/{port}")
async def get_tools(port: int = 9876):
    tools = await list_mcp_tools(port)
    return {"tools": tools}


@app.delete("/session/{port}")
async def delete_session(port: int):
    await disconnect_mcp(port)
    return {"status": "disconnected"}


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            req = StreamRequest.model_validate_json(data)
            async for event in stream_chat(req):
                await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket chat error:\n%s", traceback.format_exc())
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
