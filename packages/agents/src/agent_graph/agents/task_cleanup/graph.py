"""task-cleanup의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START
from langgraph.types import Send

from ..runtime.orchestration import allocate_cost_shares
from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import InspectDispatch, TaskCleanupState
from .nodes.decision import InvestigateNode, ValidateDecisionsNode
from .nodes.inspect import InspectNode, TriageNode


def _dispatch(state: TaskCleanupState) -> list[Send]:
    """조율자가 열어보기로 고른 후보를 동시에 조사하며 비용도 배분한 라운드에 비례해 나눈다."""
    plan = state["plan"]
    if plan is None or not plan.assignments:
        return [Send(InvestigateNode.name, state)]
    return [
        Send(
            InspectNode.name,
            InspectDispatch(assignment=assignment, cost_share=cost_share),
        )
        for assignment, cost_share in allocate_cost_shares(plan.assignments)
    ]


_graph = new_graph(TaskCleanupState)
observed(_graph, TriageNode.name)
observed(_graph, InspectNode.name)
observed(_graph, InvestigateNode.name)
add_validation_tail(_graph, ValidateDecisionsNode.name)
_graph.add_edge(START, TriageNode.name)
_graph.add_conditional_edges(TriageNode.name, _dispatch, [InspectNode.name, InvestigateNode.name])
_graph.add_edge(InspectNode.name, InvestigateNode.name)
_graph.add_edge(InvestigateNode.name, ValidateDecisionsNode.name)

TASK_CLEANUP_GRAPH = _graph.compile()
