"""title-suggestion의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.validation_graph import ValidationGraphContext
from .graph import TITLE_SUGGESTION_GRAPH
from .models import TitleSuggestionRequest
from .nodes.candidate import create_candidate_nodes, empty, finalize
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
    investigate, validate_candidate, repair = create_candidate_nodes(
        req,
        TitleLedgerReader(ledger, req.userId),
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        {
            "investigate": investigate,
            "validate_candidate": validate_candidate,
            "repair": repair,
            "finalize": finalize,
            "empty": empty,
        },
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
