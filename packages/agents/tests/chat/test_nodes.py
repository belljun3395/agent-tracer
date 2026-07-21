"""chat 대화 노드를 그래프 밖에서 스트리밍 실행해 delta와 최종 result 계약을 검증한다."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from agent_graph.agents.chat import agent as chat_mod
from agent_graph.agents.chat.models import ChatStreamRequest
from tests.support.fakes import FakeToolLoopChat


def _request(**overrides: Any) -> ChatStreamRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "threadId": "thread-1",
        "userId": "user-1",
        "language": "ko",
        "messages": [{"role": "user", "content": "task-1 아카이브해줘"}],
    }
    values.update(overrides)
    return ChatStreamRequest.model_validate(values)


async def _stream(
    monkeypatch: pytest.MonkeyPatch, turns: list[Any], **overrides: Any
) -> list[dict[str, Any]]:
    chat = FakeToolLoopChat(turns)
    monkeypatch.setattr(chat_mod, "make_chat", lambda *_args, **_kwargs: chat)
    req = _request(**overrides)
    lines: list[dict[str, Any]] = []
    async with httpx.AsyncClient() as client:
        async for raw in chat_mod.stream_chat(req, client, None):
            lines.extend(json.loads(piece) for piece in raw.decode().splitlines() if piece)
    return lines


async def test_토큰_delta를_순서대로_흘리고_마지막에_최종_result를_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lines = await _stream(monkeypatch, ["정리했습니다"])

    assert lines[-1]["type"] == "result"
    deltas = [line["text"] for line in lines if line["type"] == "delta"]
    assert deltas, "어시스턴트 텍스트 delta가 최소 한 줄은 나와야 한다"
    result = lines[-1]
    data = result["data"]
    assert "".join(deltas) == data["assistantText"]
    assert data["assistantText"] != ""
    assert data["proposedWrites"] == []
    # 최종 result는 비용 환산에 쓸 사용량과 모델 식별자를 함께 싣는다.
    assert result["modelUsed"] == "claude-haiku-4-5"
    assert result["usage"]["outputTokens"] > 0


async def test_스트리밍_결과가_제안_쓰기를_실행_없이_담아_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lines = await _stream(
        monkeypatch,
        [
            [{"name": "archive_task", "args": {"taskId": "task-1"}}],
            "task-1 아카이브를 제안했고 승인을 기다립니다.",
        ],
    )

    result = lines[-1]
    assert result["type"] == "result"
    data = result["data"]
    assert data["proposedWrites"] == [{"toolName": "archive_task", "args": {"taskId": "task-1"}}]
    assert data["memoryWrites"] == []
    assert data["assistantText"] != ""
