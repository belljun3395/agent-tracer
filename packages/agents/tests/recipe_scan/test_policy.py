"""recipe-scan 정책 함수의 라운드 배분과 인용 검증 규칙을 검증한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.models import (
    MAX_TOOL_ROUNDS,
    DispatchPlan,
    ProvenanceCatalog,
    RecipeCandidate,
)
from agent_graph.agents.recipe_scan.policy import (
    MIN_SYNTHESIS_ROUNDS,
    SURVEY_ROUNDS,
    clamp_plan,
    distributable_rounds,
    synthesis_rounds,
    validate_recipe_candidate,
)


def test_배분_가능한_라운드는_종합_최소_몫을_먼저_뗀다() -> None:
    # 전문가에게 나눠줄 수 있는 라운드는 계획과 종합 최소 몫을 뗀 나머지다.
    assert distributable_rounds() == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - MIN_SYNTHESIS_ROUNDS


def test_종합_라운드는_전문가가_적게_쓰면_남은_만큼_더_받는다() -> None:
    small = DispatchPlan(probes=[{"probe": "rules", "rounds": 3, "question": "무엇"}])  # type: ignore[list-item]
    large = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 6, "question": "무엇"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 5, "question": "규칙"},  # type: ignore[list-item]
        ]
    )

    # 종합은 남은 라운드를 그대로 받아 전문가를 적게 띄우면 더 여유를 갖는다.
    assert synthesis_rounds(small) == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - 3
    assert synthesis_rounds(large) == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - 11
    assert synthesis_rounds(small) > synthesis_rounds(large)
    # 계획이 없으면 조율자가 혼자 도는 실행이라 종합이 예산을 통째로 갖는다.
    assert synthesis_rounds(None) == MAX_TOOL_ROUNDS


def test_종합_라운드는_최소_몫_아래로_내려가지_않는다() -> None:
    greedy = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 10, "question": "무엇"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 10, "question": "규칙"},  # type: ignore[list-item]
        ]
    )

    assert synthesis_rounds(greedy) == MIN_SYNTHESIS_ROUNDS


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
    provenance = ProvenanceCatalog(eventIdsByTask={"task-1": {"event-1"}, "task-2": {"event-2"}})

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


def test_조율자의_배분이_예산을_넘으면_비례로_깎인다() -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 10, "question": "앵커가 무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 6, "question": "적용 규칙은"},  # type: ignore[list-item]
            {"probe": "repetition", "rounds": 4, "question": "반복되나"},  # type: ignore[list-item]
        ]
    )

    kept, cut = clamp_plan(plan, 20)
    assert [probe.rounds for probe in kept.probes] == [10, 6, 4] and cut == 0

    shrunk, cut = clamp_plan(plan, 14)
    # 남은 예산을 넘지 않으면서 흘리지도 않는다.
    assert shrunk.total_rounds() == 14 and cut == 6

    floored, _cut = clamp_plan(plan, 3)
    # 전문가마다 최소 한 라운드는 남아 계획이 통째로 사라지지 않는다.
    assert [probe.rounds for probe in floored.probes] == [1, 1, 1]


def test_전문가_수가_예산보다_많으면_많이_요구한_순서로_남긴다() -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 10, "question": "앵커가 무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 6, "question": "적용 규칙은"},  # type: ignore[list-item]
            {"probe": "repetition", "rounds": 4, "question": "반복되나"},  # type: ignore[list-item]
        ]
    )

    kept, cut = clamp_plan(plan, 2)

    assert [probe.probe for probe in kept.probes] == ["timeline", "rules"]
    assert [probe.rounds for probe in kept.probes] == [1, 1]
    assert cut == 18
