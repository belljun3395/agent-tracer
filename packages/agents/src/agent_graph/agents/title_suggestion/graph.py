"""title-suggestion의 LangGraph 위상을 조립한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .models import TitleSuggestionState
from .policy import AssessmentRoute, ValidationRoute

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


def build_title_suggestion_graph(
    assess_context: TitleNode,
    gather_events: TitleNode,
    synthesize: TitleNode,
    validate_candidate: TitleNode,
    repair: TitleNode,
    finalize: TitleNode,
    empty: TitleNode,
    route_assessment: AssessmentRoute,
    route_validation: ValidationRoute,
) -> CompiledStateGraph[TitleSuggestionState, None, TitleSuggestionState, TitleSuggestionState]:
    """제목 평가부터 검증·수정까지의 위상을 컴파일한다."""
    graph = StateGraph(TitleSuggestionState)
    graph.add_node("assess_context", cast(Any, assess_context))
    graph.add_node("gather_events", cast(Any, gather_events))
    graph.add_node("synthesize", cast(Any, synthesize))
    graph.add_node("validate_candidate", cast(Any, validate_candidate))
    graph.add_node("repair", cast(Any, repair))
    graph.add_node("finalize", cast(Any, finalize))
    graph.add_node("empty", cast(Any, empty))
    graph.add_edge(START, "assess_context")
    graph.add_conditional_edges(
        "assess_context",
        route_assessment,
        {"empty": "empty", "gather_events": "gather_events", "synthesize": "synthesize"},
    )
    graph.add_edge("gather_events", "synthesize")
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
