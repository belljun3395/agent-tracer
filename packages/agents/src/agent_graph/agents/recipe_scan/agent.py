"""recipe-scan의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

import httpx

from ..runtime.execution.node_trace import traced_node
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.client import make_chat
from .graph import build_recipe_scan_graph
from .models import ProvenanceCatalog, RecipeScanRequest
from .nodes.candidate import create_candidate_nodes
from .nodes.result import empty, finalize
from .policy import RECIPE_MAX_OUTPUT_TOKENS, build_routes

AGENT_NAME = "recipe-scan"


async def run_recipe_scan(
    req: RecipeScanRequest, client: httpx.AsyncClient, usage: ExecutionTrace
) -> dict[str, Any]:
    """recipe-scan 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=RECIPE_MAX_OUTPUT_TOKENS,
    )
    investigate, validate_candidate, repair = create_candidate_nodes(
        req,
        client,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    compiled = build_recipe_scan_graph(
        traced_node(AGENT_NAME, "investigate", usage, investigate),
        traced_node(AGENT_NAME, "validate_candidate", usage, validate_candidate),
        traced_node(AGENT_NAME, "repair", usage, repair),
        traced_node(AGENT_NAME, "finalize", usage, finalize),
        traced_node(AGENT_NAME, "empty", usage, empty),
        build_routes(usage),
    )
    final = await compiled.ainvoke(
        {
            "task_id": req.taskId,
            "language": req.language,
            "user_prompt": req.userPrompt,
            "messages": [],
            "provenance": ProvenanceCatalog(),
            "model_cost_usd": 0.0,
            "candidates": [],
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        config={"recursion_limit": 30},
    )
    return final["result"] or {"recipes": []}
