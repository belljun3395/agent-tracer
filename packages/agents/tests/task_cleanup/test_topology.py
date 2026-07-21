"""task-cleanup 그래프의 위상을 간선 스냅샷으로 고정한다."""

from __future__ import annotations

from agent_graph.agents.task_cleanup.graph import TASK_CLEANUP_GRAPH
from tests.support.topology import edge_lines


def test_그래프의_간선_집합을_고정한다() -> None:
    print(TASK_CLEANUP_GRAPH.get_graph().draw_ascii())
    assert edge_lines(TASK_CLEANUP_GRAPH) == {
        "__start__ → triage",
        "triage ⇢ inspect",
        "triage ⇢ empty",
        "inspect → investigate",
        "investigate ⇢ inspect",
        "investigate ⇢ validate_decisions",
        "validate_decisions ⇢ repair",
        "validate_decisions ⇢ finalize",
        "validate_decisions ⇢ empty",
        "repair → validate_decisions",
        "finalize → __end__",
        "empty → __end__",
    }
