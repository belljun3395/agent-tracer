"""Python-native recipe-scan의 그래프 위상과 후보 검증을 확인한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH, _dispatch
from agent_graph.agents.recipe_scan.models import (
    DispatchPlan,
    ProvenanceCatalog,
    RecipeCandidate,
)
from agent_graph.agents.recipe_scan.policy import validate_recipe_candidate


def test_recipe_전용_그래프_위상을_명시한다() -> None:
    graph = RECIPE_SCAN_GRAPH.get_graph()

    assert set(graph.nodes) == {
        "__start__",
        "survey",
        "probe",
        "investigate",
        "validate_candidate",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }


def test_전문가_비용_몫은_배분한_라운드에_비례한다() -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 6, "question": "무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 2, "question": "어떤 규칙이"},  # type: ignore[list-item]
        ]
    )

    sends = _dispatch({"plan": plan})  # type: ignore[typeddict-item]

    shares = {send.arg["assignment"]["probe"]: send.arg["cost_share"] for send in sends}
    # 8라운드 중 6:2로 나눴으니 비용도 0.75:0.25로 갈린다.
    assert shares == {"timeline": 0.75, "rules": 0.25}


def test_계획이_없으면_조율자가_혼자_조사한다() -> None:
    sends = _dispatch({"plan": None})  # type: ignore[typeddict-item]

    assert [send.node for send in sends] == ["investigate"]


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
        eventIdsByTask={"task-1": {"event-1"}, "task-2": {"event-2"}},
    )

    errors = validate_recipe_candidate(candidate, "task-1", provenance)

    assert "The anchor contributing slice must cite at least one anchor event ID." in errors


def test_이벤트를_읽지_않은_태스크는_기여_슬라이스로_인정하지_않는다() -> None:
    candidate = RecipeCandidate(
        title="Add migration",
        intent="마이그레이션을 안전하게 추가한다",
        description="스키마 변경이 필요할 때 쓴다.",
        summary_md="- 변경을 정의한다\n- 검증한다",
        request="사용자가 마이그레이션 추가를 요청했다.",
        contributing_slices=[
            {"taskId": "task-1", "eventIds": ["event-1"]},
            {"taskId": "task-2", "eventIds": []},
        ],
        rationale="반복 가능한 절차다.",
    )
    provenance = ProvenanceCatalog(eventIdsByTask={"task-1": {"event-1"}})

    errors = validate_recipe_candidate(candidate, "task-1", provenance)

    assert "Unsupported contributing task ID: task-2." in errors

