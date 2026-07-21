"""세 슬라이스의 그래프 위상 스냅샷과 시각화 스크립트를 검증한다."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

from langgraph.graph.state import CompiledStateGraph

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH
from agent_graph.agents.task_cleanup.graph import TASK_CLEANUP_GRAPH
from agent_graph.agents.title_suggestion.graph import TITLE_SUGGESTION_GRAPH

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def edge_lines(graph: CompiledStateGraph[Any, Any, Any, Any]) -> set[str]:
    """컴파일된 그래프의 간선을 고정(→)과 조건부(⇢)를 구분한 화살표 줄로 만든다."""
    drawable = graph.get_graph()
    return {f"{edge.source} {'⇢' if edge.conditional else '→'} {edge.target}" for edge in drawable.edges}


def test_recipe_그래프의_간선_집합을_고정한다() -> None:
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


def test_cleanup_그래프의_간선_집합을_고정한다() -> None:
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


def test_title_그래프의_간선_집합을_고정한다() -> None:
    print(TITLE_SUGGESTION_GRAPH.get_graph().draw_ascii())
    assert edge_lines(TITLE_SUGGESTION_GRAPH) == {
        "__start__ → investigate",
        "investigate → validate_candidate",
        "validate_candidate ⇢ repair",
        "validate_candidate ⇢ finalize",
        "validate_candidate ⇢ empty",
        "repair → validate_candidate",
        "finalize → __end__",
        "empty → __end__",
    }


def _run_script(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "scripts/draw_graph.py", *args],
        cwd=SERVICE_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def test_문서화된_명령으로_세_그래프를_ASCII_박스로_출력한다() -> None:
    result = _run_script()

    assert result.returncode == 0, result.stderr
    for name in ("recipe-scan", "task-cleanup", "title-suggestion"):
        assert f"## {name}" in result.stdout
    assert result.stdout.count("| investigate |") >= 2


def test_mermaid_옵션으로_세_그래프의_Mermaid를_출력한다() -> None:
    result = _run_script("--mermaid")

    assert result.returncode == 0, result.stderr
    assert result.stdout.count("graph TD") == 3
