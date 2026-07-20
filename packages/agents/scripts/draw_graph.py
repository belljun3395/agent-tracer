"""실행 코드가 사용하는 recipe-scan 그래프를 Mermaid로 출력한다."""

from __future__ import annotations

from typing import Any

from langgraph.graph.state import CompiledStateGraph

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH


def build_graph() -> CompiledStateGraph[Any, Any, Any, Any]:
    """실행 코드가 공유하는 정적 recipe-scan 그래프를 반환한다."""
    return RECIPE_SCAN_GRAPH


if __name__ == "__main__":
    print(build_graph().get_graph().draw_mermaid())
