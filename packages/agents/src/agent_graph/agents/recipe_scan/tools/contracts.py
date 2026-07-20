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
MAX_CITED_IDS = 200
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


class CheckCitationsArgs(RecipeToolArgs):
    """인용 예정 식별자가 근거 장부에 있는지 묻는 인자를 검증한다."""

    taskId: TrimmedStr = Field(min_length=1)
    eventIds: list[TrimmedStr] = Field(default_factory=list, max_length=MAX_CITED_IDS)
    turnIds: list[TrimmedStr] = Field(default_factory=list, max_length=MAX_CITED_IDS)
    ruleIds: list[TrimmedStr] = Field(default_factory=list, max_length=MAX_CITED_IDS)


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

# 모델이 읽는 문장은 커널의 골든 계약이 소유하며 두 실행 백엔드가 같은 문장을 쓴다.
_DESCRIPTIONS: dict[str, str] = {
    "get_task_summary": (
        "Get a cheap task overview (tool usage counts, top files touched, top commands run, first "
        "user message) aggregated over the task's earliest events, window many, default "
        f"{DEFAULT_SUMMARY_WINDOW}. The response's truncated/totalEventCount fields tell you whether "
        "later events were left out."
    ),
    "get_task_events": (
        "Get a page of a task's chronological event sequence (user messages, assistant messages, tool "
        f"runs), up to {MAX_EVENT_LIMIT} events per page. You choose how much to read: pick limit, pass the "
        "response's nextCursor back as cursor to keep paging, and set order=\"desc\" to start from the "
        "latest events. truncated/total tell you whether more events exist."
    ),
    "list_rules": (
        "List existing global and task-scoped rules that apply to the anchor task, so friction a rule "
        "already governs is cited by rule ID in governing_rules instead of re-described."
    ),
    "search_events": (
        "Search indexed events by title/body, ranked by recency. Use q with optional taskId, kind, or "
        "toolName filters to find user corrections, instructions, and friction evidence. Pick limit "
        f"(up to {MAX_SEARCH_LIMIT} per call) and offset to page through as many results as you need."
    ),
    "find_similar_tasks": (
        "Find tasks with titles similar to the anchor task. Use after inspecting the anchor to check "
        "whether the workflow repeats."
    ),
    "check_citations": (
        "Check whether the IDs you plan to cite are backed by what your tools actually returned, "
        "before you write the final candidates. Pass the task plus the event, turn, and rule IDs you "
        "intend to use; the response names the ones that are not citable. A single unsupported ID "
        "gets the whole candidate list rejected, so verify here instead of spending your one repair "
        "on it."
    ),
    "search_recipes": (
        "Search existing recipes for possible duplicate or outdated targets. Use this before setting "
        "revises_recipe_id."
    ),
}

RECIPE_TOOLS: tuple[RecipeToolDefinition, ...] = (
    RecipeToolDefinition("get_task_summary", _DESCRIPTIONS["get_task_summary"], GetTaskSummaryArgs),
    RecipeToolDefinition("get_task_events", _DESCRIPTIONS["get_task_events"], GetTaskEventsArgs),
    RecipeToolDefinition("list_rules", _DESCRIPTIONS["list_rules"], ListRulesArgs),
    RecipeToolDefinition("search_events", _DESCRIPTIONS["search_events"], SearchEventsArgs),
    RecipeToolDefinition("find_similar_tasks", _DESCRIPTIONS["find_similar_tasks"], FindSimilarTasksArgs),
    RecipeToolDefinition("search_recipes", _DESCRIPTIONS["search_recipes"], SearchRecipesArgs),
    RecipeToolDefinition("check_citations", _DESCRIPTIONS["check_citations"], CheckCitationsArgs),
)

_TOOL_BY_NAME = {tool.name: tool for tool in RECIPE_TOOLS}


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 콜백 인자를 만든다."""
    definition = next((tool for tool in RECIPE_TOOLS if tool.name == name), None)
    if definition is None:
        raise ValueError(f"unknown recipe-scan tool: {name}")
    validated: dict[str, Any] = definition.args_model.model_validate(args).model_dump(exclude_none=True)
    return validated
