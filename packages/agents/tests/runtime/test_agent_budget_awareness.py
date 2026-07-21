"""도구 예산을 다 쓴 실행이 결론을 내고 끝나는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import HumanMessage

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.runtime.llm.standard_agent import FINALIZE_DIRECTIVE
from agent_graph.agents.task_cleanup import agent as cleanup_mod
from agent_graph.agents.task_cleanup.models import TaskCleanupRequest
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
    """예산을 안 보고 계속 도구만 부르다가 결론 요구를 받으면 그때 출력하는 검토자 모델이다."""

    def __init__(self, usage: dict[str, Any] | None = None) -> None:
        self.bound_tools: list[Any] = []
        self.tools_per_call: list[list[str]] = []
        self.notices: list[str] = []
        self.usage = usage
        self._triage_listed = False

    def bind_tools(self, tools: list[Any], **_kwargs: Any) -> GreedyChat:
        self.bound_tools = tools
        return self

    def bind(self, **_kwargs: Any) -> GreedyChat:
        return self

    def with_structured_output(self, _schema: Any, **_kwargs: Any) -> Any:
        return self

    async def ainvoke(self, messages: list[Any]) -> Any:
        names = [getattr(tool, "name", "") for tool in self.bound_tools]
        # 선별자는 후보를 한 번 훑고 검토자에게 후보 하나를 배정한다.
        if "TriagePlan" in names:
            if not self._triage_listed:
                self._triage_listed = True
                return mk_ai(
                    tool_calls=[
                        {"name": "list_candidate_tasks", "args": {}, "id": "call-list", "type": "tool_call"}
                    ]
                )
            return mk_ai(
                tool_calls=[
                    {
                        "name": "TriagePlan",
                        "args": {"inspect": [{"taskId": "task-1", "weight": 1}]},
                        "id": "call-triage",
                        "type": "tool_call",
                    }
                ]
            )
        # 조율자는 도구가 없으니 검토자 보고만 보고 곧바로 초안을 낸다.
        if "CleanupDraft" in names:
            return mk_ai(
                tool_calls=[{"name": "CleanupDraft", "args": _DRAFT, "id": "call-out", "type": "tool_call"}]
            )
        # 검토자는 예산을 안 보고 계속 이벤트만 읽다가 결론 요구를 받으면 그때 판정을 올린다.
        self.tools_per_call.append(names)
        directives = [
            message.content
            for message in messages
            if isinstance(message, HumanMessage) and isinstance(message.content, str)
        ]
        self.notices.append(directives[-1])
        if FINALIZE_DIRECTIVE in directives[-1]:
            return mk_ai(
                tool_calls=[
                    {
                        "name": "InspectReport",
                        "args": {
                            "taskId": "task-1",
                            "archivable": True,
                            "reason": "의미 있는 활동이 없다",
                            "citedEventIds": [],
                        },
                        "id": "call-report",
                        "type": "tool_call",
                    }
                ],
                usage=self.usage,
            )
        return mk_ai(
            tool_calls=[
                {
                    "name": "get_task_events",
                    "args": {"taskId": "task-1"},
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
    chat = GreedyChat(usage=_EXPENSIVE_USAGE)
    ledger = FakeLedger()
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger)

    assert res.error is None
    assert res.data["suggestions"] == _DRAFT["suggestions"]


async def test_턴_사용량을_매_턴_알려준다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = GreedyChat()
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    await _run(chat, FakeLedger())

    # 실제 종료 게이트는 달러지만 모델의 self-pacing 신호는 턴 단위로 매 턴 갱신된다.
    assert "used 0 of" in chat.notices[0] and "tool-calling turns" in chat.notices[0]
    assert "used 1 of" in chat.notices[1]


async def test_비용_상한에_닿기_전에_결론을_받아낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = GreedyChat(usage=_EXPENSIVE_USAGE)
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, FakeLedger())

    assert res.error is None
    assert res.data["suggestions"] == _DRAFT["suggestions"]
    assert len(chat.notices) < 5
    assert FINALIZE_DIRECTIVE in chat.notices[-1]


async def test_예산이_바닥나면_조사_도구를_거두고_출력만_남긴다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat = GreedyChat(usage=_EXPENSIVE_USAGE)
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    await _run(chat, FakeLedger())

    assert "get_task_events" in chat.tools_per_call[0]
    assert chat.tools_per_call[-1] == ["InspectReport"]
    assert FINALIZE_DIRECTIVE in chat.notices[-1]
