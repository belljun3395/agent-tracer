"""recipe-scan의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.orchestration import allocate_cost_shares
from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import ProbeDispatch, RecipeScanState
from .nodes.candidate import InvestigateNode, ValidateCandidateNode
from .nodes.probe import ProbeNode
from .nodes.survey import SurveyNode


def _dispatch(state: RecipeScanState) -> list[Send]:
    plan = state["plan"]
    if plan is None:
        return [Send(InvestigateNode.name, state)]
    return [
        Send(
            ProbeNode.name,
            ProbeDispatch(assignment=assignment, cost_share=cost_share),
        )
        for assignment, cost_share in allocate_cost_shares(plan.probes)
    ]


_graph = new_graph(RecipeScanState)
observed(_graph, SurveyNode.name)
observed(_graph, ProbeNode.name)
observed(_graph, InvestigateNode.name)
add_validation_tail(_graph, ValidateCandidateNode.name)
_graph.add_edge(START, SurveyNode.name)
_graph.add_conditional_edges(SurveyNode.name, _dispatch, [ProbeNode.name, InvestigateNode.name])
_graph.add_edge(ProbeNode.name, InvestigateNode.name)
_graph.add_edge(InvestigateNode.name, ValidateCandidateNode.name)

RECIPE_SCAN_GRAPH = _graph.compile()
