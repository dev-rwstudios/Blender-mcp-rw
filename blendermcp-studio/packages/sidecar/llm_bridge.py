import json
import logging
from typing import AsyncIterator
import litellm
from mcp_client import list_mcp_tools, call_mcp_tool
from models import StreamRequest

litellm.verbose = False
litellm.suppress_debug_info = True
logger = logging.getLogger(__name__)


def _provider_model(req: StreamRequest) -> tuple[str, dict]:
    extras: dict = {}
    if req.provider == "anthropic":
        model = f"anthropic/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "openai":
        model = f"openai/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "ollama":
        model = f"ollama/{req.model}"
        extras["api_base"] = req.api_base or "http://localhost:11434"
    elif req.provider == "lmstudio":
        model = f"openai/{req.model}"
        extras["api_base"] = req.api_base or "http://localhost:1234/v1"
        extras["api_key"] = "lm-studio"
    elif req.provider == "litellm_proxy":
        model = req.model
        extras["api_base"] = req.api_base
        extras["api_key"] = req.api_key
    elif req.provider == "gemini":
        model = f"gemini/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "groq":
        model = f"groq/{req.model}"
        extras["api_key"] = req.api_key
    else:
        model = req.model
    return model, extras


async def stream_chat(req: StreamRequest) -> AsyncIterator[dict]:
    port = req.blender_session_port or 9876
    mcp_tools = await list_mcp_tools(port)

    litellm_tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["inputSchema"],
            },
        }
        for t in mcp_tools
    ]

    messages = [m.model_dump(exclude_none=True) for m in req.messages]
    model, extras = _provider_model(req)

    needs_key = req.provider not in ("ollama", "lmstudio", "litellm_proxy")
    if needs_key and not req.api_key:
        raise ValueError(
            f"No API key set for provider '{req.provider}'. "
            "Go to Settings → LLM Provider, enter your API key, and click Save."
        )

    logger.info("Starting LLM call: model=%s provider=%s", model, req.provider)

    while True:
        pending_tool_calls: dict[str, dict] = {}

        response = await litellm.acompletion(
            model=model,
            messages=messages,
            tools=litellm_tools,
            tool_choice="auto",
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            stream=True,
            **extras,
        )

        stop_reason = None

        async for chunk in response:
            choice = chunk.choices[0]
            delta = choice.delta

            if delta.content:
                yield {"type": "text_delta", "delta": delta.content}

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.id:
                        pending_tool_calls[tc.id] = {
                            "name": tc.function.name or "",
                            "args_buffer": tc.function.arguments or "",
                            "id": tc.id,
                        }
                        yield {
                            "type": "tool_start",
                            "tool_name": tc.function.name,
                            "tool_use_id": tc.id,
                        }
                    elif pending_tool_calls:
                        last_id = list(pending_tool_calls.keys())[-1]
                        pending_tool_calls[last_id]["args_buffer"] += (
                            tc.function.arguments or ""
                        )
                        if tc.function.name:
                            pending_tool_calls[last_id]["name"] = tc.function.name

            if choice.finish_reason:
                stop_reason = choice.finish_reason

        if pending_tool_calls and stop_reason == "tool_calls":
            tool_calls_block = [
                {
                    "id": v["id"],
                    "type": "function",
                    "function": {"name": v["name"], "arguments": v["args_buffer"]},
                }
                for v in pending_tool_calls.values()
            ]
            messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": tool_calls_block,
                }
            )

            for tc_id, tc in pending_tool_calls.items():
                try:
                    args = json.loads(tc["args_buffer"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_input", "tool_use_id": tc_id, "input": args}

                try:
                    result = await call_mcp_tool(port, tc["name"], args)
                    is_error = result.get("isError", False)
                    content_text = json.dumps(result["content"])
                    yield {
                        "type": "tool_result",
                        "tool_use_id": tc_id,
                        "tool_name": tc["name"],
                        "result": result["content"],
                        "is_error": is_error,
                    }
                except Exception as e:
                    content_text = str(e)
                    is_error = True
                    yield {
                        "type": "tool_result",
                        "tool_use_id": tc_id,
                        "result": str(e),
                        "is_error": True,
                    }

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc_id,
                        "content": content_text,
                    }
                )

            continue

        yield {"type": "message_end", "stop_reason": stop_reason}
        break
