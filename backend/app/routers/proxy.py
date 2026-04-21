"""
Anthropic API Proxy - intercepts all requests, logs them, and forwards to Anthropic.
Clients set ANTHROPIC_BASE_URL to point here.
"""
import time
import uuid
from datetime import datetime

import httpx
import structlog
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse

from app.config import settings
from app.db import async_session
from app.crud.logs import save_log, upsert_session

logger = structlog.get_logger()
router = APIRouter()

# Pricing per 1M tokens (approximate, 2026 rates)
PRICING = {
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5": {"input": 0.80, "output": 4.0},
}
DEFAULT_PRICING = {"input": 3.0, "output": 15.0}


def estimate_cost(model: str | None, tokens_in: int, tokens_out: int) -> float:
    pricing = DEFAULT_PRICING
    if model:
        for key, p in PRICING.items():
            if key in model:
                pricing = p
                break
    return (tokens_in * pricing["input"] + tokens_out * pricing["output"]) / 1_000_000


def extract_tool_calls(response_body: dict) -> list[dict]:
    """Extract tool use blocks from response."""
    tools = []
    for block in response_body.get("content", []):
        if block.get("type") == "tool_use":
            tools.append({
                "id": block.get("id"),
                "name": block.get("name"),
                "input": block.get("input"),
            })
    return tools


def extract_tool_results(messages: list[dict]) -> list[dict]:
    """Extract tool results from request messages."""
    results = []
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        results.append({
                            "tool_use_id": block.get("tool_use_id"),
                            "content": block.get("content"),
                            "is_error": block.get("is_error", False),
                        })
    return results


def classify_operations(tool_calls: list[dict]) -> dict:
    """Classify tool calls into categories (git, computer_use, etc.)."""
    git_ops = []
    computer_use = []

    for tc in tool_calls:
        name = tc.get("name", "")
        inp = tc.get("input", {})

        if name == "bash" and isinstance(inp, dict):
            cmd = inp.get("command", "")
            if cmd.startswith("git "):
                git_ops.append({"command": cmd, "tool_id": tc.get("id")})

        if name in ("computer", "screenshot", "mouse", "keyboard"):
            computer_use.append(tc)

    return {"git_operations": git_ops, "computer_use": computer_use}


@router.api_route("/v1/messages", methods=["POST"])
async def proxy_messages(request: Request):
    """Main proxy endpoint - Anthropic /v1/messages compatible."""
    start_time = time.time()
    request_id = str(uuid.uuid4())

    # Extract client ID from header or default
    client_id = request.headers.get("x-client-id", "unknown")
    session_id = request.headers.get("x-session-id", request_id)

    # Read request body
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model")
    system_prompt = None
    if isinstance(body.get("system"), str):
        system_prompt = body["system"]
    elif isinstance(body.get("system"), list):
        system_prompt = str(body["system"])

    # Check if streaming
    is_stream = body.get("stream", False)

    # Forward all anthropic-* headers and auth headers
    forward_headers = {"content-type": "application/json"}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower.startswith("anthropic-"):
            forward_headers[key] = value
        elif lower == "x-api-key":
            forward_headers[key] = value
        elif lower == "authorization":
            # Convert Bearer token to x-api-key for Anthropic
            if value.startswith("Bearer "):
                forward_headers["x-api-key"] = value.removeprefix("Bearer ")
            else:
                forward_headers["authorization"] = value

    # Extract tool results from request
    tool_results = extract_tool_results(messages)

    target_url = f"{settings.anthropic_api_url}/v1/messages"

    if is_stream:
        return await _handle_streaming(
            target_url, forward_headers, body, client_id, session_id,
            request_id, model, system_prompt, messages, tool_results, start_time
        )
    else:
        return await _handle_non_streaming(
            target_url, forward_headers, body, client_id, session_id,
            request_id, model, system_prompt, messages, tool_results, start_time
        )


