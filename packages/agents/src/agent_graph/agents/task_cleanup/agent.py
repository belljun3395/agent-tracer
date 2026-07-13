"""task-cleanup의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

import httpx

from ..runtime.execution.node_trace import traced_node
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.client import make_chat
from .graph import build_task_cleanup_graph
from .models import TaskCleanupRequest
from .nodes.collection import create_collection_nodes
from .nodes.decision import create_decision_nodes
from .nodes.result import empty, finalize
from .policy import TASK_CLEANUP_MAX_OUTPUT_TOKENS, build_routes

AGENT_NAME = "task-cleanup"


async def run_task_cleanup(
    req: TaskCleanupRequest, client: httpx.AsyncClient, usage: ExecutionTrace
) -> dict[str, Any]:
    """task-cleanup 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=TASK_CLEANUP_MAX_OUTPUT_TOKENS,
    )
    bootstrap_candidates, plan_inspection, gather_events = create_collection_nodes(
        req,
        client,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    assess_candidates, validate_decisions, repair, accept_batch = create_decision_nodes(
        req,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    route_bootstrap, route_assessment, route_validation, route_batch = build_routes(usage)
    graph = build_task_cleanup_graph(
        traced_node(AGENT_NAME, "bootstrap_candidates", usage, bootstrap_candidates),
        traced_node(AGENT_NAME, "plan_inspection", usage, plan_inspection),
        traced_node(AGENT_NAME, "gather_events", usage, gather_events),
        traced_node(AGENT_NAME, "assess_candidates", usage, assess_candidates),
        traced_node(AGENT_NAME, "validate_decisions", usage, validate_decisions),
        traced_node(AGENT_NAME, "repair", usage, repair),
        traced_node(AGENT_NAME, "accept_batch", usage, accept_batch),
        traced_node(AGENT_NAME, "finalize", usage, finalize),
        traced_node(AGENT_NAME, "empty", usage, empty),
        route_bootstrap,
        route_assessment,
        route_validation,
        route_batch,
    )
    final = await graph.ainvoke(
        {
            "scanned_at": req.scannedAt,
            "language": req.language,
            "max_suggestions": req.maxSuggestions,
            "candidates": [],
            "model_candidates": [],
            "candidate_offset": 0,
            "evidence": [],
            "event_ids_by_task": {},
            "plan": None,
            "assessment": None,
            "gather_rounds": 0,
            "event_reads": 0,
            "model_cost_usd": 0.0,
            "accepted_suggestions": [],
            "valid_suggestions": [],
            "invalid_suggestions": [],
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        config={"recursion_limit": 100},
    )
    return final["result"] or {"suggestions": []}


__all__ = ["TaskCleanupRequest", "build_task_cleanup_graph", "run_task_cleanup"]
