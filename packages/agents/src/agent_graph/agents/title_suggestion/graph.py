"""title-suggestion의 정적 LangGraph 위상과 요청별 실행 컨텍스트를 제공한다."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.runtime import Runtime

from ..runtime.execution.trace import ExecutionTrace
from .models import TitleSuggestionState
from .policy import ValidationRoute

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class TitleGraphContext:
    """정적 외곽 그래프에 요청별 노드와 관측 의존성을 주입한다."""

    trace: ExecutionTrace
    investigate: TitleNode
    validate_candidate: TitleNode
    repair: TitleNode
    finalize: TitleNode
    empty: TitleNode
    route_validation: ValidationRoute


def build_title_suggestion_graph() -> CompiledStateGraph[
    TitleSuggestionState, TitleGraphContext, TitleSuggestionState, TitleSuggestionState
]:
    """요청별 의존성을 Runtime Context로 받는 title-suggestion 그래프를 컴파일한다."""
    graph = StateGraph(TitleSuggestionState, context_schema=TitleGraphContext)
    graph.add_node("investigate", cast(Any, _investigate))
    graph.add_node("validate_candidate", cast(Any, _validate_candidate))
    graph.add_node("repair", cast(Any, _repair))
    graph.add_node("finalize", cast(Any, _finalize))
    graph.add_node("empty", cast(Any, _empty))
    graph.add_edge(START, "investigate")
    graph.add_edge("investigate", "validate_candidate")
    graph.add_conditional_edges(
        "validate_candidate",
        cast(Any, _route_validation),
        {"repair": "repair", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("repair", "validate_candidate")
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()


async def _investigate(
    state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]
) -> dict[str, Any]:
    return await _run_node("investigate", state, runtime, runtime.context.investigate)


async def _validate_candidate(
    state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]
) -> dict[str, Any]:
    return await _run_node("validate_candidate", state, runtime, runtime.context.validate_candidate)


async def _repair(state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]) -> dict[str, Any]:
    return await _run_node("repair", state, runtime, runtime.context.repair)


async def _finalize(state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]) -> dict[str, Any]:
    return await _run_node("finalize", state, runtime, runtime.context.finalize)


async def _empty(state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]) -> dict[str, Any]:
    return await _run_node("empty", state, runtime, runtime.context.empty)


def _route_validation(state: TitleSuggestionState, runtime: Runtime[TitleGraphContext]) -> str:
    return runtime.context.route_validation(state)


async def _run_node(
    node_name: str,
    state: TitleSuggestionState,
    runtime: Runtime[TitleGraphContext],
    node: TitleNode,
) -> dict[str, Any]:
    trace = runtime.context.trace
    trace.record_graph_event(
        "node.started", f"title-suggestion entered {node_name}", node_name=node_name
    )
    started = time.monotonic()
    try:
        result = await node(state)
    except BaseException:
        trace.record_graph_event(
            "node.failed",
            f"title-suggestion failed in {node_name}",
            node_name=node_name,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        raise
    trace.record_graph_event(
        "node.completed",
        f"title-suggestion completed {node_name}",
        node_name=node_name,
        duration_ms=int((time.monotonic() - started) * 1000),
    )
    return result


TITLE_SUGGESTION_GRAPH = build_title_suggestion_graph()
