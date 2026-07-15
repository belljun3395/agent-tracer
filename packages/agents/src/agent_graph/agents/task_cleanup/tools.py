"""task-cleanup의 도구 계약과 콜백 실행과 근거 장부 기록."""

from __future__ import annotations

import json
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from ..runtime.callback import invoke_remote_tool
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback, TrimmedStr
from .models import CandidatePage, CleanupCandidate, EventPage

LIST_CANDIDATE_TASKS = "list_candidate_tasks"
GET_TASK_EVENTS = "get_task_events"
DEFAULT_CANDIDATE_LIMIT = 30
MAX_CANDIDATE_LIMIT = 100
DEFAULT_EVENT_LIMIT = 100
MAX_EVENT_LIMIT = 300

EventOrder = Literal["asc", "desc"]
DEFAULT_EVENT_ORDER: EventOrder = "asc"


class ListCandidateTasksArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # 인자를 생략하면 워커 콜백이 자기 기본값을 적용하므로 여기서 기본값을 채우지 않는다.
    limit: int | None = Field(
        default=None,
        ge=1,
        le=MAX_CANDIDATE_LIMIT,
        description=(
            f"Max candidates in this page (default {DEFAULT_CANDIDATE_LIMIT}, "
            f"hard cap {MAX_CANDIDATE_LIMIT})"
        ),
    )
    cursor: TrimmedStr | None = Field(
        default=None,
        min_length=1,
        description=(
            "Opaque cursor from a previous call's nextCursor. Omit to start from the first candidate."
        ),
    )


class GetTaskEventsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1, description="The task ID")
    limit: int | None = Field(
        default=None,
        ge=1,
        le=MAX_EVENT_LIMIT,
        description=(
            f"Max events to return in this page (default {DEFAULT_EVENT_LIMIT}, "
            f"hard cap {MAX_EVENT_LIMIT})"
        ),
    )
    cursor: TrimmedStr | None = Field(
        default=None,
        min_length=1,
        description=(
            "Opaque cursor from a previous call's nextCursor. Omit to start from the first page."
        ),
    )
    order: EventOrder | None = Field(
        default=None,
        description=(
            'Reading direction: "asc" (default) pages from the earliest event forward; '
            '"desc" pages from the latest event backward.'
        ),
    )


LIST_CANDIDATE_TASKS_DESCRIPTION = (
    "List the cleanup candidates the server already qualified for this scan (hidden, active, and "
    "recently touched tasks are excluded before you see them). Each entry carries visibleTitle, "
    "status, lastEventAt, hasEvents, activeChildCount and the server-detected candidateReasons. "
    "Call this first, and page with cursor until truncated is false if you want the whole batch. "
    "Only task ids returned here may be proposed. moreCandidatesOutsideBatch=true means the server "
    "itself capped this batch; the leftover tasks are outside your reach and a future scan will "
    "pick them up."
)

GET_TASK_EVENTS_DESCRIPTION = (
    "Get a page of a task's chronological event sequence (user messages, assistant messages, tool "
    f"runs), up to {MAX_EVENT_LIMIT} events per page. You choose how much to read: pick limit, pass "
    'the response\'s nextCursor back as cursor to keep paging, and set order="desc" to start from '
    "the latest events (e.g. to see how a long task ended). truncated/total tell you whether more "
    "events exist. Call this whenever you need to see what actually happened in a task before "
    "judging it."
)

_ARGS_BY_TOOL: dict[str, type[BaseModel]] = {
    LIST_CANDIDATE_TASKS: ListCandidateTasksArgs,
    GET_TASK_EVENTS: GetTaskEventsArgs,
}


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 콜백 인자를 만든다."""
    args_model = _ARGS_BY_TOOL.get(name)
    if args_model is None:
        raise ValueError(f"unknown task-cleanup tool: {name}")
    validated: dict[str, Any] = args_model.model_validate(args).model_dump(exclude_none=True)
    return validated


async def invoke_tool(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    name: str,
    args: dict[str, Any],
) -> str:
    """모델이 고른 도구를 인자 검증 뒤 워커 콜백으로 실행한다."""
    validated = validate_tool_args(name, args)
    async with tool_span(name, agent_name="task-cleanup", parameters=validated):
        return await invoke_remote_tool(client, callback, name, validated)


def record_evidence(
    exposed: dict[str, CleanupCandidate],
    event_ids_by_task: dict[str, set[str]],
    name: str,
    args: dict[str, Any],
    content: str,
) -> None:
    """도구가 실제로 돌려준 후보와 이벤트만 인용 가능한 근거로 올린다."""
    parsed = _parse(content)
    if parsed is None:
        return
    if name == LIST_CANDIDATE_TASKS:
        for candidate in CandidatePage.model_validate(parsed).candidates:
            exposed[candidate.id] = candidate
    elif name == GET_TASK_EVENTS:
        task_id = str(args.get("taskId", ""))
        known = event_ids_by_task.setdefault(task_id, set())
        for event in EventPage.model_validate(parsed).events:
            known.add(event.id)


def _parse(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None
