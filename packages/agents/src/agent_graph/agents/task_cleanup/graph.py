"""task-cleanup의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from typing import Literal

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.orchestration import allocate_cost_shares
from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import InspectDispatch, TaskCleanupState

type NodeName = Literal["triage", "inspect", "investigate", "validate_decisions"]

TRIAGE: NodeName = "triage"
INSPECT: NodeName = "inspect"
INVESTIGATE: NodeName = "investigate"
VALIDATE_DECISIONS: NodeName = "validate_decisions"


def _dispatch(state: TaskCleanupState) -> list[Send]:
    """조율자가 열어보기로 고른 후보를 동시에 조사하며 비용도 배분한 라운드에 비례해 나눈다."""
    plan = state["plan"]
    if plan is None or not plan.assignments:
        return [Send(INVESTIGATE, state)]
    return [
        Send(
            INSPECT,
            InspectDispatch(assignment=assignment, cost_share=cost_share),
        )
        for assignment, cost_share in allocate_cost_shares(plan.assignments)
    ]


_graph = new_graph(TaskCleanupState)
observed(_graph, TRIAGE)
observed(_graph, INSPECT)
observed(_graph, INVESTIGATE)
add_validation_tail(_graph, VALIDATE_DECISIONS)
_graph.add_edge(START, TRIAGE)
_graph.add_conditional_edges(TRIAGE, _dispatch, [INSPECT, INVESTIGATE])
_graph.add_edge(INSPECT, INVESTIGATE)
_graph.add_edge(INVESTIGATE, VALIDATE_DECISIONS)

TASK_CLEANUP_GRAPH = _graph.compile()
