"""title-suggestion 컨텍스트 평가와 추가 근거 조회 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ..evidence import record_event_pages, task_context
from ..models import ContextAssessment, TitleSuggestionRequest, TitleSuggestionState
from ..policy import MAX_TITLE_MODEL_COST_USD
from ..prompts import ASSESS_SYSTEM_PROMPT
from ..tools import gather_task_events

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


def create_assessment_nodes(
    req: TitleSuggestionRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[TitleNode, TitleNode]:
    """컨텍스트 평가와 추가 조회 노드를 실행 의존성에 결합한다."""

    async def assess_context(state: TitleSuggestionState) -> dict[str, Any]:
        chain_prompt = prompt(
            ASSESS_SYSTEM_PROMPT,
            "Task context: {context}\nChoose keep, suggest, or gather and explain why.",
        )
        assessment, cost = await invoke_structured(
            chat,
            chain_prompt,
            {"context": task_context(state)},
            ContextAssessment,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_TITLE_MODEL_COST_USD,
        )
        return {"assessment": assessment, "model_cost_usd": cost}

    async def gather_events(state: TitleSuggestionState) -> dict[str, Any]:
        records = await gather_task_events(
            client,
            req.toolCallback,
            state["task_id"],
        )
        record_event_pages(usage, records)
        return {"event_records": records}

    return assess_context, gather_events
