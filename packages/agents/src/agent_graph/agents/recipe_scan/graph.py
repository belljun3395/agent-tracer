"""recipe-scan의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import ProbeDispatch, RecipeScanState


def _dispatch(state: RecipeScanState) -> list[Send]:
    """조율자가 세운 계획대로 전문가를 동시에 띄우며 비용도 배분한 라운드에 비례해 나눈다."""
    plan = state["plan"]
    if plan is None:
        return [Send("investigate", state)]
    total = plan.total_rounds()
    return [
        Send(
            "probe",
            ProbeDispatch(assignment=assignment, cost_share=assignment.rounds / total),
        )
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
