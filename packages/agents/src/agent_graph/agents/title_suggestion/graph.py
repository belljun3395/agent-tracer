"""title-suggestion의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import TitleSuggestionState
from .nodes.candidate import InvestigateNode, ValidateCandidateNode

_graph = new_graph(TitleSuggestionState)
observed(_graph, InvestigateNode.name)
add_validation_tail(_graph, ValidateCandidateNode.name)
_graph.add_edge(START, InvestigateNode.name)
_graph.add_edge(InvestigateNode.name, ValidateCandidateNode.name)

TITLE_SUGGESTION_GRAPH = _graph.compile()
