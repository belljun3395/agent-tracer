"""LangGraph 그래프 배선 검증(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import httpx
import pytest
from anthropic import AuthenticationError

from agent_graph.agents.recipe_scan import agent as recipe_mod
from agent_graph.agents.recipe_scan.models import (
    DispatchPlan,  # noqa: F401
    RecipeScanRequest,
)
from agent_graph.agents.runtime.execution.runner import execute
from tests.fakes import FakeLedger, FakeSearch, FakeToolLoopChat

# 워커가 제공하는 도구 콜백 창구다.
_TOOLS: dict[str, object] = {
    "tools": [
        {
            "name": "get_task_summary",
            "description": "Get the task summary.",
            "parameters": {"type": "object", "properties": {"taskId": {"type": "string"}}, "required": ["taskId"]},
        },
        {
            "name": "list_rules",
            "description": "List applicable rules.",
            "parameters": {"type": "object", "properties": {"taskId": {"type": "string"}}, "required": ["taskId"]},
        },
    ],
    "completionCallback": {"url": "http://worker:8810/runs/complete", "token": "done-1"},
}

def _event_row(event_id: str, turn_id: str, title: str) -> dict[str, object]:
    return {
        "id": event_id,
        "seq": 1,
        "turn_id": turn_id,
        "kind": "execute_tool",
        "title": title,
        "body": None,
        "tool_name": None,
        "file_paths": [],
        "metadata": {},
        "occurred_at": datetime(2026, 7, 14, tzinfo=UTC),
    }


def _recipe() -> dict[str, object]:
    return {
        "title": "Add migration",
        "intent": "마이그레이션",
        "description": "설명",
        "summary_md": "- a",
        "request": "사용자가 마이그레이션 작업을 recipe로 만들라고 했다.",
        "corrections": [],
        "pitfalls": [],
        "governing_rules": ["rule-1"],
        "contributing_slices": [{"taskId": "t1", "turnIds": ["turn-1"], "eventIds": ["event-1"]}],
        "rationale": "근거",
    }


class TestRecipeScanGraph:
    @staticmethod
    def _ledger() -> FakeLedger:
        return FakeLedger(
            [
                _event_row("event-1", "turn-1", "마이그레이션"),
                _event_row("event-2", "turn-2", "대시보드"),
            ],
            rules=[
                {
                    "id": "rule-1",
                    "name": "규칙",
                    "expectation": {"kind": "action", "tool": "Bash"},
                    "task_id": "t1",
                    "anchor_event_id": "event-1",
                    "source": "agent",
                    "severity": "info",
                    "rationale": None,
                    "signature": "sig-1",
                    "created_at": datetime(2026, 7, 14, tzinfo=UTC),
                }
            ],
        )

    @staticmethod
    def _request() -> RecipeScanRequest:
        return RecipeScanRequest(
            model="claude-sonnet-4-6",
            apiKey="sk-test",
            taskId="t1",
            language="ko",
            userId="user-1",
            completionCallback=_TOOLS["completionCallback"],  # type: ignore[arg-type]
        )

    async def _run(self, chat: FakeToolLoopChat, ledger: FakeLedger | None = None) -> object:
        req = self._request()
        reader = ledger or self._ledger()
        return await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda usage: recipe_mod.run_recipe_scan(req, reader, FakeSearch(), usage),  # type: ignore[arg-type]
        )

    async def test_모델이_스스로_도구를_골라_근거를_모으고_후보를_낸다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        chat = FakeToolLoopChat([
            [
                {"name": "get_task_summary", "args": {"taskId": "t1"}},
                {"name": "list_rules", "args": {"taskId": "t1"}},
            ],
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe()]},
        ])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        ledger = self._ledger()

        res = await self._run(chat, ledger)

        assert res.error is None
        assert res.data is not None and res.data["recipes"][0]["title"] == "Add migration"
        assert [step.toolName for step in res.steps if step.role == "tool"] == [
            "get_task_summary",
            "list_rules",
            "get_task_events",
        ]

    async def test_도구를_한_번도_부르지_않아도_빈_결과로_끝난다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        chat = FakeToolLoopChat([{"recipes": []}])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        ledger = self._ledger()

        res = await self._run(chat, ledger)

        assert res.error is None and res.data == {"recipes": []}
        # 도구를 부르지 않았으니 원장을 한 번도 조회하지 않는다.
        assert ledger.queries == []

    async def test_도구가_돌려주지_않은_ID는_한_번_수정한_뒤_검증한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        invalid = {**_recipe(), "governing_rules": ["invented-rule"]}
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [invalid]},
            {"recipes": [_recipe()]},
        ])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is None and res.data is not None
        assert res.data["recipes"][0]["governing_rules"] == ["rule-1"]
        failures = [step for step in res.steps if step.eventKind == "validation.failed"]
        assert len(failures) == 1 and "invented-rule" in failures[0].content
        assert sum(step.nodeName == "repair" and step.eventKind == "node.started" for step in res.steps) == 1

    async def test_수정_후에도_ID가_거짓이면_후보를_버린다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        invalid = {
            **_recipe(),
            "contributing_slices": [{"taskId": "t1", "turnIds": [], "eventIds": ["ghost"]}],
        }
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"recipes": [invalid]},
            {"recipes": [invalid]},
        ])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is None and res.data == {"recipes": []}
        assert sum(step.eventKind == "validation.failed" for step in res.steps) == 2

    async def test_서로_다른_turn은_각각의_후보로_남는다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        second = {
            **_recipe(),
            "title": "Add dashboard",
            "contributing_slices": [{"taskId": "t1", "turnIds": ["turn-2"], "eventIds": ["event-2"]}],
        }
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe(), second]},
        ])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is None and res.data is not None
        assert [recipe["title"] for recipe in res.data["recipes"]] == ["Add migration", "Add dashboard"]

    async def test_같은_turn을_두_후보가_주장하면_수정을_요구한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        duplicate = {**_recipe(), "title": "Add dashboard"}
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe(), duplicate]},
            {"recipes": [_recipe()]},
        ])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is None and res.data is not None
        assert [recipe["title"] for recipe in res.data["recipes"]] == ["Add migration"]
        failures = [step for step in res.steps if step.eventKind == "validation.failed"]
        assert len(failures) == 1 and "turn-1" in failures[0].content

    async def test_모델_호출_실패는_완료가_아니라_노드_실패로_기록한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        class FailingChat(FakeToolLoopChat):
            async def ainvoke(self, messages: list[object]) -> object:
                raise AuthenticationError(
                    "bad key",
                    response=httpx.Response(
                        401, request=httpx.Request("POST", "https://api.anthropic.com")
                    ),
                    body=None,
                )

        chat = FailingChat([])
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is not None
        events = [step.eventKind for step in res.steps if step.nodeName == "investigate"]
        assert events == ["node.started", "node.failed"]


    async def test_조율자가_세운_계획이_조사_지시문과_라운드에_반영된다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        plan = DispatchPlan(
            probes=[{"probe": "rules", "rounds": 3, "question": "어떤 규칙이 걸렸나"}]  # type: ignore[list-item]
        )
        chat = FakeToolLoopChat([{"recipes": []}], plan=plan)
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)

        res = await self._run(chat)

        assert res.error is None
        sent = " ".join(str(getattr(message, "content", message)) for message in chat.requests[0])
        # 계획이 조사 지시문으로 펴지고 배분한 라운드가 그대로 예산이 된다.
        assert "rules (3 rounds): 어떤 규칙이 걸렸나" in sent
        assert "3 of 3 tool-calling rounds remain" in sent
        assert any("survey -> rules:3" in step.content for step in res.steps)

class TestExecuteWrapper:
    async def test_데드라인_초과를_deadline_exceeded로_잡는다(self) -> None:
        async def slow(_usage: object) -> dict[str, object]:
            await asyncio.sleep(5)
            return {}

        res = await execute("slow", "claude-haiku-4-5", 20, slow)
        assert res.error is not None and res.error.subtype == "deadline_exceeded"

    async def test_API_오류의_type을_그대로_노출한다(self) -> None:
        async def boom(_usage: object) -> dict[str, object]:
            response = httpx.Response(401, request=httpx.Request("POST", "https://api.anthropic.com"))
            raise AuthenticationError("nope", response=response, body={"error": {"type": "authentication_error"}})

        res = await execute("auth", "claude-haiku-4-5", 5000, boom)
        assert res.error is not None and res.error.subtype == "authentication_error"

