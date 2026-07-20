"""title-suggestion의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from typing import Literal

from langgraph.graph import START

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import TitleSuggestionState

type NodeName = Literal["investigate", "validate_candidate"]

INVESTIGATE: NodeName = "investigate"
VALIDATE_CANDIDATE: NodeName = "validate_candidate"

_graph = new_graph(TitleSuggestionState)
observed(_graph, INVESTIGATE)
add_validation_tail(_graph, VALIDATE_CANDIDATE)
_graph.add_edge(START, INVESTIGATE)
_graph.add_edge(INVESTIGATE, VALIDATE_CANDIDATE)

TITLE_SUGGESTION_GRAPH = _graph.compile()
