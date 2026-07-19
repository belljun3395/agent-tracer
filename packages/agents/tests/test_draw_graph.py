"""그래프 시각화 스크립트가 런타임 위상을 그대로 노출하는지 검증한다."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def test_문서화된_명령으로_Mermaid를_출력한다() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/draw_graph.py"],
        cwd=SERVICE_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "graph TD" in result.stdout


def test_현재_recipe_그래프의_노드와_간선을_그린다() -> None:
    from scripts.draw_graph import build_graph

    drawable = build_graph().get_graph()
    assert set(drawable.nodes) == {
        "__start__",
        "survey",
        "investigate",
        "validate_candidate",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }
    edges = {(edge.source, edge.target) for edge in drawable.edges}
    # 조율자가 계획을 세운 뒤에야 조사가 시작한다.
    assert ("__start__", "survey") in edges
    assert ("survey", "investigate") in edges
    assert ("investigate", "validate_candidate") in edges
    assert ("validate_candidate", "repair") in edges
    assert ("repair", "validate_candidate") in edges
    assert ("finalize", "__end__") in edges
    assert ("empty", "__end__") in edges
