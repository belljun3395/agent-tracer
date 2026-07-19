"""task-cleanup의 정적 LangGraph 위상을 소유한다."""

from __future__ import annotations

from langgraph.graph import START

from ..runtime.validation_graph import add_validation_tail, new_graph, observed
from .models import TaskCleanupState

_graph = new_graph(TaskCleanupState)
observed(_graph, "investigate")
add_validation_tail(_graph, "validate_decisions")
_graph.add_edge(START, "investigate")
_graph.add_edge("investigate", "validate_decisions")

TASK_CLEANUP_GRAPH = _graph.compile()
