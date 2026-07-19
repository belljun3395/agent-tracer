"""task-cleanup의 표준 LangChain agent와 요청별 근거 컨텍스트를 제공한다."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, cast

from asyncpg import CannotConnectNowError, PostgresConnectionError
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware, ToolRetryMiddleware
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import SystemMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel, Field

from ..runtime.llm.standard_agent import StandardAgentContext, StandardAgentMiddleware
from .models import CleanupBatch, CleanupCandidate, CleanupDraft
from .policy import MAX_TOOL_ROUNDS
from .reader import CleanupLedgerReader
from .tools import (
    GET_TASK_EVENTS,
    GET_TASK_EVENTS_DESCRIPTION,
    LIST_CANDIDATE_TASKS,
    LIST_CANDIDATE_TASKS_DESCRIPTION,
    MAX_CANDIDATE_LIMIT,
    MAX_EVENT_LIMIT,
    invoke_tool,
    record_evidence,
)


@dataclass
class CleanupAgentContext(StandardAgentContext):
    """task-cleanup 도구에 원장 조회 진입점과 후보 배치와 근거 장부를 제공한다."""

    reader: CleanupLedgerReader
    batch: CleanupBatch
    exposed_candidates: dict[str, CleanupCandidate]
    event_ids_by_task: dict[str, set[str]]
    tool_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class CleanupAgentMiddleware(StandardAgentMiddleware):
    """공유 근거 장부를 쓰는 cleanup 도구를 기존 호출 순서대로 실행한다."""

    async def awrap_tool_call(self, request: Any, handler: Any) -> Any:
        async with request.runtime.context.tool_lock:
            return await super().awrap_tool_call(request, handler)


@tool(LIST_CANDIDATE_TASKS, description=LIST_CANDIDATE_TASKS_DESCRIPTION)
async def list_candidate_tasks(
    runtime: ToolRuntime[CleanupAgentContext],
    limit: Annotated[int, Field(ge=1, le=MAX_CANDIDATE_LIMIT)] | None = None,
    cursor: Annotated[str, Field(min_length=1)] | None = None,
) -> str:
    """서버가 이번 스캔 대상으로 선별한 정리 후보 페이지를 읽는다."""
    args: dict[str, Any] = {}
    if limit is not None:
        args["limit"] = limit
    if cursor is not None:
        args["cursor"] = cursor
    return await _invoke_and_record(runtime.context, LIST_CANDIDATE_TASKS, args)


@tool(GET_TASK_EVENTS, description=GET_TASK_EVENTS_DESCRIPTION)
async def get_task_events(
    taskId: Annotated[str, Field(min_length=1)],
    runtime: ToolRuntime[CleanupAgentContext],
    limit: Annotated[int, Field(ge=1, le=MAX_EVENT_LIMIT)] | None = None,
    cursor: Annotated[str, Field(min_length=1)] | None = None,
    order: Literal["asc", "desc"] | None = None,
) -> str:
    """정리 후보를 판단하는 데 필요한 태스크 이벤트 페이지를 읽는다."""
    args: dict[str, Any] = {"taskId": taskId}
    for name, value in (("limit", limit), ("cursor", cursor), ("order", order)):
        if value is not None:
            args[name] = value
    return await _invoke_and_record(runtime.context, GET_TASK_EVENTS, args)


async def _invoke_and_record(context: CleanupAgentContext, name: str, args: dict[str, Any]) -> str:
    content = await invoke_tool(context.reader, context.batch, name, args)
    record_evidence(context.exposed_candidates, context.event_ids_by_task, name, args, content)
    return content


# 조율자는 후보 목록만, 조사자는 이벤트만 본다. 인용 확인은 아직 이 에이전트에 없다.
TRIAGE_TOOLS = (list_candidate_tasks,)
INSPECT_TOOLS = (get_task_events,)

# 이 에이전트는 원장(asyncpg)만 읽는다. 연결 계열 오류만 일시적이며 검증·도메인 오류는 재시도하지 않는다.
_TRANSIENT_TOOL_ERRORS: tuple[type[Exception], ...] = (
    PostgresConnectionError,
    CannotConnectNowError,
    ConnectionError,
    TimeoutError,
)


def _tool_retry() -> ToolRetryMiddleware:
    """도구의 일시적 연결 오류를 도구 계층에서 재시도해 병렬 조사가 통째로 무너지지 않게 한다."""
    return ToolRetryMiddleware(
        max_retries=2,
        retry_on=_TRANSIENT_TOOL_ERRORS,
        on_failure="error",
        backoff_factor=2.0,
        initial_delay=0.5,
        jitter=False,
    )


def build_cleanup_agent(
    chat: Any,
    system_prompt: str,
    max_rounds: int = MAX_TOOL_ROUNDS,
    tools: tuple[Any, ...] = (list_candidate_tasks, get_task_events),
    output: type[BaseModel] = CleanupDraft,
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """표준 도구 실행과 구조화 출력을 갖춘 task-cleanup agent를 컴파일한다."""
    system = SystemMessage(
        content=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
    )
    return cast(
        CompiledStateGraph[Any, Any, Any, Any],
        create_agent(
            chat,
            tools=list(tools),
            system_prompt=system,
            middleware=cast(
                Any,
                [
                    ModelCallLimitMiddleware(run_limit=max_rounds + 2, exit_behavior="error"),
                    CleanupAgentMiddleware(),
                    _tool_retry(),
                ],
            ),
            response_format=ToolStrategy(output, handle_errors=True),
            context_schema=CleanupAgentContext,
            name="task-cleanup-investigator",
        ),
    )
