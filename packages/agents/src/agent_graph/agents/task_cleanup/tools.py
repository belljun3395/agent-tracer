"""task-cleanup의 도구 계약, callback 실행, 결과 정규화."""

from __future__ import annotations

import json
from typing import Any

import httpx
from langchain_core.messages import AIMessage, ToolMessage
from pydantic import ValidationError

from ..runtime.callback import invoke_remote_tool
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback
from .models import CandidatePage, EventEvidence, EventPage, InspectionTarget

LIST_CANDIDATE_TASKS = "list_candidate_tasks"
GET_TASK_EVENTS = "get_task_events"
MAX_CANDIDATE_PAGES = 10
MAX_EVENT_READS = 50
MAX_PARALLEL_EVENT_READS = 8


async def load_candidate_pages(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    usage: ExecutionTrace,
) -> list[CandidatePage]:
    pages: list[CandidatePage] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    for index in range(MAX_CANDIDATE_PAGES):
        args: dict[str, Any] = {"limit": 100}
        if cursor is not None:
            args["cursor"] = cursor
        content = await _invoke(client, callback, LIST_CANDIDATE_TASKS, args)
        _record_tool(usage, LIST_CANDIDATE_TASKS, args, content, f"cleanup-bootstrap-{index + 1}")
        page = _parse_required(content, CandidatePage, LIST_CANDIDATE_TASKS)
        pages.append(page)
        if not page.truncated:
            return pages
        if page.nextCursor is None or page.nextCursor in seen_cursors:
            raise ValueError("list_candidate_tasks returned an invalid pagination cursor")
        seen_cursors.add(page.nextCursor)
        cursor = page.nextCursor
    raise ValueError(f"list_candidate_tasks exceeded {MAX_CANDIDATE_PAGES} pages")


async def inspect_target(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    usage: ExecutionTrace,
    target: InspectionTarget,
    call_id: str,
) -> EventEvidence:
    args = target.model_dump(exclude={"purpose"}, exclude_none=True)
    content = await _invoke(client, callback, GET_TASK_EVENTS, args)
    _record_tool(usage, GET_TASK_EVENTS, args, content, call_id)
    try:
        page = EventPage.model_validate_json(content)
    except (ValidationError, ValueError):
        page = None
    return EventEvidence(taskId=target.taskId, args=args, content=content, page=page)


async def _invoke(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    name: str,
    args: dict[str, Any],
) -> str:
    async with tool_span(name, agent_name="task-cleanup", parameters=args):
        return await invoke_remote_tool(client, callback, name, args)


def _parse_required[SchemaT: CandidatePage](
    content: str,
    schema: type[SchemaT],
    tool_name: str,
) -> SchemaT:
    try:
        return schema.model_validate(json.loads(content))
    except (json.JSONDecodeError, ValidationError, ValueError) as err:
        raise ValueError(f"{tool_name} returned an invalid response") from err


def _record_tool(
    usage: ExecutionTrace,
    name: str,
    args: dict[str, Any],
    content: str,
    call_id: str,
) -> None:
    usage.record_message(
        AIMessage(
            content=f"Read cleanup evidence with {name}.",
            tool_calls=[{"name": name, "args": args, "id": call_id, "type": "tool_call"}],
        )
    )
    usage.record_message(ToolMessage(content=content, name=name, tool_call_id=call_id))
