"""title-suggestion 요청 모델의 봉투 보존과 주입 거부와 멱등 해시를 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.title_suggestion.models import TitleSuggestionRequest

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-title"}
_CONTEXT = {
    "title": "Untitled",
    "status": "completed",
    "workspacePath": "/workspace/project",
    "totalEventCount": 300,
    "totalTurnCount": 25,
    "truncated": True,
    "turns": [
        {
            "turnIndex": 1,
            "askedText": "인증 미들웨어의 토큰 누수를 고쳐줘",
            "assistantText": "회귀 테스트를 추가하고 누수를 수정했습니다.",
        }
    ],
}


def _request(**overrides: Any) -> TitleSuggestionRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "jobId": "job-1",
        "taskId": "task-1",
        "language": "ko",
        "context": _CONTEXT,
        "userId": "user-1",
        "completionCallback": _COMPLETION,
    }
    values.update(overrides)
    return TitleSuggestionRequest.model_validate(values)


def test_실행_envelope만_받고_주입된_정의를_거부한다() -> None:
    req = _request()

    assert req.taskId == "task-1"
    with pytest.raises(ValidationError):
        _request(systemPrompt="런타임이 정의를 밀어 넣는다")


def test_도메인_봉투를_보존한다() -> None:
    req = _request(taskId=" task-1 ")

    assert req.taskId == "task-1"
    assert req.context.turns[0].askedText == "인증 미들웨어의 토큰 누수를 고쳐줘"
    assert req.deadlineMs == 180_000


def test_멱등_입력_해시는_콜백과_자격증명에_영향받지_않는다() -> None:
    base = _request(idempotencyKey="key-1")
    changed_callbacks = _request(
        idempotencyKey="key-1",
        apiKey="second-key",
        completionCallback={"url": "http://worker:8810/runs/complete", "token": "done-2"},
    )
    changed_input = _request(idempotencyKey="key-1", language="en")

    assert base.idempotency_input_hash() == changed_callbacks.idempotency_input_hash()
    assert base.idempotency_input_hash() != changed_input.idempotency_input_hash()
