"""recipe-scan의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import RecipeScanState
from .policy import ValidationRoute

RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def build_recipe_scan_graph(
    investigate: RecipeNode,
    validate_candidate: RecipeNode,
    repair: RecipeNode,
    finalize: RecipeNode,
    empty: RecipeNode,
    route_validation: ValidationRoute,
) -> CompiledStateGraph[RecipeScanState, None, RecipeScanState, RecipeScanState]:
    """모델이 도구로 조사하고 그래프가 인용을 검증하는 위상을 컴파일한다."""
    graph = StateGraph(RecipeScanState)
    graph.add_node("investigate", cast(Any, investigate))
    graph.add_node("validate_candidate", cast(Any, validate_candidate))
    graph.add_node("repair", cast(Any, repair))
    graph.add_node("finalize", cast(Any, finalize))
    graph.add_node("empty", cast(Any, empty))
    graph.add_edge(START, "investigate")
    graph.add_edge("investigate", "validate_candidate")
    graph.add_conditional_edges(
        "validate_candidate",
        cast(Any, route_validation),
        {"repair": "repair", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("repair", "validate_candidate")
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()
