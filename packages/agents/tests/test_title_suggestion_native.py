"""title-suggestion 도구 루프와 결정적 검증을 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.shared.models import AgentResponse
from agent_graph.agents.title_suggestion import agent as title_mod
from agent_graph.agents.title_suggestion.models import TitleSuggestionRequest
from tests.fakes import FakeToolClient, FakeToolLoopChat

_CALLBACK = {"url": "http://worker:8810/tools/invoke", "token": "tok-title"}
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

_SUGGESTIONS = {
    "suggestions": [
        {"title": "인증 토큰 누수 수정", "rationale": "누수 수정이 핵심 작업이다."},
        {"title": "인증 회귀 테스트 추가", "rationale": "회귀 검증을 함께 추가했다."},
    ]
}

_EVENT_PAGE = {
    "events": [{"id": "event-1", "title": "토큰 누수 수정"}],
    "truncated": False,
    "nextCursor": None,
    "total": 1,
}


def _request(**overrides: Any) -> TitleSuggestionRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "jobId": "job-1",
        "taskId": "task-1",
        "language": "ko",
        "context": _CONTEXT,
        "toolCallback": _CALLBACK,
        "completionCallback": _COMPLETION,
    }
    values.update(overrides)
    return TitleSuggestionRequest.model_validate(values)


async def _run(
    monkeypatch: pytest.MonkeyPatch,
    turns: list[Any],
    client: FakeToolClient | None = None,
    **request_overrides: Any,
) -> tuple[AgentResponse, FakeToolClient]:
    chat = FakeToolLoopChat(turns)
    monkeypatch.setattr(title_mod, "make_chat", lambda *args, **kwargs: chat)
    req = _request(**request_overrides)
    tool_client = client or FakeToolClient()
    result = await execute(
        "title-suggestion",
        req.model,
        req.deadlineMs,
        lambda usage: title_mod.run_title_suggestion(req, tool_client, usage),
    )
    return result, tool_client


def test_실행_envelope만_받고_주입된_정의를_거부한다() -> None:
    req = _request()

    assert req.taskId == "task-1"
    with pytest.raises(ValidationError):
        _request(systemPrompt="런타임이 정의를 밀어 넣는다")


async def test_대화_발췌로_충분하면_도구를_부르지_않고_제목을_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    res, client = await _run(monkeypatch, [_SUGGESTIONS])

    assert res.error is None
    assert client.calls == []
    assert [item["title"] for item in res.data["suggestions"]] == [
        "인증 토큰 누수 수정",
        "인증 회귀 테스트 추가",
    ]


async def test_현재_제목이_적절하면_빈_결과를_낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    res, _client = await _run(monkeypatch, [{"suggestions": []}])

    assert res.error is None and res.data == {"suggestions": []}


async def test_발췌가_부족하면_모델이_스스로_이벤트를_읽는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeToolClient({"get_task_events": _EVENT_PAGE})
    turns: list[Any] = [
        [{"name": "get_task_events", "args": {"taskId": "task-1"}}],
        _SUGGESTIONS,
    ]

    res, tool_client = await _run(monkeypatch, turns, client)

    assert res.error is None
    assert tool_client.calls == ["get_task_events"]
    assert tool_client.args == [{"taskId": "task-1", "limit": 100, "order": "asc"}]
    assert [step.toolName for step in res.steps if step.role == "tool"] == ["get_task_events"]


async def test_현재_제목을_되풀이한_후보는_한_번_수정한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repeated = {
        "suggestions": [
            {"title": "Untitled", "rationale": "현재 제목을 그대로 되풀이한다."},
            {"title": "인증 회귀 테스트 추가", "rationale": "회귀 검증을 추가했다."},
        ]
    }

    res, _client = await _run(monkeypatch, [repeated, _SUGGESTIONS])

    assert res.error is None
    assert [item["title"] for item in res.data["suggestions"]] == [
        "인증 토큰 누수 수정",
        "인증 회귀 테스트 추가",
    ]
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert len(failures) == 1 and "repeats the current title" in failures[0].content


async def test_수정_후에도_후보가_유효하지_않으면_빈_결과를_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = {"suggestions": [{"title": "Untitled", "rationale": "여전히 현재 제목이다."}]}

    res, _client = await _run(monkeypatch, [invalid, invalid])

    assert res.error is None and res.data == {"suggestions": []}
    assert sum(step.eventKind == "validation.failed" for step in res.steps) == 2


async def test_단가를_모르는_모델은_내부_예산을_우회하지_못한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    res, _client = await _run(monkeypatch, [_SUGGESTIONS], model="claude-custom-alias")

    assert res.error is not None
    assert "cannot enforce its internal budget" in res.error.summary
