"""title-suggestion의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.node import node_registry
from ..runtime.validation_graph import ValidationGraphContext
from .graph import TITLE_SUGGESTION_GRAPH
from .models import TitleSuggestionRequest
from .nodes.candidate import (
    EmptyNode,
    FinalizeNode,
    InvestigateNode,
    RepairNode,
    ValidateCandidateNode,
)
from .policy import TITLE_MAX_OUTPUT_TOKENS, build_routes
from .reader import TitleLedgerReader

AGENT_NAME = "title-suggestion"


async def run_title_suggestion(
    req: TitleSuggestionRequest, ledger: LedgerPoolProvider, usage: ExecutionTrace
) -> dict[str, Any]:
    """title-suggestion 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=TITLE_MAX_OUTPUT_TOKENS,
    )
    fallback_model = req.effective_fallback_model()
    fallback_chat = (
        make_chat(fallback_model, req.apiKey, req.deadlineMs, max_output_tokens=TITLE_MAX_OUTPUT_TOKENS)
        if fallback_model is not None
        else None
    )
    reader = TitleLedgerReader(ledger, req.userId)
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        node_registry(
            [
                InvestigateNode(req, reader, usage, chat, fallback_chat, agent_name=AGENT_NAME),
                ValidateCandidateNode(usage),
                RepairNode(req, reader, usage, chat, fallback_chat, agent_name=AGENT_NAME),
                FinalizeNode(),
                EmptyNode(),
            ]
        ),
        build_routes(usage, ValidateCandidateNode.name),
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
        config=recursion_config(20),
    )
    return final["result"] or {"suggestions": []}
