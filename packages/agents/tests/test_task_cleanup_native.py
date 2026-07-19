"""task-cleanup 도구 루프와 결정적 검증을 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.task_cleanup import agent as cleanup_mod
from agent_graph.agents.task_cleanup.graph import TASK_CLEANUP_GRAPH
from agent_graph.agents.task_cleanup.models import TaskCleanupRequest
from tests.fakes import FakeLedger, FakeToolLoopChat

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-1"}


def _request(*candidates: dict[str, object]) -> TaskCleanupRequest:
    return TaskCleanupRequest(
        model="claude-sonnet-4-6",
        apiKey="sk-test",
        scannedAt="2026-07-14T00:00:00Z",
        userId="user-1",
        maxSuggestions=5,
        language="ko",
        batch={"candidates": list(candidates), "batchTruncated": False},  # type: ignore[arg-type]
        completionCallback=_COMPLETION,  # type: ignore[arg-type]
    )


def _candidate(task_id: str, *, has_events: bool) -> dict[str, object]:
    return {
        "id": task_id,
        "visibleTitle": f"제목 {task_id}",
        "status": "running",
        "lastEventAt": None,
        "hasEvents": has_events,
        "activeChildCount": 0,
        "candidateReasons": ["stale"],
    }


def _event_rows(*event_ids: str) -> list[dict[str, Any]]:
    return [
        {
            "id": event_id,
            "seq": 1,
            "kind": "execute_tool",
            "title": "무의미한 활동",
            "body": None,
            "tool_name": None,
            "file_paths": [],
            "occurred_at": datetime(2026, 7, 14, tzinfo=UTC),
        }
        for event_id in event_ids
    ]


async def _run(chat: FakeToolLoopChat, ledger: FakeLedger, *candidates: dict[str, object]) -> Any:
    req = _request(*candidates)
    return await execute(
        "task-cleanup",
        req.model,
        req.deadlineMs,
        lambda usage: cleanup_mod.run_task_cleanup(req, ledger, usage),  # type: ignore[arg-type]
    )


def test_전용_그래프_위상을_고정한다() -> None:
    graph = TASK_CLEANUP_GRAPH.get_graph()

    assert set(graph.nodes) == {
        "__start__",
        "investigate",
        "validate_decisions",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }
    edges = {(edge.source, edge.target) for edge in graph.edges}
    assert ("__start__", "investigate") in edges
    assert ("investigate", "validate_decisions") in edges
    assert ("repair", "validate_decisions") in edges


def test_요청은_실행_봉투_밖의_정의를_거부한다() -> None:
    with pytest.raises(ValidationError):
        TaskCleanupRequest.model_validate(
            {
                "model": "claude-sonnet-4-6",
                "apiKey": "sk-test",
                "scannedAt": "2026-07-14T00:00:00Z",
                "userId": "user-1",
                "batch": {"candidates": []},
                "completionCallback": _COMPLETION,
                "systemPrompt": "런타임이 정의를 밀어 넣는다",
            },
        )


async def test_모델이_후보를_스스로_열람하고_이벤트를_읽은_뒤_제안한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger(_event_rows("event-1"))
    candidates = [_candidate("task-1", has_events=True), _candidate("task-2", has_events=False)]
    chat = FakeToolLoopChat([
        [{"name": "list_candidate_tasks", "args": {}}],
        [{"name": "get_task_events", "args": {"taskId": "task-1"}}],
        {
            "suggestions": [
                {
                    "kind": "archive",
                    "taskId": "task-1",
                    "rationale": "의미 있는 작업이 없다",
                    "evidenceEventIds": ["event-1"],
                },
                {
                    "kind": "archive",
                    "taskId": "task-2",
                    "rationale": "빈 껍데기다",
                    "evidenceEventIds": [],
                },
            ]
        },
    ])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *a, **k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None
    # 후보 배치는 요청 본문에서 오고 이벤트만 원장 뷰를 사용자 범위로 조회한다.
    assert ledger.queries == [{"desc": False, "args": ["task-1", "user-1", None, 101]}]
    assert res.data["suggestions"] == [
        {
            "kind": "archive",
            "taskId": "task-1",
            "rationale": "의미 있는 작업이 없다",
            "evidenceEventIds": ["event-1"],
        },
        {"kind": "archive", "taskId": "task-2", "rationale": "빈 껍데기다", "evidenceEventIds": []},
    ]


async def test_도구가_보여주지_않은_후보는_버린다(monkeypatch: pytest.MonkeyPatch) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=False)]
    chat = FakeToolLoopChat([
        [{"name": "list_candidate_tasks", "args": {}}],
        {
            "suggestions": [
                {
                    "kind": "archive",
                    "taskId": "ghost",
                    "rationale": "없는 태스크",
                    "evidenceEventIds": [],
                }
            ]
        },
        {"suggestions": []},
    ])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *a, **k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert failures and "ghost" in failures[0].content


async def test_이벤트를_읽지_않은_후보는_제안으로_받지_않는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=True)]
    chat = FakeToolLoopChat([
        [{"name": "list_candidate_tasks", "args": {}}],
        {
            "suggestions": [
                {
                    "kind": "archive",
                    "taskId": "task-1",
                    "rationale": "근거 없이 제안",
                    "evidenceEventIds": [],
                }
            ]
        },
        {"suggestions": []},
    ])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *a, **k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert failures and "was never inspected" in failures[0].content


async def test_읽었더니_이벤트가_없는_후보는_인용_없이도_받는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=True)]
    chat = FakeToolLoopChat([
        [{"name": "list_candidate_tasks", "args": {}}],
        [{"name": "get_task_events", "args": {"taskId": "task-1"}}],
        {
            "suggestions": [
                {
                    "kind": "archive",
                    "taskId": "task-1",
                    "rationale": "알맹이가 없다",
                    "evidenceEventIds": [],
                }
            ]
        },
    ])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *a, **k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None
    assert [item["taskId"] for item in res.data["suggestions"]] == ["task-1"]


async def test_아무_도구도_부르지_않으면_빈_결과로_끝낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    ledger = FakeLedger()
    candidates: list[dict[str, object]] = []
    chat = FakeToolLoopChat([{"suggestions": []}])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *a, **k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
