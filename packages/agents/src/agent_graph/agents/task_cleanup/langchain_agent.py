"""task-cleanup의 표준 LangChain agent와 도구 직렬화 락 컨텍스트를 제공한다."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ModelCallLimitMiddleware,
    ToolCallRequest,
    ToolRetryMiddleware,
)
from langchain.agents.structured_output import ToolStrategy
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from pydantic import BaseModel

from ..runtime.llm.standard_agent import (
    StandardAgentContext,
    StandardAgentMiddleware,
    tool_context,
)
from .models import CleanupDraft
from .policy import MAX_TOOL_ROUNDS


@dataclass(kw_only=True)
class CleanupAgentContext(StandardAgentContext):
    """cleanup 도구 호출을 요청 안에서 직렬화할 락을 표준 실행 의존성에 더한다."""

    tool_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class CleanupAgentMiddleware(StandardAgentMiddleware):
    """공유 근거 장부를 쓰는 cleanup 도구를 기존 호출 순서대로 실행한다."""

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        context = tool_context(request, CleanupAgentContext)
        async with context.tool_lock:
            return await super().awrap_tool_call(request, handler)


def _tool_retry(transient_errors: tuple[type[Exception], ...]) -> ToolRetryMiddleware:
    """도구가 선언한 일시적 연결 오류를 도구 계층에서 재시도해 병렬 조사가 통째로 무너지지 않게 한다."""
    return ToolRetryMiddleware(
        max_retries=2,
        retry_on=transient_errors,
        on_failure="error",
        backoff_factor=2.0,
        initial_delay=0.5,
        jitter=False,
    )


def build_cleanup_agent(
    chat: BaseChatModel,
    system_prompt: str,
    tools: list[BaseTool],
    transient_errors: tuple[type[Exception], ...],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    output: type[BaseModel] = CleanupDraft,
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """표준 도구 실행과 구조화 출력을 갖춘 task-cleanup agent를 컴파일한다."""
    system = SystemMessage(
        content=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
    )
    middleware: list[AgentMiddleware[Any, Any, Any]] = [
        ModelCallLimitMiddleware(run_limit=max_rounds + 2, exit_behavior="error"),
        CleanupAgentMiddleware(),
        _tool_retry(transient_errors),
    ]
    # noinspection PyTypeChecker
    return create_agent(
        chat,
        tools=list(tools),
        system_prompt=system,
        middleware=middleware,
        response_format=ToolStrategy(output, handle_errors=True),
        context_schema=CleanupAgentContext,
        name="task-cleanup-investigator",
    )
