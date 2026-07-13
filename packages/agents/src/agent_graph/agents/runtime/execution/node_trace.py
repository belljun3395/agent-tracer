"""LangGraph 노드 실행을 그래프 단계로 관측한다."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any

from .trace import ExecutionTrace

type NativeNode[StateT] = Callable[[StateT], Awaitable[dict[str, Any]]]


def traced_node[StateT](
    agent_name: str,
    node_name: str,
    trace: ExecutionTrace,
    node: NativeNode[StateT],
) -> NativeNode[StateT]:
    """노드의 시작·성공·실패와 실행 시간을 궤적에 기록한다."""

    async def wrapped(state: StateT) -> dict[str, Any]:
        trace.record_graph_event("node.started", f"{agent_name} entered {node_name}", node_name=node_name)
        started = time.monotonic()
        try:
            result = await node(state)
        except BaseException:
            duration_ms = int((time.monotonic() - started) * 1000)
            trace.record_graph_event(
                "node.failed",
                f"{agent_name} failed in {node_name}",
                node_name=node_name,
                duration_ms=duration_ms,
            )
            raise
        duration_ms = int((time.monotonic() - started) * 1000)
        trace.record_graph_event(
            "node.completed",
            f"{agent_name} completed {node_name}",
            node_name=node_name,
            duration_ms=duration_ms,
        )
        return result

    return wrapped
