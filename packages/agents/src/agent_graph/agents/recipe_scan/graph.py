"""recipe-scan의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from typing import Literal

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.orchestration import allocate_cost_shares
from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import ProbeDispatch, RecipeScanState

type NodeName = Literal["survey", "probe", "investigate", "validate_candidate"]

SURVEY: NodeName = "survey"
PROBE: NodeName = "probe"
INVESTIGATE: NodeName = "investigate"
VALIDATE_CANDIDATE: NodeName = "validate_candidate"


def _dispatch(state: RecipeScanState) -> list[Send]:
    """조율자가 세운 계획대로 전문가를 동시에 띄우며 비용도 배분한 라운드에 비례해 나눈다."""
    plan = state["plan"]
    if plan is None:
        return [Send(INVESTIGATE, state)]
    return [
        Send(
            PROBE,
            ProbeDispatch(assignment=assignment, cost_share=cost_share),
        )
        for assignment, cost_share in allocate_cost_shares(plan.probes)
    ]


_graph = new_graph(RecipeScanState)
observed(_graph, SURVEY)
observed(_graph, PROBE)
observed(_graph, INVESTIGATE)
add_validation_tail(_graph, VALIDATE_CANDIDATE)
_graph.add_edge(START, SURVEY)
_graph.add_conditional_edges(SURVEY, _dispatch, [PROBE, INVESTIGATE])
_graph.add_edge(PROBE, INVESTIGATE)
_graph.add_edge(INVESTIGATE, VALIDATE_CANDIDATE)

RECIPE_SCAN_GRAPH = _graph.compile()
