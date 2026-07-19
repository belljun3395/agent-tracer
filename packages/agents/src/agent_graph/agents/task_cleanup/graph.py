"""task-cleanup의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import TaskCleanupState


def _dispatch(state: TaskCleanupState) -> list[Send]:
    """조율자가 열어보기로 고른 후보를 동시에 조사하며 비용도 배분한 라운드에 비례해 나눈다."""
    plan = state["plan"]
    if plan is None or not plan.inspect:
        return [Send("investigate", state)]
    total = plan.total_rounds()
    return [
        Send(
            "inspect",
            {"assignment": assignment.model_dump(), "cost_share": assignment.rounds / total},
        )
        for assignment in plan.inspect
    ]


_graph = new_graph(TaskCleanupState)
observed(_graph, "triage")
observed(_graph, "inspect")
observed(_graph, "investigate")
add_validation_tail(_graph, "validate_decisions")
_graph.add_edge(START, "triage")
_graph.add_conditional_edges("triage", _dispatch, ["inspect", "investigate"])
_graph.add_edge("inspect", "investigate")
_graph.add_edge("investigate", "validate_decisions")

TASK_CLEANUP_GRAPH = _graph.compile()
