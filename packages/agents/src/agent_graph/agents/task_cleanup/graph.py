"""task-cleanup의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import TaskCleanupState
from .policy import AssessmentRoute, BatchRoute, BootstrapRoute, ValidationRoute

CleanupNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]


def build_task_cleanup_graph(
    bootstrap_candidates: CleanupNode,
    plan_inspection: CleanupNode,
    gather_events: CleanupNode,
    assess_candidates: CleanupNode,
    validate_decisions: CleanupNode,
    repair: CleanupNode,
    accept_batch: CleanupNode,
    finalize: CleanupNode,
    empty: CleanupNode,
    route_bootstrap: BootstrapRoute,
    route_assessment: AssessmentRoute,
    route_validation: ValidationRoute,
    route_batch: BatchRoute,
) -> CompiledStateGraph[TaskCleanupState, None, TaskCleanupState, TaskCleanupState]:
    """후보 수집부터 검증·배치 전환까지의 위상을 컴파일한다."""
    graph = StateGraph(TaskCleanupState)
    graph.add_node("bootstrap_candidates", cast(Any, bootstrap_candidates))
    graph.add_node("plan_inspection", cast(Any, plan_inspection))
    graph.add_node("gather_events", cast(Any, gather_events))
    graph.add_node("assess_candidates", cast(Any, assess_candidates))
    graph.add_node("validate_decisions", cast(Any, validate_decisions))
    graph.add_node("repair", cast(Any, repair))
    graph.add_node("accept_batch", cast(Any, accept_batch))
    graph.add_node("finalize", cast(Any, finalize))
    graph.add_node("empty", cast(Any, empty))
    graph.add_edge(START, "bootstrap_candidates")
    graph.add_conditional_edges(
        "bootstrap_candidates",
        route_bootstrap,
        {"plan_inspection": "plan_inspection", "empty": "empty"},
    )
    graph.add_edge("plan_inspection", "gather_events")
    graph.add_edge("gather_events", "assess_candidates")
    graph.add_conditional_edges(
        "assess_candidates",
        route_assessment,
        {"plan_inspection": "plan_inspection", "validate_decisions": "validate_decisions"},
    )
    graph.add_conditional_edges(
        "validate_decisions",
        route_validation,
        {"repair": "repair", "accept_batch": "accept_batch"},
    )
    graph.add_edge("repair", "validate_decisions")
    graph.add_conditional_edges(
        "accept_batch",
        route_batch,
        {"plan_inspection": "plan_inspection", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()
