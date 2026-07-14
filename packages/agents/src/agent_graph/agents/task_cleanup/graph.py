"""task-cleanup의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import TaskCleanupState
from .policy import ValidationRoute

CleanupNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]


def build_task_cleanup_graph(
    investigate: CleanupNode,
    validate_decisions: CleanupNode,
    repair: CleanupNode,
    finalize: CleanupNode,
    empty: CleanupNode,
    route_validation: ValidationRoute,
) -> CompiledStateGraph[TaskCleanupState, None, TaskCleanupState, TaskCleanupState]:
    """모델이 도구로 조사하고 그래프가 인용을 검증하는 위상을 컴파일한다."""
    graph = StateGraph(TaskCleanupState)
    graph.add_node("investigate", cast(Any, investigate))
    graph.add_node("validate_decisions", cast(Any, validate_decisions))
    graph.add_node("repair", cast(Any, repair))
    graph.add_node("finalize", cast(Any, finalize))
    graph.add_node("empty", cast(Any, empty))
    graph.add_edge(START, "investigate")
    graph.add_edge("investigate", "validate_decisions")
    graph.add_conditional_edges(
        "validate_decisions",
        cast(Any, route_validation),
        {"repair": "repair", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("repair", "validate_decisions")
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()
