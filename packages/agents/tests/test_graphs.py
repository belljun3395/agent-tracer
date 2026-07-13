"""LangGraph 그래프 배선 검증(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from anthropic import AuthenticationError

from agent_graph.agents.recipe_scan import agent as recipe_mod
from agent_graph.agents.recipe_scan.models import RecipeScanRequest
from agent_graph.agents.runtime.execution.runner import execute
from tests.fakes import FakeStructuredChat, FakeToolClient

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
        "contributing_slices": [{"taskId": "t1", "eventIds": ["event-1"]}],
        "rationale": "근거",
    }


class TestRecipeScanGraph:
    @staticmethod
    def _client() -> FakeToolClient:
        return FakeToolClient(
            {
                "get_task_summary": {"id": "t1", "title": "x", "eventCount": 3},
                "list_rules": [{"id": "rule-1"}],
                "get_task_events": {
                    "events": [{"id": "event-1", "title": "done"}],
                    "truncated": False,
                    "total": 1,
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
        )

    async def test_명시적_그래프가_근거를_모아_후보를_검증한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        chat = FakeStructuredChat(
            [
                {"rationale": "초기 근거면 충분하다", "queries": []},
                {"sufficient": True, "reason": "검증된 작업 흐름이 있다", "missingEvidence": []},
                {"recipe": _recipe()},
            ]
        )
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        client = self._client()
        req = self._request()

        res = await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda u: recipe_mod.run_recipe_scan(req, client, u),
        )

        assert res.error is None
        assert client.calls[:3] == ["get_task_summary", "list_rules", "get_task_events"]
        assert client.tokens == ["tok-1", "tok-1", "tok-1"]
        assert res.data is not None and res.data["recipes"][0]["title"] == "Add migration"
        assert [step.toolName for step in res.steps if step.role == "tool"][:3] == [
            "get_task_summary",
            "list_rules",
            "get_task_events",
        ]
        graph_steps = [step for step in res.steps if step.role == "graph"]
        assert any(step.eventKind == "route.selected" for step in graph_steps)
        assert any(step.nodeName == "validate_candidate" for step in graph_steps)
        assert all(step.content and "sk-test" not in step.content and "tok-1" not in step.content for step in graph_steps)

    async def test_근거가_부족하면_두_라운드까지만_수집하고_빈_결과를_낸다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        query = {
            "tool": "search_events",
            "args": {"q": "correction", "taskId": "t1"},
            "purpose": "사용자 교정 찾기",
        }
        chat = FakeStructuredChat(
            [
                {"rationale": "교정을 찾는다", "queries": [query]},
                {"sufficient": False, "reason": "검증이 부족하다", "missingEvidence": ["완료 증거"]},
                {"rationale": "한 번 더 찾는다", "queries": [query]},
                {"sufficient": False, "reason": "여전히 부족하다", "missingEvidence": ["완료 증거"]},
            ]
        )
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        client = self._client()
        req = self._request()

        res = await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda u: recipe_mod.run_recipe_scan(req, client, u),
        )

        assert res.error is None and res.data == {"recipes": []}
        assert client.calls.count("search_events") == 2
        routes = [step.content for step in res.steps if step.eventKind == "route.selected"]
        assert any("plan_evidence" in content for content in routes)
        assert any("empty" in content for content in routes)

    async def test_지원하지_않는_ID는_한_번만_수정한_뒤_검증한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        invalid = {**_recipe(), "governing_rules": ["invented-rule"]}
        chat = FakeStructuredChat(
            [
                {"rationale": "충분하다", "queries": []},
                {"sufficient": True, "reason": "완료 근거가 있다", "missingEvidence": []},
                {"recipe": invalid},
                {"recipe": _recipe()},
            ]
        )
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        req = self._request()

        res = await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda u: recipe_mod.run_recipe_scan(req, self._client(), u),
        )

        assert res.error is None and res.data is not None
        assert res.data["recipes"][0]["governing_rules"] == ["rule-1"]
        failures = [step for step in res.steps if step.eventKind == "validation.failed"]
        assert len(failures) == 1 and "invented-rule" in failures[0].content
        assert sum(step.nodeName == "repair" and step.eventKind == "node.started" for step in res.steps) == 1

    async def test_수정_후에도_ID가_거짓이면_후보를_버린다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        invalid = {**_recipe(), "contributing_slices": [{"taskId": "t1", "eventIds": ["ghost"]}]}
        chat = FakeStructuredChat(
            [
                {"rationale": "충분하다", "queries": []},
                {"sufficient": True, "reason": "완료 근거가 있다", "missingEvidence": []},
                {"recipe": invalid},
                {"recipe": invalid},
            ]
        )
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
        req = self._request()

        res = await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda u: recipe_mod.run_recipe_scan(req, self._client(), u),
        )

        assert res.error is None and res.data == {"recipes": []}
        assert sum(step.eventKind == "validation.failed" for step in res.steps) == 2
        assert sum(step.nodeName == "repair" and step.eventKind == "node.started" for step in res.steps) == 1

    async def test_노드_예외는_완료가_아니라_실패로_기록한다(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: FakeStructuredChat([]))
        req = self._request()

        res = await execute(
            "recipe-scan",
            req.model,
            req.deadlineMs,
            lambda u: recipe_mod.run_recipe_scan(req, self._client(), u),
        )

        assert res.error is not None
        plan_events = [step.eventKind for step in res.steps if step.nodeName == "plan_evidence"]
        assert plan_events == ["node.started", "node.failed"]


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
