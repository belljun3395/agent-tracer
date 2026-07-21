"""chat 도구 루프가 어시스턴트 답변과 제안·기억 쓰기를 내는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from agent_graph.agents.chat import agent as chat_mod
from agent_graph.agents.chat.models import ChatRequest
from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.shared.models import AgentResponse
from tests.support.fakes import FakeToolLoopChat
from tests.support.narrate import narrate

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-chat"}


def _request(**overrides: Any) -> ChatRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "jobId": "job-1",
        "threadId": "thread-1",
        "userId": "user-1",
        "language": "ko",
        "messages": [{"role": "user", "content": "task-1 아카이브해줘"}],
        "completionCallback": _COMPLETION,
    }
    values.update(overrides)
    return ChatRequest.model_validate(values)


async def _run(monkeypatch: pytest.MonkeyPatch, turns: list[Any], **overrides: Any) -> AgentResponse:
    chat = FakeToolLoopChat(turns)
    monkeypatch.setattr(chat_mod, "make_chat", lambda *_args, **_kwargs: chat)
    req = _request(**overrides)
    async with httpx.AsyncClient() as client:
        return await execute(
            "chat",
            req.model,
            req.deadlineMs,
            lambda usage: chat_mod.run_chat(req, client, usage),
        )


async def test_쓰기_도구는_실행_대신_제안으로_기록되고_답변이_나온다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result = await _run(
        monkeypatch,
        [
            [{"name": "archive_task", "args": {"taskId": "task-1"}}],
            "task-1 아카이브를 제안했고 승인을 기다립니다.",
        ],
    )

    narrate("chat :: 쓰기 도구를 제안으로 기록하고 답변을 낸다", result)
    data = result.data or {}
    proposals = data["proposedWrites"]
    assert proposals == [{"toolName": "archive_task", "args": {"taskId": "task-1"}}]
    assert data["memoryWrites"] == []
    assert isinstance(data["assistantText"], str)
    assert data["assistantText"] != ""


async def test_remember_fact는_기억_쓰기로_기록된다(monkeypatch: pytest.MonkeyPatch) -> None:
    result = await _run(
        monkeypatch,
        [
            [{"name": "remember_fact", "args": {"key": "lang", "content": "한국어를 쓴다"}}],
            "기억했습니다.",
        ],
    )

    data = result.data or {}
    assert data["memoryWrites"] == [{"key": "lang", "content": "한국어를 쓴다"}]
    assert data["proposedWrites"] == []
