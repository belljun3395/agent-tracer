"""recipe-scan의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

from opensearchpy import AsyncOpenSearch

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.node import node_registry
from ..runtime.validation_graph import ValidationGraphContext
from .graph import RECIPE_SCAN_GRAPH
from .models import ProvenanceCatalog, RecipeScanRequest
from .nodes.candidate import InvestigateNode, RepairNode, ValidateCandidateNode
from .nodes.probe import ProbeNode
from .nodes.result import EmptyNode, FinalizeNode
from .nodes.survey import SurveyNode
from .policy import RECIPE_MAX_OUTPUT_TOKENS, build_routes
from .reader import RecipeLedgerReader
from .search import RecipeSearchReader

AGENT_NAME = "recipe-scan"


async def run_recipe_scan(
    req: RecipeScanRequest, ledger: LedgerPoolProvider, search: AsyncOpenSearch, usage: ExecutionTrace
) -> dict[str, Any]:
    """recipe-scan 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=RECIPE_MAX_OUTPUT_TOKENS,
    )
    fallback_model = req.effective_fallback_model()
    fallback_chat = (
        make_chat(fallback_model, req.apiKey, req.deadlineMs, max_output_tokens=RECIPE_MAX_OUTPUT_TOKENS)
        if fallback_model is not None
        else None
    )
    reader = RecipeLedgerReader(ledger, req.userId)
    search_reader = RecipeSearchReader(search, req.userId)
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        node_registry(
            [
                SurveyNode(req, usage, chat),
                ProbeNode(req, reader, search_reader, usage, chat, fallback_chat, agent_name=AGENT_NAME),
                InvestigateNode(
                    req, reader, search_reader, usage, chat, fallback_chat, agent_name=AGENT_NAME
                ),
                ValidateCandidateNode(usage),
                RepairNode(req, reader, search_reader, usage, chat, fallback_chat, agent_name=AGENT_NAME),
                FinalizeNode(),
                EmptyNode(),
            ]
        ),
        build_routes(usage, ValidateCandidateNode.name),
    )
    final = await RECIPE_SCAN_GRAPH.ainvoke(
        {
            "task_id": req.taskId,
            "language": req.language,
            "user_prompt": req.userPrompt,
            "messages": [],
            "plan": None,
            "redispatch": None,
            "redispatch_ceiling": 0.0,
            "redispatch_count": 0,
            "reports": [],
            "provenance": ProvenanceCatalog(),
            "model_cost_usd": 0.0,
            "candidates": [],
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        context=context,
        config=recursion_config(30),
    )
    return final["result"] or {"recipes": []}
