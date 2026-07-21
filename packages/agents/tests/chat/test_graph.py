"""chat 도구 루프가 어시스턴트 답변과 제안·기억 쓰기를 내는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

import json
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
_READ_API = "http://tracer-api.test"


class _MemoryApi:
    """장기기억 HTTP API를 흉내 내 저장소의 읽기·쓰기 프록시를 검증하는 대역이다."""

    def __init__(self, seed: dict[str, str] | None = None) -> None:
        self.rows = dict(seed or {})
        self.gets = 0
        self.puts: list[tuple[str, str]] = []

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        assert request.headers.get("x-monitor-user") == "user-1"
        path = request.url.path
        if request.method == "GET" and path == "/api/v1/chat/memory":
            self.gets += 1
            items = [
                {"key": key, "content": content, "updatedAt": "2026-07-20T00:00:00+00:00"}
                for key, content in self.rows.items()
            ]
            # tracer-api는 모든 응답을 { ok, data } 봉투로 감싸므로 대역도 같은 모양으로 돌려준다.
            return httpx.Response(200, json={"ok": True, "data": {"items": items}})
        if request.method == "PUT" and path.startswith("/api/v1/chat/memory/"):
            key = path.rsplit("/", 1)[1]
            content = json.loads(request.content)["content"]
            self.rows[key] = content
            self.puts.append((key, content))
            return httpx.Response(200, json={"key": key, "content": content, "status": "remembered"})
        return httpx.Response(404)


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


async def _run_memory(
    monkeypatch: pytest.MonkeyPatch, api: _MemoryApi, turns: list[Any], **overrides: Any
) -> tuple[AgentResponse, FakeToolLoopChat]:
    chat = FakeToolLoopChat(turns)
    monkeypatch.setattr(chat_mod, "make_chat", lambda *_args, **_kwargs: chat)
    req = _request(readApiBaseUrl=_READ_API, **overrides)
    async with httpx.AsyncClient(transport=api.transport()) as client:
        response = await execute(
            "chat", req.model, req.deadlineMs, lambda usage: chat_mod.run_chat(req, client, usage)
        )
    return response, chat


async def test_remember_fact는_저장소로_써지고_기억_쓰기도_그대로_남는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    api = _MemoryApi()
    result, _chat = await _run_memory(
        monkeypatch,
        api,
        [
            [{"name": "remember_fact", "args": {"key": "editor", "content": "vim을 쓴다"}}],
            "기억했습니다.",
        ],
    )

    narrate("chat :: remember_fact가 저장소로 써지고 memory_updated 신호도 남는다", result)
    # 저장소가 정본에 써 넣었고(HTTP PUT), 워커가 memory_updated를 흘리도록 기억 쓰기도 그대로 남는다.
    assert api.puts == [("editor", "vim을 쓴다")]
    data = result.data or {}
    assert data["memoryWrites"] == [{"key": "editor", "content": "vim을 쓴다"}]


async def test_recall_facts는_저장소의_정본_사실을_되읽는다(monkeypatch: pytest.MonkeyPatch) -> None:
    api = _MemoryApi(seed={"lang": "한국어를 쓴다"})
    result, _chat = await _run_memory(
        monkeypatch,
        api,
        [
            [{"name": "recall_facts", "args": {}}],
            "기억하고 있는 사실을 확인했습니다.",
        ],
    )

    narrate("chat :: recall_facts가 저장소의 정본 사실을 되읽는다", result)
    # 프롬프트 주입과 recall_facts가 봉투가 아니라 저장소를 통해 정본을 읽는다.
    assert api.gets >= 1
    assert (result.data or {})["assistantText"] != ""


async def test_체크포인터가_thread_id로_지난_이력_위에서_턴을_잇는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    api = _MemoryApi()
    result, chat = await _run_memory(
        monkeypatch,
        api,
        ["예전에 만든 task-1 이야기입니다."],
        messages=[
            {"role": "user", "content": "task-1 만들어줘"},
            {"role": "assistant", "content": "task-1을 만들었습니다."},
            {"role": "user", "content": "그거 뭐였지?"},
        ],
    )

    narrate("chat :: 체크포인터가 thread_id로 지난 이력 위에서 이번 턴을 잇는다", result)
    seen = " ".join(
        str(getattr(message, "content", message)) for request in chat.requests for message in request
    )
    # 지난 이력이 체크포인터를 통해 되살아나 이번 턴 모델 입력에 전부 보인다.
    assert "task-1 만들어줘" in seen
    assert "task-1을 만들었습니다." in seen
    assert "그거 뭐였지?" in seen
