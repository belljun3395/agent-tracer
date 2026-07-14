"""title-suggestion의 도구 계약과 콜백 실행."""

from __future__ import annotations

from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from ..runtime.callback import invoke_remote_tool
from ..runtime.llm.tool_loop import ToolSpec
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback, TrimmedStr

GET_TASK_EVENTS_TOOL_NAME = "get_task_events"
EVENT_PAGE_LIMIT = 100


class GetTaskEventsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=EVENT_PAGE_LIMIT, ge=1, le=EVENT_PAGE_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    order: Literal["desc", "asc"] = "desc"


TITLE_TOOL_SPECS: tuple[ToolSpec, ...] = (
    ToolSpec(
        GET_TASK_EVENTS_TOOL_NAME,
        "Read one page of the task's raw events when the recorded conversation cannot name the work.",
        GetTaskEventsArgs,
    ),
)


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
