"""task-cleanup의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import TaskCleanupState


def _dispatch(state: TaskCleanupState) -> list[Send]:
    """조율자가 열어보기로 고른 후보를 동시에 조사한다."""
    plan = state["plan"]
    if plan is None or not plan.inspect:
        return [Send("investigate", state)]
    share = 1.0 / len(plan.inspect)
    return [
        Send("inspect", {"assignment": assignment.model_dump(), "cost_share": share})
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
