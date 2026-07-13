"""실행 코드가 사용하는 recipe-scan 그래프를 Mermaid로 출력한다.

실행: .venv/bin/python scripts/draw_graph.py
"""

from __future__ import annotations

from typing import Any, Literal

from langgraph.graph.state import CompiledStateGraph

from agent_graph.agents.recipe_scan.graph import build_recipe_scan_graph
from agent_graph.agents.recipe_scan.models import RecipeScanState


async def _node(_state: RecipeScanState) -> dict[str, Any]:
    return {}


def _assess(
    _state: RecipeScanState,
) -> Literal["plan_evidence", "synthesize", "empty"]:
    return "empty"


def _validate(_state: RecipeScanState) -> Literal["repair", "finalize", "empty"]:
    return "empty"


def build_graph() -> CompiledStateGraph[
    RecipeScanState, None, RecipeScanState, RecipeScanState
]:
    return build_recipe_scan_graph(
        _node,
        _node,
        _node,
        _node,
        _node,
        _node,
        _node,
        _node,
        _node,
        _assess,
        _validate,
    )


if __name__ == "__main__":
    print(build_graph().get_graph().draw_mermaid())
