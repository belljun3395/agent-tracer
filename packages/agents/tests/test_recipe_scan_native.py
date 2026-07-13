"""Python-native recipe-scan의 그래프 위상과 후보 검증을 확인한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from agent_graph.agents.recipe_scan.graph import build_recipe_scan_graph
from agent_graph.agents.recipe_scan.models import (
    ProvenanceCatalog,
    RecipeCandidate,
    RecipeScanState,
)
from agent_graph.agents.recipe_scan.policy import validate_recipe_candidate


async def _node(_state: RecipeScanState) -> dict[str, Any]:
    return {}


def _assess(_state: RecipeScanState) -> Literal["plan_evidence", "synthesize", "empty"]:
    return "synthesize"


def _validate(_state: RecipeScanState) -> Literal["repair", "finalize", "empty"]:
    return "finalize"


def test_recipe_전용_그래프_위상을_명시한다() -> None:
    graph = build_recipe_scan_graph(
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
    ).get_graph()

    assert set(graph.nodes) == {
        "__start__",
        "bootstrap",
        "plan_evidence",
        "gather_evidence",
        "assess_evidence",
        "synthesize",
        "validate_candidate",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }
    edges = {(edge.source, edge.target) for edge in graph.edges}
    assert ("__start__", "bootstrap") in edges
    assert ("assess_evidence", "plan_evidence") in edges
    assert ("validate_candidate", "repair") in edges
    assert ("repair", "validate_candidate") in edges
    assert ("finalize", "__end__") in edges
    assert ("empty", "__end__") in edges


def test_anchor_slice는_실제_anchor_event를_인용해야_한다() -> None:
    candidate = RecipeCandidate(
        title="Add migration",
        intent="마이그레이션을 안전하게 추가한다",
        description="스키마 변경이 필요할 때 쓴다.",
        summary_md="- 변경을 정의한다\n- 검증한다",
        request="사용자가 마이그레이션 추가를 요청했다.",
        contributing_slices=[{"taskId": "task-1", "eventIds": []}],
        rationale="반복 가능한 절차다.",
    )
    provenance = ProvenanceCatalog(
        taskIds={"task-1", "task-2"},
        eventIdsByTask={"task-1": {"event-1"}, "task-2": {"event-2"}},
    )

    errors = validate_recipe_candidate(candidate, "task-1", provenance)

    assert "The anchor contributing slice must cite at least one anchor event ID." in errors


def test_공유_최종_DTO_fixture를_Python_모델이_그대로_직렬화한다() -> None:
    fixture_path = Path(__file__).parent / "fixtures" / "recipe_scan_result.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))

    candidate = RecipeCandidate.model_validate(payload["recipes"][0])
    serialized = {"recipes": [candidate.model_dump(mode="json", exclude_none=True)]}

    assert serialized == payload
