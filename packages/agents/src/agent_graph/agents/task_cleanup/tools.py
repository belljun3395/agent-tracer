"""task-cleanup의 도구 계약과 콜백 실행과 근거 장부 기록."""

from __future__ import annotations

import json
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from ..runtime.callback import invoke_remote_tool
from ..runtime.llm.tool_loop import ToolSpec
from ..runtime.telemetry.spans import tool_span
from ..shared.models import ToolCallback, TrimmedStr
from .models import CandidatePage, CleanupCandidate, EventPage

LIST_CANDIDATE_TASKS = "list_candidate_tasks"
GET_TASK_EVENTS = "get_task_events"
CANDIDATE_PAGE_LIMIT = 100
EVENT_PAGE_LIMIT = 100


class ListCandidateTasksArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=CANDIDATE_PAGE_LIMIT, ge=1, le=CANDIDATE_PAGE_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)


class GetTaskEventsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=EVENT_PAGE_LIMIT, ge=1, le=EVENT_PAGE_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    order: Literal["desc", "asc"] = "desc"


CLEANUP_TOOL_SPECS: tuple[ToolSpec, ...] = (
    ToolSpec(
        LIST_CANDIDATE_TASKS,
        "List tasks that look abandoned or mislabeled. Page with cursor while truncated is true.",
        ListCandidateTasksArgs,
    ),
    ToolSpec(
        GET_TASK_EVENTS,
        "Read one page of a candidate task's events to judge whether it is really abandoned.",
        GetTaskEventsArgs,
    ),
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
