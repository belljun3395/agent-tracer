"""표준 LangChain agent가 기존 비용과 궤적과 캐시 계약을 지키게 한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

import httpx
from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from ...shared.models import ToolCallback
from ..errors import OutputTruncated
from ..execution.trace import ExecutionTrace
from .budget import ToolLoopBudget
from .trajectory import is_truncated

BUDGET_NOTICE = (
    "Tool budget: {remaining} of {total} tool-calling rounds remain. "
    "Choose what to verify next within what is left."
)

FINALIZE_DIRECTIVE = (
    "The investigation budget is exhausted. Produce the final structured output now "
    "using only the evidence you already verified."
)


@dataclass
class StandardAgentContext:
    """표준 agent 도구와 미들웨어가 공유하는 요청별 실행 의존성이다."""

    agent_name: str
    client: httpx.AsyncClient
    callback: ToolCallback
    trace: ExecutionTrace
    budget: ToolLoopBudget
    max_tool_rounds: int


class StandardAgentMiddleware(AgentMiddleware[Any, StandardAgentContext, Any]):
    """모델 비용과 실행 궤적과 도구 결과를 제품 계약으로 기록한다."""

    async def awrap_model_call(
        self,
        request: ModelRequest[StandardAgentContext],
        handler: Any,
    ) -> ModelResponse[Any]:
        response = await handler(_with_budget(request))
        for message in response.result:
            if not isinstance(message, AIMessage):
                continue
            context = request.runtime.context
            context.trace.add_message(message)
            context.trace.record_message(message)
            context.budget.charge(message)
            if is_truncated(message):
                raise OutputTruncated(f"{context.agent_name} structured output truncated at max_tokens")
        return cast(ModelResponse[Any], response)

    async def awrap_tool_call(self, request: Any, handler: Any) -> Any:
        response = await handler(request)
        if isinstance(response, ToolMessage):
            request.runtime.context.trace.record_message(response)
        return response


def _with_budget(request: ModelRequest[StandardAgentContext]) -> ModelRequest[StandardAgentContext]:
    """남은 도구 라운드를 모델에게 알리고, 라운드나 비용이 바닥나면 결론만 받는다."""
    context = request.runtime.context
    total = context.max_tool_rounds
    spent = request.state.get("run_model_call_count", 0)
    remaining = total - (spent if isinstance(spent, int) else 0)
    messages = cache_tool_messages(request.messages)
    if remaining > 1 and not context.budget.landing:
        notice = BUDGET_NOTICE.format(remaining=remaining, total=total)
        return request.override(messages=[*messages, HumanMessage(content=notice)])
    context.budget.land()
    # 조사 도구를 거둬야 모델이 결론을 낸다. 구조화 출력 도구는 이 목록 밖에서 붙는다.
    return request.override(
        messages=[*messages, HumanMessage(content=FINALIZE_DIRECTIVE)],
        tools=[],
    )


def cache_tool_messages(messages: list[Any]) -> list[Any]:
    """원본을 바꾸지 않고 최근 도구 결과 두 개에만 캐시 경계를 둔다."""
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
