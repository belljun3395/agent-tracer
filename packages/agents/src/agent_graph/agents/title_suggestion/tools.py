"""title-suggestion의 도구 계약과 콜백 실행."""

from __future__ import annotations

from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from ..runtime.callback import invoke_remote_tool
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback, TrimmedStr

GET_TASK_EVENTS_TOOL_NAME = "get_task_events"
DEFAULT_EVENT_LIMIT = 100
MIN_EVENT_LIMIT = 1
MAX_EVENT_LIMIT = 300
DEFAULT_EVENT_ORDER: Literal["asc", "desc"] = "asc"
GET_TASK_EVENTS_DESCRIPTION = (
    "Read one page of the task's raw events when the recorded conversation cannot name the work: "
    f"pick limit (default {DEFAULT_EVENT_LIMIT}, hard cap {MAX_EVENT_LIMIT}), pass the response's "
    'nextCursor back as cursor to keep paging, and set order="desc" to read the latest events first.'
)


class GetTaskEventsArgs(BaseModel):
    """태스크 이벤트 페이지 조회 인자를 커널의 골든 계약대로 검증한다."""

    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=DEFAULT_EVENT_LIMIT, ge=MIN_EVENT_LIMIT, le=MAX_EVENT_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    order: Literal["asc", "desc"] = DEFAULT_EVENT_ORDER


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 콜백 인자를 만든다."""
    if name != GET_TASK_EVENTS_TOOL_NAME:
        raise ValueError(f"unknown title-suggestion tool: {name}")
    validated: dict[str, Any] = GetTaskEventsArgs.model_validate(args).model_dump(exclude_none=True)
    return validated


async def invoke_tool(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    name: str,
    args: dict[str, Any],
) -> str:
    """모델이 고른 도구를 인자 검증 뒤 워커 콜백으로 실행한다."""
    validated = validate_tool_args(name, args)
    async with tool_span(name, agent_name="title-suggestion", parameters=validated):
        return await invoke_remote_tool(client, callback, name, validated)
