"""chat 도구 루프가 어시스턴트 답변과 제안·기억 쓰기를 내는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from datetime import UTC, datetime
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
_NOW = datetime(2026, 7, 20, tzinfo=UTC)


class _FakeConnection:
    def __init__(self, ledger: _FakeLedger) -> None:
        self._ledger = ledger

    async def fetchrow(self, _sql: str, _user_id: str, key: str) -> dict[str, Any] | None:
        content = self._ledger.rows.get(key)
        if content is None:
            return None
        return {"key": key, "content": content, "updated_at": _NOW}

    async def fetch(self, _sql: str, _user_id: str) -> list[dict[str, Any]]:
        self._ledger.searches += 1
        return [{"key": k, "content": v, "updated_at": _NOW} for k, v in self._ledger.rows.items()]

    async def execute(self, sql: str, *args: Any) -> None:
        if sql.strip().startswith("DELETE"):
            _user_id, key = args
            self._ledger.rows.pop(key, None)
            return
        _id, _user_id, key, content, _now = args
        self._ledger.rows[key] = content
        self._ledger.puts.append((key, content))


class _FakeAcquire:
    def __init__(self, ledger: _FakeLedger) -> None:
        self._ledger = ledger

    async def __aenter__(self) -> _FakeConnection:
        return _FakeConnection(self._ledger)

    async def __aexit__(self, *_exc: Any) -> bool:
        return False


class _FakeLedger:
    """chat_user_memories 기준 테이블을 인메모리로 흉내 내 저장소의 직접 읽기·쓰기를 검증하는 대역이다."""

    def __init__(self, seed: dict[str, str] | None = None) -> None:
        self.rows = dict(seed or {})
        self.searches = 0
        self.puts: list[tuple[str, str]] = []

    async def pool(self) -> _FakeLedger:
        return self

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self)


def _request(**overrides: Any) -> ChatRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "jobId": "job-1",
        "threadId": "thread-1",
        "executionId": "execution-1",
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
            lambda usage: chat_mod.run_chat(req, client, None, usage),
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
    monkeypatch: pytest.MonkeyPatch, ledger: _FakeLedger, turns: list[Any], **overrides: Any
) -> tuple[AgentResponse, FakeToolLoopChat]:
    chat = FakeToolLoopChat(turns)
    monkeypatch.setattr(chat_mod, "make_chat", lambda *_args, **_kwargs: chat)
    req = _request(readApiBaseUrl=_READ_API, **overrides)
    async with httpx.AsyncClient() as client:
        response = await execute(
            "chat", req.model, req.deadlineMs, lambda usage: chat_mod.run_chat(req, client, ledger, usage)
        )
    return response, chat


async def test_remember_fact는_저장소로_써지고_기억_쓰기도_그대로_남는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = _FakeLedger()
    result, _chat = await _run_memory(
        monkeypatch,
        ledger,
        [
            [{"name": "remember_fact", "args": {"key": "editor", "content": "vim을 쓴다"}}],
            "기억했습니다.",
        ],
    )

    narrate("chat :: remember_fact가 저장소로 써지고 memory_updated 신호도 남는다", result)
    # 저장소가 기준 테이블에 직접 써 넣었고, 워커가 memory_updated를 흘리도록 기억 쓰기도 그대로 남는다.
    assert ledger.puts == [("editor", "vim을 쓴다")]
    data = result.data or {}
    assert data["memoryWrites"] == [{"key": "editor", "content": "vim을 쓴다"}]


async def test_recall_facts는_저장소의_기준_사실을_되읽는다(monkeypatch: pytest.MonkeyPatch) -> None:
    ledger = _FakeLedger(seed={"lang": "한국어를 쓴다"})
    result, _chat = await _run_memory(
        monkeypatch,
        ledger,
        [
            [{"name": "recall_facts", "args": {}}],
            "기억하고 있는 사실을 확인했습니다.",
        ],
    )

    narrate("chat :: recall_facts가 저장소의 기준 사실을 되읽는다", result)
    # 프롬프트 주입과 recall_facts가 봉투가 아니라 저장소를 통해 기준 데이터를 읽는다.
    assert ledger.searches >= 1
    assert (result.data or {})["assistantText"] != ""


async def test_DB에서_복원한_지난_이력_위에서_턴을_잇는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = _FakeLedger()
    result, chat = await _run_memory(
        monkeypatch,
        ledger,
        ["예전에 만든 task-1 이야기입니다."],
        messages=[
            {"role": "user", "content": "task-1 만들어줘"},
            {"role": "assistant", "content": "task-1을 만들었습니다."},
            {"role": "user", "content": "그거 뭐였지?"},
        ],
    )

    narrate("chat :: DB에서 복원한 지난 이력 위에서 이번 턴을 잇는다", result)
    seen = " ".join(
        str(getattr(message, "content", message)) for request in chat.requests for message in request
    )
    # DB에서 복원한 지난 이력이 이번 턴 모델 입력에 전부 보인다.
    assert "task-1 만들어줘" in seen
    assert "task-1을 만들었습니다." in seen
    assert "그거 뭐였지?" in seen
