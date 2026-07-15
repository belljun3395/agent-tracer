"""title-suggestion의 표준 LangChain agent와 실행 컨텍스트를 제공한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Literal, cast

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import SystemMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import Field

from ..runtime.llm.standard_agent import StandardAgentContext, StandardAgentMiddleware
from .models import TitleSuggestionDraft
from .policy import MAX_TOOL_ROUNDS
from .tools import (
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    GET_TASK_EVENTS_DESCRIPTION,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    invoke_tool,
)


@dataclass
class TitleAgentContext(StandardAgentContext):
    """title-suggestion 도구에 요청별 실행 의존성을 제공한다."""


@tool("get_task_events", description=GET_TASK_EVENTS_DESCRIPTION)
async def get_task_events(
    taskId: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[TitleAgentContext],
    limit: Annotated[int, Field(ge=MIN_EVENT_LIMIT, le=MAX_EVENT_LIMIT)] = DEFAULT_EVENT_LIMIT,
    cursor: Annotated[str, Field(min_length=1)] | None = None,
    order: Literal["asc", "desc"] = DEFAULT_EVENT_ORDER,
) -> str:
    """대화 발췌만으로 작업을 특정할 수 없을 때 태스크 이벤트 한 페이지를 읽는다."""
    args = {"taskId": taskId, "limit": limit, "order": order}
    if cursor is not None:
        args["cursor"] = cursor
    context = runtime.context
    return await invoke_tool(context.client, context.callback, "get_task_events", args)


def build_title_agent(chat: Any, system_prompt: str) -> CompiledStateGraph[Any, Any, Any, Any]:
    """표준 도구 실행과 구조화 출력을 갖춘 title agent를 컴파일한다."""
    system = SystemMessage(
        content=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
    )
    return cast(
        CompiledStateGraph[Any, Any, Any, Any],
        create_agent(
            chat,
            tools=[get_task_events],
            system_prompt=system,
            middleware=cast(
                Any,
                [
                    ModelCallLimitMiddleware(run_limit=MAX_TOOL_ROUNDS + 2, exit_behavior="error"),
                    StandardAgentMiddleware(),
                ],
            ),
            response_format=ToolStrategy(TitleSuggestionDraft, handle_errors=True),
            context_schema=TitleAgentContext,
            name="title-suggestion-investigator",
        ),
    )
