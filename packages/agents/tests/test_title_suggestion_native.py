"""Python-native title-suggestion의 요청 경계와 명시 그래프를 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.shared.models import AgentResponse
from agent_graph.agents.title_suggestion import agent as title_mod
from agent_graph.agents.title_suggestion.models import TitleSuggestionRequest
from tests.fakes import FakeStructuredChat, FakeToolClient

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
    outputs: list[object],
    client: FakeToolClient | None = None,
    **request_overrides: Any,
) -> tuple[AgentResponse, FakeToolClient]:
    monkeypatch.setattr(title_mod, "make_chat", lambda *args, **kwargs: FakeStructuredChat(outputs))
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
    assert req.context.title == "Untitled"
    with pytest.raises(ValidationError):
        _request(systemPrompt="injected")
    with pytest.raises(ValidationError):
        _request(tools=[])
    with pytest.raises(ValidationError):
        _request(maxTurns=10)


async def test_현재_제목이_적절하면_도구와_합성_없이_빈_결과를_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, client = await _run(
        monkeypatch,
        [{"action": "keep", "reason": "현재 제목이 작업을 정확히 설명한다."}],
        context={**_CONTEXT, "title": "인증 토큰 누수 수정"},
    )

    assert result.error is None
    assert result.data == {"suggestions": []}
    assert client.calls == []
    routes = [step.content for step in result.steps if step.eventKind == "route.selected"]
    assert any("assess_context -> empty" in content for content in routes)


async def test_발췌가_충분하면_도구_없이_두_제목을_합성한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, client = await _run(
        monkeypatch,
        [
            {"action": "suggest", "reason": "대화 발췌에 요청과 결과가 있다."},
            {
                "suggestions": [
                    {"title": "인증 토큰 누수 수정", "rationale": "인증 미들웨어 누수를 수정했다."},
                    {"title": "인증 미들웨어 회귀 방지", "rationale": "누수 회귀 테스트를 추가했다."},
                ]
            },
        ],
    )

    assert result.error is None
    assert result.data is not None and len(result.data["suggestions"]) == 2
    assert client.calls == []
    assert any(
        step.nodeName == "validate_candidate" and step.eventKind == "node.completed"
        for step in result.steps
    )


async def test_발췌가_부족하면_고정된_taskId의_최신_이벤트를_두_페이지만_읽는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeToolClient(
        {
            "get_task_events": {
                "events": [{"id": "event-1", "title": "검증 완료"}],
                "truncated": True,
                "nextCursor": "cursor-2",
                "total": 300,
            }
        }
    )
    result, _ = await _run(
        monkeypatch,
        [
            {"action": "gather", "reason": "원시 실행 근거가 더 필요하다."},
            {
                "suggestions": [
                    {"title": "인증 토큰 누수 수정", "rationale": "이벤트에서 수정 완료를 확인했다."},
                    {"title": "인증 미들웨어 검증 강화", "rationale": "이벤트에서 검증 실행을 확인했다."},
                ]
            },
        ],
        client,
    )

    assert result.error is None
    assert client.calls == ["get_task_events", "get_task_events"]
    assert all(args["taskId"] == "task-1" for args in client.args)
    assert all(args["order"] == "desc" and args["limit"] == 100 for args in client.args)
    assert client.args[1]["cursor"] == "cursor-2"
    assert [step.toolName for step in result.steps if step.role == "tool"] == [
        "get_task_events",
        "get_task_events",
    ]


async def test_중복되거나_현재와_같은_후보는_한_번만_수정한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, _ = await _run(
        monkeypatch,
        [
            {"action": "suggest", "reason": "제목을 개선할 수 있다."},
            {
                "suggestions": [
                    {"title": "Untitled", "rationale": "현재 제목을 반복했다."},
                    {"title": "인증 토큰 누수 수정", "rationale": "누수 수정이 핵심이다."},
                ]
            },
            {
                "suggestions": [
                    {"title": "인증 토큰 누수 수정", "rationale": "누수 수정이 핵심이다."},
                    {"title": "인증 미들웨어 회귀 방지", "rationale": "회귀 테스트도 추가했다."},
                ]
            },
        ],
    )

    assert result.error is None
    assert result.data is not None and len(result.data["suggestions"]) == 2
    assert sum(step.eventKind == "validation.failed" for step in result.steps) == 1
    assert sum(
        step.nodeName == "repair" and step.eventKind == "node.started"
        for step in result.steps
    ) == 1
    assert any(
        step.role == "user" and "Write every title and rationale in Korean" in step.content
        for step in result.steps
    )


async def test_수정_후에도_후보가_유효하지_않으면_빈_결과를_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = {
        "suggestions": [{"title": "Task 123", "rationale": "자리표시자다."}]
    }
    result, _ = await _run(
        monkeypatch,
        [
            {"action": "suggest", "reason": "제목을 개선해야 한다."},
            invalid,
            invalid,
        ],
    )

    assert result.error is None
    assert result.data == {"suggestions": []}
    assert sum(step.eventKind == "validation.failed" for step in result.steps) == 2


async def test_노드_예외를_완료가_아니라_실패로_기록한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, _ = await _run(monkeypatch, [])

    assert result.error is not None
    assessment_events = [
        step.eventKind for step in result.steps if step.nodeName == "assess_context"
    ]
    assert assessment_events == ["node.started", "node.failed"]
    assert all(
        "sk-test" not in step.content and "tok-title" not in step.content
        for step in result.steps
        if step.role == "graph"
    )


async def test_이벤트_callback_실패는_근거로_사용하지_않고_실행을_실패시킨다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, client = await _run(
        monkeypatch,
        [{"action": "gather", "reason": "원시 이벤트가 필요하다."}],
        FakeToolClient(),
    )

    assert result.data is None
    assert result.error is not None and result.error.subtype == "agent_error"
    assert client.calls == ["get_task_events"]
    assert not any(step.nodeName == "synthesize" for step in result.steps)


async def test_단가를_모르는_모델은_내부_예산을_우회하지_못한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result, _ = await _run(
        monkeypatch,
        [{"action": "suggest", "reason": "제목을 개선한다."}],
        model="claude-custom-alias",
    )

    assert result.data is None
    assert result.error is not None and result.error.subtype == "budget_exceeded"
    assert "cannot enforce" in result.error.summary
