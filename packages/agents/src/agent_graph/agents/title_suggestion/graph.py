"""title-suggestion의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import TitleSuggestionState
from .policy import ValidationRoute

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


def build_title_suggestion_graph(
    investigate: TitleNode,
    validate_candidate: TitleNode,
    repair: TitleNode,
    finalize: TitleNode,
    empty: TitleNode,
    route_validation: ValidationRoute,
) -> CompiledStateGraph[TitleSuggestionState, None, TitleSuggestionState, TitleSuggestionState]:
    """모델이 도구로 조사하고 그래프가 후보를 검증하는 위상을 컴파일한다."""
    graph = StateGraph(TitleSuggestionState)
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
