"""recipe-scan 도구 이름과 인자 스키마 카탈로그를 소유한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ...shared.models import TrimmedStr
from ..models import RecipeToolName

# 검색 필터로 노출하는 이벤트 종류이며 커널의 골든 계약이 목록을 소유한다.
TimelineEventKind = Literal[
    "execute_tool",
    "plan",
    "agent_tracer.action.logged",
    "agent_tracer.verification.logged",
    "agent_tracer.rule.logged",
    "agent_tracer.thought.logged",
    "agent_tracer.context.saved",
    "agent_tracer.context.snapshot",
    "agent_tracer.user.prompt.expansion",
    "agent_tracer.permission.request",
    "agent_tracer.worktree.remove",
    "agent_tracer.setup.triggered",
    "agent_tracer.file.changed",
    "agent_tracer.user.message",
    "agent_tracer.assistant.commentary",
    "agent_tracer.assistant.response",
    "agent_tracer.question.logged",
    "agent_tracer.todo.logged",
    "invoke_agent",
    "agent_tracer.instructions.loaded",
]

DEFAULT_SUMMARY_WINDOW = 400
MAX_SUMMARY_WINDOW = 2_000
DEFAULT_EVENT_LIMIT = 100
MAX_EVENT_LIMIT = 300
DEFAULT_SEARCH_LIMIT = 20
MAX_SEARCH_LIMIT = 100
MAX_SEARCH_OFFSET = 9_900
DEFAULT_SIMILAR_LIMIT = 5
MAX_SIMILAR_LIMIT = 20


class RecipeToolArgs(BaseModel):
    """모든 recipe-scan 도구 인자의 공통 검증 정책."""

    model_config = ConfigDict(extra="forbid")


class GetTaskSummaryArgs(RecipeToolArgs):
    """태스크 요약 조회 인자를 검증한다."""

    taskId: TrimmedStr = Field(min_length=1)
    window: int = Field(default=DEFAULT_SUMMARY_WINDOW, ge=1, le=MAX_SUMMARY_WINDOW)


class GetTaskEventsArgs(RecipeToolArgs):
    """태스크 이벤트 페이지 조회 인자를 검증한다."""

    taskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=DEFAULT_EVENT_LIMIT, ge=1, le=MAX_EVENT_LIMIT)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    order: Literal["asc", "desc"] = "asc"


class ListRulesArgs(RecipeToolArgs):
    """태스크 적용 규칙 조회 인자를 검증한다."""

    taskId: TrimmedStr = Field(min_length=1)


class SearchEventsArgs(RecipeToolArgs):
    """이벤트 검색 인자를 검증하며 taskId를 생략하면 태스크를 가로질러 찾는다."""

    q: TrimmedStr = Field(min_length=1)
    taskId: TrimmedStr | None = Field(default=None, min_length=1)
    kind: TimelineEventKind | None = None
    toolName: TrimmedStr | None = None
    limit: int = Field(default=DEFAULT_SEARCH_LIMIT, ge=1, le=MAX_SEARCH_LIMIT)
    offset: int = Field(default=0, ge=0, le=MAX_SEARCH_OFFSET)


class FindSimilarTasksArgs(RecipeToolArgs):
    """유사 태스크 조회 인자를 검증한다."""

    anchorTaskId: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=DEFAULT_SIMILAR_LIMIT, ge=1, le=MAX_SIMILAR_LIMIT)


class SearchRecipesArgs(RecipeToolArgs):
    """기존 레시피 검색 인자를 검증한다."""

    q: TrimmedStr = Field(min_length=1)
    limit: int = Field(default=DEFAULT_SIMILAR_LIMIT, ge=1, le=MAX_SIMILAR_LIMIT)


@dataclass(frozen=True)
class RecipeToolDefinition:
    """모델에 노출할 도구 이름과 설명과 JSON 스키마를 묶는다."""

    name: RecipeToolName
    description: str
    args_model: type[BaseModel]

RECIPE_TOOLS: tuple[RecipeToolDefinition, ...] = (
    RecipeToolDefinition(
        "get_task_summary",
        "Get a cheap task overview. Increase window when truncated indicates later activity was omitted.",
        GetTaskSummaryArgs,
    ),
    RecipeToolDefinition(
        "get_task_events",
        "Read one chronological page of raw task events. Use desc to inspect how a long task ended.",
        GetTaskEventsArgs,
    ),
    RecipeToolDefinition(
        "list_rules",
        "List global and task-scoped rules applicable to the anchor task.",
        ListRulesArgs,
    ),
    RecipeToolDefinition(
        "search_events",
        "Search indexed events by title/body, ranked by recency. Use q with optional taskId, kind, or "
        "toolName filters to find user corrections, instructions, and friction evidence. Pick limit and "
        "offset to page through as many results as you need.",
        SearchEventsArgs,
    ),
    RecipeToolDefinition(
        "find_similar_tasks",
        "Find tasks whose titles resemble the anchor after the anchor workflow is understood.",
        FindSimilarTasksArgs,
    ),
    RecipeToolDefinition(
        "search_recipes",
        "Search existing recipes before proposing a revision target.",
        SearchRecipesArgs,
    ),
)

_TOOL_BY_NAME = {tool.name: tool for tool in RECIPE_TOOLS}


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 콜백 인자를 만든다."""
    definition = next((tool for tool in RECIPE_TOOLS if tool.name == name), None)
    if definition is None:
        raise ValueError(f"unknown recipe-scan tool: {name}")
    validated: dict[str, Any] = definition.args_model.model_validate(args).model_dump(exclude_none=True)
    return validated
