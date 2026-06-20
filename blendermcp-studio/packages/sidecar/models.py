from pydantic import BaseModel
from typing import Any, Optional, Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "tool", "system"]
    content: str | list[dict]
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class StreamRequest(BaseModel):
    conversation_id: str
    messages: list[ChatMessage]
    provider: str
    model: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    blender_session_port: Optional[int] = 9876
    temperature: float = 0.7
    max_tokens: int = 4096


class WSEvent(BaseModel):
    type: str
    data: dict[str, Any] = {}
