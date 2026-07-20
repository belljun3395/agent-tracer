"""도구 예산을 다 쓴 실행이 결론을 내고 끝나는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import HumanMessage

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.runtime.llm.standard_agent import FINALIZE_DIRECTIVE
from agent_graph.agents.task_cleanup import agent as cleanup_mod
from agent_graph.agents.task_cleanup.models import TaskCleanupRequest, TriagePlan
from agent_graph.agents.task_cleanup.policy import MAX_TOOL_ROUNDS, decision_rounds
from tests.support.fakes import FakeLedger, mk_ai

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-1"}

# 호출 하나가 sonnet 단가로 약 $0.21이라 세 번째 호출은 $0.50 상한 안에 들어갈 수 없다.
_EXPENSIVE_USAGE = {
    "input_tokens": 10_000,
    "output_tokens": 12_000,
    "total_tokens": 22_000,
    "input_token_details": {"cache_read": 0, "cache_creation": 0},
}

_DRAFT = {
    "suggestions": [
        {
            "kind": "archive",
            "taskId": "task-1",
            "rationale": "의미 있는 활동이 없다",
            "evidenceEventIds": [],
        }
    ]
}


class GreedyChat:
    """예산을 안 보고 계속 도구만 부르다가 결론 요구를 받으면 그때 출력하는 모델이다."""

    def __init__(self, usage: dict[str, Any] | None = None) -> None:
        self.bound_tools: list[Any] = []
        self.tools_per_call: list[list[str]] = []
        self.notices: list[str] = []
        self.usage = usage

    def bind_tools(self, tools: list[Any], **_kwargs: Any) -> GreedyChat:
        self.bound_tools = tools
        return self

    def bind(self, **_kwargs: Any) -> GreedyChat:
        return self

    def with_structured_output(self, _schema: Any, **_kwargs: Any) -> Any:
        return self

    async def ainvoke(self, messages: list[Any]) -> Any:
        names = [getattr(tool, "name", "") for tool in self.bound_tools]
        # 선별 단계는 이 테스트의 대상이 아니므로 아무것도 열어보지 않는 계획으로 통과시킨다.
        if "TriagePlan" in names:
            return mk_ai(
                tool_calls=[
                    {
                        "name": "TriagePlan",
                        "args": {"inspect": []},
                        "id": "call-triage",
                        "type": "tool_call",
                    }
                ]
            )
        self.tools_per_call.append(names)
        directives = [
            message.content
            for message in messages
            if isinstance(message, HumanMessage) and isinstance(message.content, str)
        ]
        self.notices.append(directives[-1])
        if FINALIZE_DIRECTIVE in directives[-1]:
            return mk_ai(
                tool_calls=[{"name": "CleanupDraft", "args": _DRAFT, "id": "call-out", "type": "tool_call"}],
                usage=self.usage,
            )
        return mk_ai(
            tool_calls=[
                {
                    "name": "list_candidate_tasks",
                    "args": {},
                    "id": f"call-{len(self.tools_per_call)}",
                    "type": "tool_call",
                }
            ],
            usage=self.usage,
        )


_CANDIDATE = {
    "id": "task-1",
    "visibleTitle": "제목",
    "status": "running",
    "lastEventAt": None,
    "hasEvents": False,
    "activeChildCount": 0,
    "candidateReasons": ["stale"],
}


def _request() -> TaskCleanupRequest:
    return TaskCleanupRequest(
        model="claude-sonnet-4-6",
        apiKey="sk-test",
        scannedAt="2026-07-14T00:00:00Z",
        userId="user-1",
        maxSuggestions=5,
        language="ko",
        batch={"candidates": [_CANDIDATE], "batchTruncated": False},  # type: ignore[arg-type]
        completionCallback=_COMPLETION,  # type: ignore[arg-type]
    )


async def _run(_chat: GreedyChat, ledger: FakeLedger) -> Any:
    req = _request()
    return await execute(
        "task-cleanup",
        req.model,
        req.deadlineMs,
        lambda usage: cleanup_mod.run_task_cleanup(req, ledger, usage),  # type: ignore[arg-type]
    )


async def test_예산을_다_써도_모은_근거로_결론을_낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = GreedyChat()
    ledger = FakeLedger()
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger)

    assert res.error is None
    assert res.data["suggestions"] == _DRAFT["suggestions"]


async def test_남은_라운드를_매_턴_알려준다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = GreedyChat()
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    await _run(chat, FakeLedger())

    # 선별에 쓰고 남은 라운드가 조율자의 예산이며 매 턴 잔량이 통지된다.
    total = decision_rounds(TriagePlan(inspect=[]))
    assert f"{total} of {total}" in chat.notices[0]
    assert f"{total - 1} of {total}" in chat.notices[1]


async def test_비용_상한에_닿기_전에_결론을_받아낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = GreedyChat(usage=_EXPENSIVE_USAGE)
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, FakeLedger())

    assert res.error is None
    assert res.data["suggestions"] == _DRAFT["suggestions"]
    assert len(chat.notices) < MAX_TOOL_ROUNDS
    assert FINALIZE_DIRECTIVE in chat.notices[-1]


async def test_마지막_라운드에는_조사_도구를_거두고_출력만_남긴다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat = GreedyChat()
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    await _run(chat, FakeLedger())

    assert "list_candidate_tasks" in chat.tools_per_call[0]
    assert chat.tools_per_call[-1] == ["CleanupDraft"]
    assert FINALIZE_DIRECTIVE in chat.notices[-1]
