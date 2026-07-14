"""LangGraph 그래프 배선 검증(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from anthropic import AuthenticationError

from agent_graph.agents.recipe_scan import agent as recipe_mod
from agent_graph.agents.recipe_scan.models import RecipeScanRequest
from agent_graph.agents.runtime.execution.runner import execute
from tests.fakes import FakeToolClient, FakeToolLoopChat

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
    "toolCallback": {"url": "http://worker:8810/tools/invoke", "token": "tok-1"},
    "completionCallback": {"url": "http://worker:8810/runs/complete", "token": "done-1"},
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
    def _client() -> FakeToolClient:
        return FakeToolClient(
            {
                "get_task_summary": {"id": "t1", "title": "x", "eventCount": 2},
                "list_rules": [{"id": "rule-1"}],
                "get_task_events": {
                    "events": [
                        {"id": "event-1", "turnId": "turn-1", "title": "마이그레이션"},
                        {"id": "event-2", "turnId": "turn-2", "title": "대시보드"},
                    ],
                    "truncated": False,
                    "total": 2,
                },
                "search_events": {"events": [], "truncated": False, "total": 0},
            }
        )

    @staticmethod
    def _request() -> RecipeScanRequest:
        return RecipeScanRequest(
            model="claude-sonnet-4-6",
            apiKey="sk-test",
            taskId="t1",
            language="ko",
            toolCallback=_TOOLS["toolCallback"],  # type: ignore[arg-type]
            completionCallback=_TOOLS["completionCallback"],  # type: ignore[arg-type]
        )

    async def _run(self, chat: FakeToolLoopChat, client: FakeToolClient | None = None) -> object:
        req = self._request()
        tools = client or self._client()
        return await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda usage: recipe_mod.run_recipe_scan(req, tools, usage),  # type: ignore[arg-type]
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
        client = self._client()

        res = await self._run(chat, client)

        assert res.error is None
        assert client.calls == ["get_task_summary", "list_rules", "get_task_events"]
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
        client = self._client()

        res = await self._run(chat, client)

        assert res.error is None and res.data == {"recipes": []}
        assert client.calls == []

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
