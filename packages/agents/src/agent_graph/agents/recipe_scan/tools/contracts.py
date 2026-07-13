"""recipe-scan 도구 이름과 인자 스키마 카탈로그를 소유한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field

from ...shared.models import TrimmedStr
from ..models import RecipeToolName

DEFAULT_SUMMARY_WINDOW = 400
MAX_SUMMARY_WINDOW = 2_000
DEFAULT_EVENT_LIMIT = 100
MAX_EVENT_LIMIT = 300
DEFAULT_SEARCH_LIMIT = 20
MAX_SEARCH_LIMIT = 100
MAX_SEARCH_OFFSET = 9_900
DEFAULT_SIMILAR_LIMIT = 5
MAX_SIMILAR_LIMIT = 20


class _EvidenceQueryLike(Protocol):
    @property
    def tool(self) -> RecipeToolName: ...

    @property
    def args(self) -> dict[str, Any]: ...


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
    """태스크 이벤트 검색 인자를 검증한다."""

    q: TrimmedStr = Field(min_length=1)
    taskId: TrimmedStr = Field(min_length=1)
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

    def catalog_entry(self) -> dict[str, object]:
        """모델 프롬프트에 넣을 도구 카탈로그 항목을 만든다."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.args_model.model_json_schema(),
        }


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
        "Search indexed event titles and bodies for corrections, instructions, and friction evidence.",
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


def tool_catalog() -> list[dict[str, object]]:
    """모델에 노출할 recipe-scan 도구 카탈로그를 반환한다."""
    return [tool.catalog_entry() for tool in RECIPE_TOOLS]


def validate_query(query: _EvidenceQueryLike) -> dict[str, Any]:
    """도구 질의를 소유 스키마로 검증하고 콜백 인자를 만든다."""
    definition = _TOOL_BY_NAME[query.tool]
    return definition.args_model.model_validate(query.args).model_dump(exclude_none=True)
