"""recipe-scan 그래프의 위상을 간선 스냅샷으로 고정한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH
from tests.support.topology import edge_lines


def test_그래프의_간선_집합을_고정한다() -> None:
    print(RECIPE_SCAN_GRAPH.get_graph().draw_ascii())
    assert edge_lines(RECIPE_SCAN_GRAPH) == {
        "__start__ → survey",
        "survey ⇢ probe",
        "survey ⇢ investigate",
        "probe → investigate",
        "investigate ⇢ probe",
        "investigate ⇢ validate_candidate",
        "validate_candidate ⇢ repair",
        "validate_candidate ⇢ finalize",
        "validate_candidate ⇢ empty",
        "repair → validate_candidate",
        "finalize → __end__",
        "empty → __end__",
    }
