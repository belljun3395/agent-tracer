"""조사와 검증과 한 번의 수리를 공유하는 정적 LangGraph를 제공한다."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.runtime import Runtime

from .execution.trace import ExecutionTrace

type ValidationNode = Callable[[Any], Awaitable[dict[str, Any]]]
type ValidationRoute = Callable[[Any], str]


@dataclass(frozen=True)
class ValidationGraphContext:
    """정적 검증 그래프에 요청별 노드와 관측 의존성을 주입한다."""

    agent_name: str
    trace: ExecutionTrace
    nodes: dict[str, ValidationNode]
    route_validation: ValidationRoute


def build_validation_graph(
    state_schema: type[Any], validation_node: str
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """요청별 의존성을 Runtime Context로 받는 공통 검증 그래프를 컴파일한다."""
    graph = StateGraph(state_schema, context_schema=ValidationGraphContext)
    for node_name in ("investigate", validation_node, "repair", "finalize", "empty"):
        graph.add_node(node_name, cast(Any, _dispatch(node_name)))
    graph.add_edge(START, "investigate")
    graph.add_edge("investigate", validation_node)
    graph.add_conditional_edges(
        validation_node,
        cast(Any, _route),
        {"repair": "repair", "finalize": "finalize", "empty": "empty"},
    )
    graph.add_edge("repair", validation_node)
    graph.add_edge("finalize", END)
    graph.add_edge("empty", END)
    return graph.compile()


def _dispatch(node_name: str) -> Callable[..., Awaitable[dict[str, Any]]]:
    async def run(state: Any, runtime: Runtime[ValidationGraphContext]) -> dict[str, Any]:
        context = runtime.context
        trace = context.trace
        trace.record_graph_event(
            "node.started", f"{context.agent_name} entered {node_name}", node_name=node_name
        )
        started = time.monotonic()
        try:
            result = await context.nodes[node_name](state)
        except BaseException:
            trace.record_graph_event(
                "node.failed",
                f"{context.agent_name} failed in {node_name}",
                node_name=node_name,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            raise
        trace.record_graph_event(
            "node.completed",
            f"{context.agent_name} completed {node_name}",
            node_name=node_name,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        return result

    return run


def _route(state: Any, runtime: Runtime[ValidationGraphContext]) -> str:
    return runtime.context.route_validation(state)
