"""title-suggestion 정책 함수의 후보 검증 규칙을 검증한다."""

from __future__ import annotations

from agent_graph.agents.title_suggestion.models import TitleSuggestion, TitleSuggestionDraft
from agent_graph.agents.title_suggestion.policy import validate_title_candidate


def test_후보는_둘_이상이어야_하고_중복과_현재_제목을_되풀이하면_거부한다() -> None:
    single = TitleSuggestionDraft(suggestions=[TitleSuggestion(title="유일한 제목", rationale="근거")])
    assert "suggestions must be empty or contain 2-3 items" in validate_title_candidate(single, "현재 제목")

    repeated = TitleSuggestionDraft(
        suggestions=[
            TitleSuggestion(title="현재 제목", rationale="현재를 되풀이한다"),
            TitleSuggestion(title="다른 제목", rationale="근거"),
            TitleSuggestion(title="다른 제목", rationale="같은 제목을 되풀이한다"),
        ]
    )

    errors = validate_title_candidate(repeated, "현재 제목")

    assert "suggestion 1 repeats the current title" in errors
    assert "suggestion 3 duplicates another suggestion" in errors


def test_자리표시자_제목_후보를_거부한다() -> None:
    draft = TitleSuggestionDraft(
        suggestions=[
            TitleSuggestion(title="Untitled", rationale="자리표시자를 그대로 낸다"),
            TitleSuggestion(title="Task 12", rationale="자동 생성된 자리표시자다"),
        ]
    )

    errors = validate_title_candidate(draft, "현재 제목")

    assert "suggestion 1 is a placeholder title" in errors
    assert "suggestion 2 is a placeholder title" in errors
