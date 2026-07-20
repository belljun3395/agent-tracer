"""요청별 의존을 받아 recipe-scan 도구 레지스트리를 조립하고 인자를 검증한다."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from ...runtime.tooling import AgentTool, ToolRegistry
from ..models import ProbeName, ProvenanceCatalog
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader
from .check_citations import CHECK_CITATIONS, CheckCitationsTool
from .find_similar_tasks import FIND_SIMILAR_TASKS, FindSimilarTasksTool
from .get_task_events import GET_TASK_EVENTS, GetTaskEventsTool
from .get_task_summary import GET_TASK_SUMMARY, GetTaskSummaryTool
from .list_rules import LIST_RULES, ListRulesTool
from .search_events import SEARCH_EVENTS, SearchEventsTool
from .search_recipes import SEARCH_RECIPES, SearchRecipesTool

RECIPE_TOOL_CLASSES: tuple[type[AgentTool[Any]], ...] = (
    GetTaskSummaryTool,
    GetTaskEventsTool,
    ListRulesTool,
    SearchEventsTool,
    FindSimilarTasksTool,
    SearchRecipesTool,
    CheckCitationsTool,
)

# 전문가는 자기 근거 원천에 닿는 도구 이름만 쥔다. 인용 확인은 어느 전문가든 쓰므로 모두에게 준다.
PROBE_TOOLS: dict[ProbeName, tuple[str, ...]] = {
    "timeline": (GET_TASK_SUMMARY, GET_TASK_EVENTS, SEARCH_EVENTS, CHECK_CITATIONS),
    "rules": (LIST_RULES, SEARCH_RECIPES, CHECK_CITATIONS),
    "repetition": (SEARCH_EVENTS, FIND_SIMILAR_TASKS, CHECK_CITATIONS),
}

_ARGS_BY_TOOL: dict[str, type[BaseModel]] = {cls.name: cls.args_model for cls in RECIPE_TOOL_CLASSES}


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 조회 인자를 만든다."""
    args_model = _ARGS_BY_TOOL.get(name)
    if args_model is None:
        raise ValueError(f"unknown recipe-scan tool: {name}")
    return args_model.model_validate(args).model_dump(exclude_none=True)


def build_recipe_registry(
    reader: RecipeLedgerReader,
    search: RecipeSearchReader,
    catalog: ProvenanceCatalog,
    names: tuple[str, ...] | None = None,
    *,
    agent_name: str,
) -> ToolRegistry:
    """요청별 원장·색인 조회와 공유 근거 장부를 쥔 도구 레지스트리를 만들되 이름으로 부분집합을 고른다."""
    built: tuple[AgentTool[Any], ...] = (
        GetTaskSummaryTool(reader),
        GetTaskEventsTool(reader, catalog),
        ListRulesTool(reader, catalog),
        SearchEventsTool(search, catalog),
        FindSimilarTasksTool(reader, search),
        SearchRecipesTool(search, catalog),
        CheckCitationsTool(catalog),
    )
    chosen = built if names is None else tuple(tool for tool in built if tool.name in names)
    return ToolRegistry(chosen, agent_name=agent_name)
