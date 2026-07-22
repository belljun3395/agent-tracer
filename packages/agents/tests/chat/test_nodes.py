"""chat 대화 노드를 그래프 밖에서 스트리밍 실행해 delta와 최종 result 계약을 검증한다."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from langchain_core.messages import AIMessage, ToolMessage

from agent_graph.agents.chat import agent as chat_mod
from agent_graph.agents.chat.models import ChatHistoryMessage, ChatStreamRequest
from agent_graph.agents.chat.nodes.converse import _final_text, _replay
from tests.support.fakes import FakeToolLoopChat


def _request(**overrides: Any) -> ChatStreamRequest:
    values: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "apiKey": "sk-test",
        "threadId": "thread-1",
        "executionId": "execution-1",
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


def test_저장된_도구_호출과_결과를_langchain_메시지로_되살린다() -> None:
    history = [
        ChatHistoryMessage.model_validate(
            {
                "role": "assistant",
                "content": "아카이브를 제안했습니다",
                "toolCalls": [{"id": "call-1", "name": "archive_task", "args": {"taskId": "task-1"}}],
            }
        ),
        ChatHistoryMessage.model_validate(
            {"role": "tool", "content": "승인되어 완료됨", "toolCallId": "call-1"}
        ),
    ]

    replayed = _replay(history)

    assert isinstance(replayed[0], AIMessage)
    assert replayed[0].tool_calls == [
        {"id": "call-1", "name": "archive_task", "args": {"taskId": "task-1"}, "type": "tool_call"}
    ]
    assert isinstance(replayed[1], ToolMessage)
    assert replayed[1].tool_call_id == "call-1"


def test_최종_답변은_도구_호출이_없는_마지막_어시스턴트_텍스트다() -> None:
    messages = [
        AIMessage(
            content="확인해볼게요",
            tool_calls=[{"id": "call-1", "name": "search_tasks", "args": {}, "type": "tool_call"}],
        ),
        ToolMessage(content="검색 결과", tool_call_id="call-1"),
        AIMessage(content="최종 답변"),
    ]

    assert _final_text(messages) == "최종 답변"
