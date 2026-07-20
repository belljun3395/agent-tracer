"""task-cleanup의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any, cast

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.validation_graph import ValidationGraphContext, ValidationNode
from .graph import TASK_CLEANUP_GRAPH
from .models import TaskCleanupRequest
from .nodes.decision import create_decision_nodes
from .nodes.inspect import create_inspect_node, create_triage_node
from .nodes.result import empty, finalize
from .policy import TASK_CLEANUP_MAX_OUTPUT_TOKENS, build_routes
from .reader import CleanupLedgerReader

AGENT_NAME = "task-cleanup"


async def run_task_cleanup(
    req: TaskCleanupRequest, ledger: LedgerPoolProvider, usage: ExecutionTrace
) -> dict[str, Any]:
    """task-cleanup 노드를 실행 의존성과 결합해 그래프를 수행한다."""
    chat = make_chat(
        req.model,
        req.apiKey,
        req.deadlineMs,
        max_output_tokens=TASK_CLEANUP_MAX_OUTPUT_TOKENS,
    )
    reader = CleanupLedgerReader(ledger, req.userId)
    investigate, validate_decisions, repair = create_decision_nodes(
        req, reader, usage, chat, agent_name=AGENT_NAME
    )
    triage = create_triage_node(req, reader, usage, chat, agent_name=AGENT_NAME)
    inspect = create_inspect_node(req, reader, usage, chat, agent_name=AGENT_NAME)
    # 각 노드는 자기 상태 부분집합만 정확히 타입화하므로, 서로 다른 노드를 한 레지스트리에
    # 담는 이 경계에서만 공통 타입으로 지운다.
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        {
            "triage": cast(ValidationNode, triage),
            "inspect": cast(ValidationNode, inspect),
            "investigate": cast(ValidationNode, investigate),
            "validate_decisions": cast(ValidationNode, validate_decisions),
            "repair": cast(ValidationNode, repair),
            "finalize": cast(ValidationNode, finalize),
            "empty": cast(ValidationNode, empty),
        },
        build_routes(usage),
    )
    final = await TASK_CLEANUP_GRAPH.ainvoke(
        {
            "scanned_at": req.scannedAt,
            "language": req.language,
            "max_suggestions": req.maxSuggestions,
            "messages": [],
            "plan": None,
            "reports": [],
            "exposed_candidates": {},
            "event_ids_by_task": {},
            "model_cost_usd": 0.0,
            "suggestions": [],
            "validation_errors": [],
            "repair_attempted": False,
            "result": None,
        },
        context=context,
        config=recursion_config(30),
    )
    return final["result"] or {"suggestions": []}
