"""recipe-scan의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import RecipeScanState
from .policy import AssessRoute, ValidationRoute

RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def build_recipe_scan_graph(
    bootstrap: RecipeNode,
    plan_evidence: RecipeNode,
    gather_evidence: RecipeNode,
    assess_evidence: RecipeNode,
    synthesize: RecipeNode,
    validate_candidate: RecipeNode,
    repair: RecipeNode,
    finalize: RecipeNode,
    empty: RecipeNode,
    route_assessment: AssessRoute,
    route_validation: ValidationRoute,
) -> CompiledStateGraph[RecipeScanState, None, RecipeScanState, RecipeScanState]:
    """실행과 검증이 공유하는 recipe 전용 위상을 컴파일한다."""
    graph = StateGraph(RecipeScanState)
    graph.add_node("bootstrap", cast(Any, bootstrap))
    graph.add_node("plan_evidence", cast(Any, plan_evidence))
    graph.add_node("gather_evidence", cast(Any, gather_evidence))
    graph.add_node("assess_evidence", cast(Any, assess_evidence))
    graph.add_node("synthesize", cast(Any, synthesize))
    graph.add_node("validate_candidate", cast(Any, validate_candidate))
    graph.add_node("repair", cast(Any, repair))
    graph.add_node("finalize", cast(Any, finalize))
    graph.add_node("empty", cast(Any, empty))
    graph.add_edge(START, "bootstrap")
    graph.add_edge("bootstrap", "plan_evidence")
    graph.add_edge("plan_evidence", "gather_evidence")
    graph.add_edge("gather_evidence", "assess_evidence")
    graph.add_conditional_edges(
        "assess_evidence",
        route_assessment,
        {"plan_evidence": "plan_evidence", "synthesize": "synthesize", "empty": "empty"},
    )
    graph.add_edge("synthesize", "validate_candidate")
    graph.add_conditional_edges(
        "validate_candidate",
        route_validation,
        {"repair": "repair", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("repair", "validate_candidate")
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()
