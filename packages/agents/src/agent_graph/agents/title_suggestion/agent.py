"""title-suggestion의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

import httpx

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.client import make_chat
from .graph import TITLE_SUGGESTION_GRAPH, TitleGraphContext
from .models import TitleSuggestionRequest
from .nodes.candidate import create_candidate_nodes, empty, finalize
from .policy import TITLE_MAX_OUTPUT_TOKENS, build_routes

AGENT_NAME = "title-suggestion"


async def run_title_suggestion(
    req: TitleSuggestionRequest, client: httpx.AsyncClient, usage: ExecutionTrace
) -> dict[str, Any]:
    """title-suggestion 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=TITLE_MAX_OUTPUT_TOKENS,
    )
    investigate, validate_candidate, repair = create_candidate_nodes(
        req,
        client,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    context = TitleGraphContext(
        usage,
        investigate,
        validate_candidate,
        repair,
        finalize,
        empty,
        build_routes(usage),
    )
    final = await TITLE_SUGGESTION_GRAPH.ainvoke(
        {
            "task_id": req.taskId,
            "language": req.language,
            "context": req.context,
            "messages": [],
            "model_cost_usd": 0.0,
            "candidate": None,
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        context=context,
        config={"recursion_limit": 20},
    )
    return final["result"] or {"suggestions": []}
