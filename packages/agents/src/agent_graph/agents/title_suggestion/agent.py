"""title-suggestion의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any, cast

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.validation_graph import ValidationGraphContext, ValidationNode
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
    reader = TitleLedgerReader(ledger, req.userId)
    investigate, validate_candidate, repair = create_candidate_nodes(
        req,
        reader,
        usage,
        chat,
        agent_name=AGENT_NAME,
    )
    # 각 노드는 자기 상태 부분집합만 정확히 타입화하므로, 서로 다른 노드를 한 레지스트리에
    # 담는 이 경계에서만 공통 타입으로 지운다.
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        {
            "investigate": cast(ValidationNode, investigate),
            "validate_candidate": cast(ValidationNode, validate_candidate),
            "repair": cast(ValidationNode, repair),
            "finalize": cast(ValidationNode, finalize),
            "empty": cast(ValidationNode, empty),
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
        config=recursion_config(20),
    )
    return final["result"] or {"suggestions": []}
