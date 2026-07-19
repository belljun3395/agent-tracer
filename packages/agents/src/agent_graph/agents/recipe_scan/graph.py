"""recipe-scan의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import RecipeScanState

_graph = new_graph(RecipeScanState)
observed(_graph, "investigate")
add_validation_tail(_graph, "validate_candidate")
_graph.add_edge(START, "investigate")
_graph.add_edge("investigate", "validate_candidate")

RECIPE_SCAN_GRAPH = _graph.compile()
