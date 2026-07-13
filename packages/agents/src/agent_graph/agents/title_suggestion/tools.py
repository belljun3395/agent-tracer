"""title-suggestion의 이벤트 조회 정책과 콜백 실행."""

from __future__ import annotations

from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from ..runtime.callback import invoke_remote_tool
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback, TrimmedStr
from .models import TitleEventRecord

GET_TASK_EVENTS_TOOL_NAME = "get_task_events"
EVENT_PAGE_LIMIT = 100
MAX_EVENT_PAGES = 2


class GetTaskEventsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=EVENT_PAGE_LIMIT, ge=1, le=EVENT_PAGE_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    order: Literal["desc"] = "desc"


class TitleEventPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[dict[str, object]]
    truncated: bool
    nextCursor: TrimmedStr | None = Field(default=None, min_length=1)
    total: int = Field(ge=0)


async def gather_task_events(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    task_id: str,
) -> list[TitleEventRecord]:
    """고정된 태스크의 최신 이벤트를 최대 두 페이지까지 읽는다."""
    records: list[TitleEventRecord] = []
    cursor: str | None = None
    for _ in range(MAX_EVENT_PAGES):
        args = GetTaskEventsArgs(taskId=task_id, cursor=cursor).model_dump(exclude_none=True)
        async with tool_span(
            GET_TASK_EVENTS_TOOL_NAME,
            agent_name="title-suggestion",
            parameters=args,
        ):
            content = await invoke_remote_tool(
                client,
                callback,
                GET_TASK_EVENTS_TOOL_NAME,
                args,
            )
        records.append(TitleEventRecord(args=args, content=content))
        page = _parse_page(content)
        if not page.truncated:
            break
        if page.nextCursor is None:
            raise ValueError("get_task_events returned a truncated page without nextCursor")
        cursor = page.nextCursor
    return records


def _parse_page(content: str) -> TitleEventPage:
    try:
        return TitleEventPage.model_validate_json(content)
    except ValueError as err:
        raise ValueError("get_task_events returned an invalid response") from err
