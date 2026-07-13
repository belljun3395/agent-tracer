"""Python 에이전트 도구가 공유하는 워커 콜백 전송 경로."""

from __future__ import annotations

from typing import Any

import httpx

from ..shared.models import ToolCallback
from .telemetry.propagation import inject_trace_context


async def invoke_remote_tool(
    client: httpx.AsyncClient, callback: ToolCallback, name: str, args: dict[str, Any]
) -> str:
    # 워커 콜백은 W3C trace context를 HTTP 헤더로 전달받는다.
    headers = inject_trace_context({})
    response = await client.post(
        callback.url, json={"token": callback.token, "name": name, "args": args}, headers=headers
    )
    response.raise_for_status()
    payload: dict[str, Any] = response.json()
    error = payload.get("error")
    if error is not None:
        return f"Tool {name} failed: {error}"
    return str(payload["content"])
