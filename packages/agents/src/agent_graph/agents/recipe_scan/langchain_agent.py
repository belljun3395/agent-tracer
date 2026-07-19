"""recipe-scan의 표준 LangChain agent와 요청별 근거 컨텍스트를 제공한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Literal, cast

import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import SystemMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import Field

from ..runtime.llm.standard_agent import StandardAgentContext, StandardAgentMiddleware
from ..shared.models import ToolCallback
from .models import ProvenanceCatalog, RecipeDraft
from .tools.client import invoke_tool, record_evidence
from .tools.contracts import (
    DEFAULT_EVENT_LIMIT,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SIMILAR_LIMIT,
    DEFAULT_SUMMARY_WINDOW,
    MAX_EVENT_LIMIT,
    MAX_SEARCH_LIMIT,
    MAX_SEARCH_OFFSET,
    MAX_SIMILAR_LIMIT,
    MAX_SUMMARY_WINDOW,
    RECIPE_TOOLS,
    TimelineEventKind,
)


@dataclass
class RecipeAgentContext(StandardAgentContext):
    """recipe-scan 도구에 워커 콜백 창구와 요청별 인용 가능 근거 장부를 제공한다."""

    client: httpx.AsyncClient
    callback: ToolCallback
    provenance: ProvenanceCatalog


def _description(name: str) -> str:
    return next(tool.description for tool in RECIPE_TOOLS if tool.name == name)


@tool("get_task_summary", description=_description("get_task_summary"))
async def get_task_summary(
    taskId: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[RecipeAgentContext],
    window: Annotated[int, Field(ge=1, le=MAX_SUMMARY_WINDOW)] = DEFAULT_SUMMARY_WINDOW,
) -> str:
    """태스크의 저비용 요약을 읽는다."""
    return await _invoke_and_record(runtime.context, "get_task_summary", {"taskId": taskId, "window": window})


@tool("get_task_events", description=_description("get_task_events"))
async def get_task_events(
    taskId: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[RecipeAgentContext],
    limit: Annotated[int, Field(ge=1, le=MAX_EVENT_LIMIT)] = DEFAULT_EVENT_LIMIT,
    cursor: Annotated[str, Field(min_length=1)] | None = None,
    order: Literal["asc", "desc"] = "asc",
) -> str:
    """태스크 원본 이벤트 한 페이지를 읽는다."""
    args: dict[str, Any] = {"taskId": taskId, "limit": limit, "order": order}
    if cursor is not None:
        args["cursor"] = cursor
    return await _invoke_and_record(runtime.context, "get_task_events", args)


@tool("list_rules", description=_description("list_rules"))
async def list_rules(
    taskId: Annotated[str, Field(min_length=1)], runtime: ToolRuntime[RecipeAgentContext]
) -> str:
    """앵커 태스크에 적용되는 규칙을 읽는다."""
    return await _invoke_and_record(runtime.context, "list_rules", {"taskId": taskId})


@tool("search_events", description=_description("search_events"))
async def search_events(
    q: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[RecipeAgentContext],
    taskId: Annotated[str, Field(min_length=1)] | None = None,
    kind: TimelineEventKind | None = None,
    toolName: Annotated[str, Field(min_length=1)] | None = None,
    limit: Annotated[int, Field(ge=1, le=MAX_SEARCH_LIMIT)] = DEFAULT_SEARCH_LIMIT,
    offset: Annotated[int, Field(ge=0, le=MAX_SEARCH_OFFSET)] = 0,
) -> str:
    """인덱스에서 교정과 지시와 마찰 근거 이벤트를 검색한다."""
    args: dict[str, Any] = {"q": q, "limit": limit, "offset": offset}
    for name, value in (("taskId", taskId), ("kind", kind), ("toolName", toolName)):
        if value is not None:
            args[name] = value
    return await _invoke_and_record(runtime.context, "search_events", args)


@tool("find_similar_tasks", description=_description("find_similar_tasks"))
async def find_similar_tasks(
    anchorTaskId: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[RecipeAgentContext],
    limit: Annotated[int, Field(ge=1, le=MAX_SIMILAR_LIMIT)] = DEFAULT_SIMILAR_LIMIT,
) -> str:
    """앵커와 제목이 비슷한 태스크를 찾는다."""
    return await _invoke_and_record(
        runtime.context, "find_similar_tasks", {"anchorTaskId": anchorTaskId, "limit": limit}
    )


@tool("search_recipes", description=_description("search_recipes"))
async def search_recipes(
    q: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[RecipeAgentContext],
    limit: Annotated[int, Field(ge=1, le=MAX_SIMILAR_LIMIT)] = DEFAULT_SIMILAR_LIMIT,
) -> str:
    """수정 대상이 될 수 있는 기존 레시피를 검색한다."""
    return await _invoke_and_record(runtime.context, "search_recipes", {"q": q, "limit": limit})


RECIPE_LANGCHAIN_TOOLS = (
    get_task_summary,
    get_task_events,
    list_rules,
    search_events,
    find_similar_tasks,
    search_recipes,
)


async def _invoke_and_record(context: RecipeAgentContext, name: str, args: dict[str, Any]) -> str:
    content = await invoke_tool(context.client, context.callback, name, args)
    record_evidence(context.provenance, name, args, content)
    return content


def build_recipe_agent(
    chat: Any, system_prompt: str, max_rounds: int
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """표준 도구 실행과 구조화 출력을 갖춘 recipe-scan agent를 컴파일한다."""
    system = SystemMessage(
        content=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
    )
    return cast(
        CompiledStateGraph[Any, Any, Any, Any],
        create_agent(
            chat,
            tools=list(RECIPE_LANGCHAIN_TOOLS),
            system_prompt=system,
            middleware=cast(
                Any,
                [
                    ModelCallLimitMiddleware(run_limit=max_rounds + 2, exit_behavior="error"),
                    StandardAgentMiddleware(),
                ],
            ),
            response_format=ToolStrategy(RecipeDraft, handle_errors=True),
            context_schema=RecipeAgentContext,
            name="recipe-scan-investigator",
        ),
    )
