"""recipe-scan의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import RecipeScanState


def _dispatch(state: RecipeScanState) -> list[Send]:
    """조율자가 세운 계획대로 전문가를 동시에 띄운다."""
    plan = state["plan"]
    if plan is None:
        return [Send("investigate", state)]
    share = 1.0 / len(plan.probes)
    return [
        Send("probe", {"assignment": assignment.model_dump(), "cost_share": share})
        for assignment in plan.probes
    ]


_graph = new_graph(RecipeScanState)
observed(_graph, "survey")
observed(_graph, "probe")
observed(_graph, "investigate")
add_validation_tail(_graph, "validate_candidate")
_graph.add_edge(START, "survey")
_graph.add_conditional_edges("survey", _dispatch, ["probe", "investigate"])
_graph.add_edge("probe", "investigate")
_graph.add_edge("investigate", "validate_candidate")

RECIPE_SCAN_GRAPH = _graph.compile()
