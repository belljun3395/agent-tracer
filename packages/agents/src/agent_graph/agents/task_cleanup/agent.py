"""task-cleanup의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.validation_graph import ValidationGraphContext
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
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        {
            "triage": triage,
            "inspect": inspect,
            "investigate": investigate,
            "validate_decisions": validate_decisions,
            "repair": repair,
            "finalize": finalize,
            "empty": empty,
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
