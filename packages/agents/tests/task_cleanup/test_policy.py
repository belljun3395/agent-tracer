"""task-cleanup 정책 함수의 제안 검증 규칙을 검증한다."""

from __future__ import annotations

from agent_graph.agents.task_cleanup.models import (
    CleanupCandidate,
    CleanupDraftSuggestion,
    TaskCleanupState,
)
from agent_graph.agents.task_cleanup.policy import validate_suggestions


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
