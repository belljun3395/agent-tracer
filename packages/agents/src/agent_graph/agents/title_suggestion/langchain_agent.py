"""title-suggestion의 표준 LangChain agent와 실행 컨텍스트를 제공한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Literal, cast

import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelCallLimitMiddleware, ModelRequest, ModelResponse
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import Field

from ..runtime.errors import OutputTruncated
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.tool_loop import ToolLoopBudget
from ..runtime.llm.trajectory import is_truncated
from ..shared.models import ToolCallback
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
class TitleAgentContext:
    """표준 agent 도구와 미들웨어가 공유하는 요청별 의존성이다."""

    client: httpx.AsyncClient
    callback: ToolCallback
    trace: ExecutionTrace
    budget: ToolLoopBudget


class TitleAgentMiddleware(AgentMiddleware[Any, TitleAgentContext, TitleSuggestionDraft]):
    """모델 비용과 실행 궤적을 기존 제품 계약으로 기록한다."""

    async def awrap_model_call(
        self,
        request: ModelRequest[TitleAgentContext],
        handler: Any,
    ) -> ModelResponse[TitleSuggestionDraft]:
        response = await handler(request.override(messages=_cache_tool_messages(request.messages)))
        for message in response.result:
            if not isinstance(message, AIMessage):
                continue
            request.runtime.context.trace.add_message(message)
            request.runtime.context.trace.record_message(message)
            request.runtime.context.budget.charge(message)
            if is_truncated(message):
                raise OutputTruncated("title-suggestion structured output truncated at max_tokens")
        return cast(ModelResponse[TitleSuggestionDraft], response)

    async def awrap_tool_call(self, request: Any, handler: Any) -> Any:
        response = await handler(request)
        if isinstance(response, ToolMessage):
            request.runtime.context.trace.record_message(response)
        return response


def _cache_tool_messages(messages: list[Any]) -> list[Any]:
    copied = list(messages)
    tool_indexes = [index for index, message in enumerate(copied) if isinstance(message, ToolMessage)]
    keep = set(tool_indexes[-2:])
    for index in tool_indexes:
        message = copied[index]
        block: dict[Any, Any] = {"type": "text", "text": _message_text(message)}
        if index in keep:
            block["cache_control"] = {"type": "ephemeral"}
        content: list[str | dict[Any, Any]] = [block]
        copied[index] = ToolMessage(
            content=content,
            name=message.name,
            tool_call_id=message.tool_call_id,
        )
    return copied


def _message_text(message: ToolMessage) -> str:
    if isinstance(message.content, str):
        return message.content
    return "".join(
        str(block.get("text", ""))
        for block in message.content
        if isinstance(block, dict) and block.get("type") == "text"
    )


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
                    TitleAgentMiddleware(),
                ],
            ),
            response_format=ToolStrategy(TitleSuggestionDraft, handle_errors=True),
            context_schema=TitleAgentContext,
            name="title-suggestion-investigator",
        ),
    )
