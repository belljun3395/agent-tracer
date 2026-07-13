"""title-suggestion의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

import httpx

from ..runtime.execution.node_trace import traced_node
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.client import make_chat
from .graph import build_title_suggestion_graph
from .models import TitleSuggestionRequest
from .nodes.assessment import create_assessment_nodes
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
    assess_context, gather_events = create_assessment_nodes(
        req,
        client,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    synthesize, validate_candidate, repair = create_candidate_nodes(
        req,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    route_assessment, route_validation = build_routes(usage)
    compiled = build_title_suggestion_graph(
        traced_node(AGENT_NAME, "assess_context", usage, assess_context),
        traced_node(AGENT_NAME, "gather_events", usage, gather_events),
        traced_node(AGENT_NAME, "synthesize", usage, synthesize),
        traced_node(AGENT_NAME, "validate_candidate", usage, validate_candidate),
        traced_node(AGENT_NAME, "repair", usage, repair),
        traced_node(AGENT_NAME, "finalize", usage, finalize),
        traced_node(AGENT_NAME, "empty", usage, empty),
        route_assessment,
        route_validation,
    )
    final = await compiled.ainvoke(
        {
            "task_id": req.taskId,
            "language": req.language,
            "context": req.context,
            "event_records": [],
            "assessment": None,
            "model_cost_usd": 0.0,
            "candidate": None,
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        config={"recursion_limit": 20},
    )
    return final["result"] or {"suggestions": []}
