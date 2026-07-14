"""HTTP 계약 검증. 페이크 모델을 그래프 모듈에 주입한다."""

from __future__ import annotations

from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from agent_graph import app as app_module
from agent_graph.agents.recipe_scan import agent as recipe_mod
from agent_graph.agents.title_suggestion import agent as title_mod
from tests.fakes import FakeStructuredChat, FakeToolClient
from tests.test_observability import SHARED_SPAN_EXPORTER

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

_TITLE_CONTEXT: dict[str, object] = {
    "title": "Untitled",
    "status": "completed",
    "workspacePath": "/workspace/project",
    "totalEventCount": 2,
    "totalTurnCount": 1,
    "truncated": False,
    "turns": [
        {
            "turnIndex": 1,
            "askedText": "인증 토큰 누수를 고쳐줘",
            "assistantText": "누수를 수정하고 회귀 테스트를 추가했습니다.",
        }
    ],
}


class CapturingCompletionClient:
    """워커의 완료 창구를 대신해 전달된 결과를 붙잡아 둔다."""

    def __init__(self) -> None:
        self.deliveries: list[dict[str, Any]] = []

    async def post(self, url: str, json: dict[str, Any]) -> httpx.Response:
        self.deliveries.append({"url": url, **json})
        return httpx.Response(200, request=httpx.Request("POST", url))

    async def aclose(self) -> None:
        return None

    def response(self) -> dict[str, Any]:
        assert len(self.deliveries) == 1
        return self.deliveries[0]["response"]


def _title_body(*, api_key: bool = True) -> dict[str, object]:
    body: dict[str, object] = {
        "model": "claude-haiku-4-5",
        "taskId": "task-1",
        "language": "ko",
        "context": _TITLE_CONTEXT,
        "toolCallback": _TOOLS["toolCallback"],
        "completionCallback": _TOOLS["completionCallback"],
    }
    if api_key:
        body["apiKey"] = "sk-test"
    return body


@pytest.fixture
def client() -> TestClient:
    return TestClient(app_module.app)


@pytest.fixture
def completions() -> CapturingCompletionClient:
    return CapturingCompletionClient()


def _post(
    client: TestClient,
    completions: CapturingCompletionClient,
    path: str,
    body: dict[str, object],
    *,
    tools: object | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    with client:
        original_tools = app_module.app.state.tool_client
        app_module.app.state.completion_client = completions
        if tools is not None:
            app_module.app.state.tool_client = tools
        try:
            return client.post(path, json=body, headers=headers or {})
        finally:
            app_module.app.state.tool_client = original_tools


def test_health_ok(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_실행을_접수하고_결과는_완료_창구로_돌려준다(
    client: TestClient, completions: CapturingCompletionClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        title_mod,
        "make_chat",
        lambda *a, **k: FakeStructuredChat(
            [
                {"action": "suggest", "reason": "대화 발췌가 충분하다."},
                {
                    "suggestions": [
                        {"title": "인증 토큰 누수 수정", "rationale": "누수 수정이 핵심이다."},
                        {"title": "인증 회귀 테스트 추가", "rationale": "회귀 검증을 추가했다."},
                    ]
                },
            ]
        ),
    )

    res = _post(client, completions, "/agents/title-suggestion", _title_body())

    assert res.status_code == 202
    assert res.json()["status"] == "accepted"
    assert completions.deliveries[0]["token"] == "done-1"
    payload = completions.response()
    assert payload["error"] is None
    assert payload["data"]["suggestions"][0]["title"] == "인증 토큰 누수 수정"
    assert payload["modelUsed"] == "claude-haiku-4-5"


def test_recipe_scan_엔드포인트가_도메인_봉투를_받는다(
    client: TestClient, completions: CapturingCompletionClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        recipe_mod,
        "make_chat",
        lambda *a, **k: FakeStructuredChat(
            [
                {"rationale": "더 읽을 필요가 없다", "queries": []},
                {"sufficient": False, "reason": "완료 근거가 없다", "missingEvidence": []},
                {"rationale": "추가 근거도 없다", "queries": []},
                {"sufficient": False, "reason": "여전히 근거가 없다", "missingEvidence": []},
            ]
        ),
    )
    body = {
        "model": "claude-sonnet-4-6",
        "apiKey": "sk-test",
        "taskId": "t1",
        "language": "ko",
        "toolCallback": _TOOLS["toolCallback"],
        "completionCallback": _TOOLS["completionCallback"],
    }
    tools = FakeToolClient(
        {
            "get_task_summary": {"id": "t1", "title": "x"},
            "list_rules": [],
            "get_task_events": {"events": [], "truncated": False, "total": 0},
        }
    )

    res = _post(client, completions, "/agents/recipe-scan", body, tools=tools)

    assert res.status_code == 202
    payload = completions.response()
    assert payload["error"] is None
    assert payload["data"] == {"recipes": []}


def test_잘못된_요청은_422(client: TestClient) -> None:
    with client:
        res = client.post("/agents/title-suggestion", json={"model": "x"})
    assert res.status_code == 422


def test_apiKey가_없으면_422(client: TestClient) -> None:
    # env 폴백 없이 요청 본문의 apiKey를 강제한다.
    with client:
        res = client.post("/agents/title-suggestion", json=_title_body(api_key=False))
    assert res.status_code == 422


def test_완료_창구가_없으면_422(client: TestClient) -> None:
    body = {key: value for key, value in _title_body().items() if key != "completionCallback"}
    with client:
        res = client.post("/agents/title-suggestion", json=body)
    assert res.status_code == 422


def test_등록되지_않은_runId_취소는_cancelled_false(client: TestClient) -> None:
    with client:
        res = client.post("/agents/runs/no-such-run/cancel")
    assert res.status_code == 200
    assert res.json() == {"cancelled": False}


def test_worker가_보낸_traceparent를_이어받아_같은_trace로_invoke_agent_스팬을_만든다(
    client: TestClient, completions: CapturingCompletionClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        title_mod,
        "make_chat",
        lambda *a, **k: FakeStructuredChat([{"action": "keep", "reason": "현재 제목을 유지한다."}]),
    )
    SHARED_SPAN_EXPORTER.clear()

    trace_id_hex = "4bf92f3577b34da6a3ce929d0e0e4736"
    res = _post(
        client,
        completions,
        "/agents/title-suggestion",
        {**_title_body(), "context": {**_TITLE_CONTEXT, "title": "인증 토큰 누수 수정"}},
        headers={"traceparent": f"00-{trace_id_hex}-00f067aa0ba902b7-01"},
    )

    assert res.status_code == 202
    invoke_spans = [s for s in SHARED_SPAN_EXPORTER.get_finished_spans() if s.name.startswith("invoke_agent")]
    assert invoke_spans
    assert format(invoke_spans[-1].context.trace_id, "032x") == trace_id_hex
