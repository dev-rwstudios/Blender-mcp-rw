import asyncio
import os
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

_sessions: dict[int, tuple] = {}


async def get_mcp_session(port: int = 9876) -> ClientSession:
    if port not in _sessions:
        await _connect(port)
    return _sessions[port][0]


async def _connect(port: int):
    env = {
        **os.environ,
        "BLENDER_PORT": str(port),
        "DISABLE_TELEMETRY": "true",
    }
    server_params = StdioServerParameters(
        command="uvx",
        args=["blender-mcp"],
        env=env,
    )
    cm = stdio_client(server_params)
    read, write = await cm.__aenter__()
    session_cm = ClientSession(read, write)
    session = await session_cm.__aenter__()
    await session.initialize()
    _sessions[port] = (session, [cm, session_cm])


async def disconnect_mcp(port: int):
    if port in _sessions:
        session, cms = _sessions.pop(port)
        for cm in reversed(cms):
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


async def list_mcp_tools(port: int = 9876) -> list[dict]:
    session = await get_mcp_session(port)
    result = await session.list_tools()
    return [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.inputSchema,
        }
        for t in result.tools
    ]


async def call_mcp_tool(port: int, tool_name: str, arguments: dict) -> dict:
    session = await get_mcp_session(port)
    result = await session.call_tool(tool_name, arguments)
    parts = []
    for c in result.content:
        if hasattr(c, "text"):
            parts.append({"type": "text", "text": c.text})
        elif hasattr(c, "data"):
            parts.append({"type": "image", "data": c.data, "mimeType": c.mimeType})
    return {
        "content": parts,
        "isError": result.isError,
    }
