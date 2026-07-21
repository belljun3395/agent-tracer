"""task-cleanup 정책 함수의 라운드 배분과 제안 검증 규칙을 검증한다."""

from __future__ import annotations

from agent_graph.agents.task_cleanup.models import (
    CleanupCandidate,
    CleanupDraftSuggestion,
    TaskCleanupState,
    TriagePlan,
)
from agent_graph.agents.task_cleanup.policy import (
    DECISION_ROUNDS,
    MAX_TOOL_ROUNDS,
    TRIAGE_ROUNDS,
    clamp_triage,
    decision_rounds,
    inspection_rounds,
    validate_suggestions,
)


def _candidate(task_id: str, *, has_events: bool) -> CleanupCandidate:
    return CleanupCandidate(
        id=task_id,
        visibleTitle=f"제목 {task_id}",
        status="running",
        lastEventAt=None,
        hasEvents=has_events,
        activeChildCount=0,
        candidateReasons=["stale"],
    )


def _state(
    *,
    exposed: dict[str, CleanupCandidate],
    event_ids: dict[str, set[str]],
    max_suggestions: int = 5,
) -> TaskCleanupState:
    return {
        "scanned_at": "2026-07-14T00:00:00Z",
        "language": "ko",
        "max_suggestions": max_suggestions,
        "messages": [],
        "plan": None,
        "redispatch": None,
        "redispatch_ceiling": 0.0,
        "redispatch_count": 0,
        "reports": [],
        "exposed_candidates": exposed,
        "event_ids_by_task": event_ids,
        "model_cost_usd": 0.0,
        "suggestions": [],
    }


def test_결정_라운드는_선별이_적게_쓰면_더_받고_최소_몫_아래로_내려가지_않는다() -> None:
    small = TriagePlan(inspect=[{"taskId": "task-1", "rounds": 3}])  # type: ignore[list-item]
    greedy = TriagePlan(
        inspect=[
            {"taskId": "task-1", "rounds": 4},  # type: ignore[list-item]
            {"taskId": "task-2", "rounds": 4},  # type: ignore[list-item]
            {"taskId": "task-3", "rounds": 4},  # type: ignore[list-item]
        ]
    )

    # 조사는 선별과 결정 최소 몫을 뗀 나머지를 받고, 결정은 조사가 적게 쓰면 더 여유를 갖는다.
    assert inspection_rounds() == MAX_TOOL_ROUNDS - TRIAGE_ROUNDS - DECISION_ROUNDS
    assert decision_rounds(small) == MAX_TOOL_ROUNDS - TRIAGE_ROUNDS - 3
    assert decision_rounds(greedy) == DECISION_ROUNDS
    # 계획이 없으면 조율자가 혼자 도는 실행이라 결정이 예산을 통째로 갖는다.
    assert decision_rounds(None) == MAX_TOOL_ROUNDS


def test_고른_후보가_예산보다_많으면_많이_요구한_순서로_남긴다() -> None:
    plan = TriagePlan(
        inspect=[
            {"taskId": "task-1", "rounds": 4},  # type: ignore[list-item]
            {"taskId": "task-2", "rounds": 3},  # type: ignore[list-item]
            {"taskId": "task-3", "rounds": 1},  # type: ignore[list-item]
        ]
    )

    kept, cut = clamp_triage(plan, 2)

    assert [item.taskId for item in kept.assignments] == ["task-1", "task-2"]
    assert [item.rounds for item in kept.assignments] == [1, 1]
    assert cut == 6


def test_노출되지_않은_후보와_읽지_않은_이벤트_후보를_버리고_인용이_맞는_후보만_남긴다() -> None:
    state = _state(
        exposed={
            "task-1": _candidate("task-1", has_events=True),
            "task-2": _candidate("task-2", has_events=True),
        },
        event_ids={"task-1": {"event-1"}},
    )
    suggestions = [
        CleanupDraftSuggestion(
            kind="archive", taskId="task-1", rationale="의미 있는 활동이 없다", evidenceEventIds=["event-1"]
        ),
        CleanupDraftSuggestion(
            kind="archive", taskId="task-2", rationale="근거 없이 제안", evidenceEventIds=[]
        ),
        CleanupDraftSuggestion(kind="archive", taskId="ghost", rationale="없는 태스크", evidenceEventIds=[]),
    ]

    valid, errors = validate_suggestions(suggestions, state)

    # 검토자가 읽고 인용까지 맞춘 후보만 살아남는다.
    assert [item.taskId for item in valid] == ["task-1"]
    assert any("unsupported candidate task ID ghost" in error for error in errors)
    assert any("task-2 was never inspected" in error for error in errors)
