"""recipe-scan의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any, cast

from opensearchpy import AsyncOpenSearch

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.validation_graph import ValidationGraphContext, ValidationNode
from .graph import RECIPE_SCAN_GRAPH
from .models import ProvenanceCatalog, RecipeScanRequest
from .nodes.candidate import create_candidate_nodes
from .nodes.probe import create_probe_node
from .nodes.result import empty, finalize
from .nodes.survey import create_survey_node
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
    reader = RecipeLedgerReader(ledger, req.userId)
    search_reader = RecipeSearchReader(search, req.userId)
    investigate, validate_candidate, repair = create_candidate_nodes(
        req, reader, search_reader, usage, chat, agent_name=AGENT_NAME
    )
    # 각 노드는 자기 상태 부분집합만 정확히 타입화하므로, 서로 다른 노드를 한 레지스트리에
    # 담는 이 경계에서만 공통 타입으로 지운다.
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        {
            "survey": cast(ValidationNode, create_survey_node(req, usage, chat)),
            "probe": cast(
                ValidationNode,
                create_probe_node(req, reader, search_reader, usage, chat, agent_name=AGENT_NAME),
            ),
            "investigate": cast(ValidationNode, investigate),
            "validate_candidate": cast(ValidationNode, validate_candidate),
            "repair": cast(ValidationNode, repair),
            "finalize": cast(ValidationNode, finalize),
            "empty": cast(ValidationNode, empty),
        },
        build_routes(usage),
    )
    final = await RECIPE_SCAN_GRAPH.ainvoke(
        {
            "task_id": req.taskId,
            "language": req.language,
            "user_prompt": req.userPrompt,
            "messages": [],
            "plan": None,
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