async def _handle_non_streaming(
    target_url, headers, body, client_id, session_id,
    request_id, model, system_prompt, messages, tool_results, start_time
):
    async with httpx.AsyncClient(timeout=300) as client:
        try:
            resp = await client.post(target_url, json=body, headers=headers)
            latency_ms = int((time.time() - start_time) * 1000)

            response_body = resp.json() if resp.status_code == 200 else {}
            usage = response_body.get("usage", {})
            tokens_in = usage.get("input_tokens", 0)
            tokens_out = usage.get("output_tokens", 0)
            cost = estimate_cost(model, tokens_in, tokens_out)

            tool_calls = extract_tool_calls(response_body) if resp.status_code == 200 else []
            ops = classify_operations(tool_calls)

            # Save log
            log_data = {
                "id": uuid.UUID(request_id),
                "client_id": client_id,
                "session_id": session_id,
                "request_id": request_id,
                "timestamp": datetime.utcnow(),
                "model": response_body.get("model", model),
                "prompt": messages,
                "system_prompt": system_prompt,
                "response": response_body.get("content"),
                "stop_reason": response_body.get("stop_reason"),
                "tool_calls": tool_calls,
                "tool_results": tool_results,
                "computer_use": ops["computer_use"],
                "git_operations": ops["git_operations"],
                "latency_ms": latency_ms,
                "tokens_input": tokens_in,
                "tokens_output": tokens_out,
                "cost_usd": cost,
                "status_code": resp.status_code,
                "error": resp.json() if resp.status_code >= 400 else None,
            }

            try:
                async with async_session() as db:
                    await save_log(db, log_data)
                    await upsert_session(db, client_id, session_id, tokens_in, tokens_out, cost)
            except Exception as e:
                logger.error("Failed to save log", error=str(e))

            # Strip hop-by-hop and encoding headers (httpx auto-decompresses)
            safe_headers = {
                k: v for k, v in resp.headers.items()
                if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")
            }
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=safe_headers,
            )

        except httpx.TimeoutException:
            return Response(
                content='{"error": "Upstream timeout"}',
                status_code=504,
                media_type="application/json",
            )


async def _handle_streaming(
    target_url, headers, body, client_id, session_id,
    request_id, model, system_prompt, messages, tool_results, start_time
):
    """Handle streaming responses - collect chunks for logging while streaming to client."""

    collected_chunks = []
    response_content = []
    usage_data = {}
    stop_reason = None
    resp_model = model

    async def stream_and_log():
        nonlocal usage_data, stop_reason, resp_model

        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream("POST", target_url, json=body, headers=headers) as resp:
                async for line in resp.aiter_lines():
                    yield line + "\n"
                    collected_chunks.append(line)

                    # Parse SSE events for logging
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            import json
                            data = json.loads(line[6:])
                            event_type = data.get("type", "")

                            if event_type == "message_start":
                                msg = data.get("message", {})
                                resp_model = msg.get("model", model)
                                u = msg.get("usage", {})
                                usage_data["input_tokens"] = u.get("input_tokens", 0)

                            elif event_type == "content_block_start":
                                block = data.get("content_block", {})
                                if block.get("type") == "tool_use":
                                    response_content.append(block)

                            elif event_type == "message_delta":
                                delta = data.get("delta", {})
                                stop_reason = delta.get("stop_reason", stop_reason)
                                u = data.get("usage", {})
                                if "output_tokens" in u:
                                    usage_data["output_tokens"] = u["output_tokens"]

                        except Exception:
                            pass

        # After streaming completes, save log
        latency_ms = int((time.time() - start_time) * 1000)
        tokens_in = usage_data.get("input_tokens", 0)
        tokens_out = usage_data.get("output_tokens", 0)
        cost = estimate_cost(resp_model, tokens_in, tokens_out)

        tool_calls = [b for b in response_content if b.get("type") == "tool_use"]
        ops = classify_operations(tool_calls)

        log_data = {
            "id": uuid.UUID(request_id),
            "client_id": client_id,
            "session_id": session_id,
            "request_id": request_id,
            "timestamp": datetime.utcnow(),
            "model": resp_model,
            "prompt": messages,
            "system_prompt": system_prompt,
            "response": {"streamed": True, "content_blocks": response_content},
            "stop_reason": stop_reason,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "computer_use": ops["computer_use"],
            "git_operations": ops["git_operations"],
            "latency_ms": latency_ms,
            "tokens_input": tokens_in,
            "tokens_output": tokens_out,
            "cost_usd": cost,
            "status_code": 200,
            "error": None,
        }

        try:
            async with async_session() as db:
                await save_log(db, log_data)
                await upsert_session(db, client_id, session_id, tokens_in, tokens_out, cost)
        except Exception as e:
            logger.error("Failed to save streaming log", error=str(e))

    return StreamingResponse(
        stream_and_log(),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-request-id": request_id},
    )
