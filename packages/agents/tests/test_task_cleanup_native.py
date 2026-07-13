"""task-cleanup native graph의 위상, 경계, provenance 검증."""

from __future__ import annotations

import json as jsonlib
from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from agent_graph.agents.task_cleanup import agent as cleanup_mod
from agent_graph.agents.task_cleanup.graph import build_task_cleanup_graph
from agent_graph.agents.task_cleanup.models import InspectionPlan, TaskCleanupRequest
from agent_graph.agents.task_cleanup.tools import load_candidate_pages
from tests.fakes import FakeStructuredChat, FakeToolClient, FakeToolResponse


def candidate(task_id: str, *, has_events: bool) -> dict[str, object]:
    return {
        "id": task_id,
        "visibleTitle": "정리해줘" if not has_events else "오래된 작업",
        "status": "waiting",
        "lastEventAt": "2026-06-01T00:00:00.000Z" if has_events else None,
        "hasEvents": has_events,
        "activeChildCount": 0,
        "candidateReasons": ["stale" if has_events else "no-events"],
    }


def candidate_page(*items: dict[str, object]) -> dict[str, object]:
    return {
        "candidates": list(items),
        "truncated": False,
        "total": len(items),
        "moreCandidatesOutsideBatch": False,
    }


def event_page(task_id: str, event_id: str) -> dict[str, object]:
    return {
        "events": [
            {
                "id": event_id,
                "seq": "1",
                "kind": "gen_ai.user.message",
                "title": "열어만 봐줘",
                "body": "실제 변경 없이 확인만 했다",
                "filePaths": [],
                "occurredAt": "2026-06-01T00:00:00.000Z",
            }
        ],
        "truncated": False,
        "total": 1,
    }


def request() -> TaskCleanupRequest:
    return TaskCleanupRequest(
        model="claude-haiku-4-5",
        apiKey="sk-test",
        jobId="job-1",
        scannedAt="2026-07-13T00:00:00.000Z",
        language="ko",
        maxSuggestions=20,
        toolCallback={"url": "http://worker:8810/tools/invoke", "token": "tok-1"},
    )


async def noop(_state: object) -> dict[str, Any]:
    return {}


def test_전용_그래프_위상을_고정한다() -> None:
    graph = build_task_cleanup_graph(
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        lambda _state: "plan_inspection",
        lambda _state: "validate_decisions",
        lambda _state: "accept_batch",
        lambda _state: "finalize",
    ).get_graph()

    assert set(graph.nodes) == {
        "__start__",
        "bootstrap_candidates",
        "plan_inspection",
        "gather_events",
        "assess_candidates",
        "validate_decisions",
        "repair",
        "accept_batch",
        "finalize",
        "empty",
        "__end__",
    }
    edges = {(edge.source, edge.target) for edge in graph.edges}
    assert ("__start__", "bootstrap_candidates") in edges
    assert ("assess_candidates", "plan_inspection") in edges
    assert ("validate_decisions", "repair") in edges
    assert ("validate_decisions", "accept_batch") in edges
    assert ("repair", "validate_decisions") in edges
    assert ("accept_batch", "plan_inspection") in edges
    assert ("finalize", "__end__") in edges
    assert ("empty", "__end__") in edges


def test_요청은_실행_봉투_밖의_정의를_거부한다() -> None:
    with pytest.raises(ValidationError):
        TaskCleanupRequest(
            model="m",
            apiKey="k",
            scannedAt="2026-07-13T00:00:00.000Z",
            maxSuggestions=10,
            systemPrompt="worker-owned",
            tools=[],
            toolCallback={"url": "http://worker/tools", "token": "tok"},
        )


async def test_후보_목록을_커서가_끝날_때까지_결정적으로_읽는다() -> None:
    calls: list[dict[str, object]] = []

    class PagingClient:
        async def post(
            self,
            _url: str,
            json: dict[str, Any],
            headers: dict[str, str] | None = None,
        ) -> FakeToolResponse:
            del headers
            args = dict(json["args"])
            calls.append(args)
            if "cursor" not in args:
                page = {
                    "candidates": [candidate("first", has_events=False)],
                    "truncated": True,
                    "nextCursor": "cursor-2",
                    "total": 2,
                    "moreCandidatesOutsideBatch": False,
                }
            else:
                page = candidate_page(candidate("second", has_events=False))
                page["total"] = 2
            return FakeToolResponse({"content": jsonlib.dumps(page)})

    pages = await load_candidate_pages(
        PagingClient(),  # type: ignore[arg-type]
        request().toolCallback,
        ExecutionTrace(),
    )

    assert [item.id for page in pages for item in page.candidates] == ["first", "second"]
    assert calls == [{"limit": 100}, {"limit": 100, "cursor": "cursor-2"}]


async def test_빈_후보는_모델을_호출하지_않고_끝낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = FakeStructuredChat([])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    usage = ExecutionTrace()

    result = await cleanup_mod.run_task_cleanup(
        request(),
        FakeToolClient({"list_candidate_tasks": candidate_page()}),
        usage,
    )

    assert result == {"suggestions": []}
    assert chat.calls == []
    assert any(step.nodeName == "empty" for step in usage.steps)


async def test_이벤트를_읽은_후보와_빈_껍데기만_제안한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat = FakeStructuredChat(
        [
            {
                "rationale": "이벤트가 있는 후보 하나를 조사한다",
                "targets": [
                    {
                        "taskId": "eventful",
                        "order": "desc",
                        "limit": 50,
                        "purpose": "실질 작업 여부 확인",
                    }
                ],
            },
            {
                "rationale": "둘 다 보관 제안 가능하다",
                "suggestions": [
                    {
                        "taskId": "empty",
                        "rationale": "생성 뒤 기록된 이벤트가 없는 빈 작업이다.",
                        "evidenceEventIds": [],
                    },
                    {
                        "taskId": "eventful",
                        "rationale": "확인 요청 하나만 있고 실제 변경은 없다.",
                        "evidenceEventIds": ["event-1"],
                    },
                ],
                "needsMoreEvidence": False,
            },
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    client = FakeToolClient(
        {
            "list_candidate_tasks": candidate_page(
                candidate("empty", has_events=False),
                candidate("eventful", has_events=True),
            ),
            "get_task_events": event_page("eventful", "event-1"),
        }
    )
    usage = ExecutionTrace()

    result = await cleanup_mod.run_task_cleanup(request(), client, usage)

    assert [item["taskId"] for item in result["suggestions"]] == ["empty", "eventful"]
    assert client.calls == ["list_candidate_tasks", "get_task_events"]
    assert any(step.eventKind == "route.selected" for step in usage.steps)
    assert any(step.toolName == "get_task_events" for step in usage.steps)


async def test_거짓_ID를_한_번_수정한_뒤_버리고_유효한_제안은_보존한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = {
        "taskId": "ghost",
        "rationale": "존재하지 않는 작업이다.",
        "evidenceEventIds": [],
    }
    chat = FakeStructuredChat(
        [
            {"rationale": "이벤트 조회가 필요 없다", "targets": []},
            {
                "rationale": "빈 작업을 제안한다",
                "suggestions": [
                    {
                        "taskId": "empty",
                        "rationale": "기록된 이벤트가 없는 빈 작업이다.",
                        "evidenceEventIds": [],
                    },
                    invalid,
                ],
            },
            {"suggestions": [invalid]},
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    usage = ExecutionTrace()

    result = await cleanup_mod.run_task_cleanup(
        request(),
        FakeToolClient(
            {"list_candidate_tasks": candidate_page(candidate("empty", has_events=False))}
        ),
        usage,
    )

    assert result == {
        "suggestions": [
            {
                "kind": "archive",
                "taskId": "empty",
                "rationale": "기록된 이벤트가 없는 빈 작업이다.",
            }
        ]
    }
    assert len([step for step in usage.steps if step.eventKind == "validation.failed"]) == 2
    assert len(
        [
            step
            for step in usage.steps
            if step.nodeName == "repair" and step.eventKind == "node.started"
        ]
    ) == 1
    assert any(
        step.role == "user" and "Write every rationale in Korean" in step.content
        for step in usage.steps
    )


async def test_근거가_없는_이벤트_후보는_수정_후에도_비운다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unsupported = {
        "taskId": "eventful",
        "rationale": "오래되어 보관한다.",
        "evidenceEventIds": [],
    }
    chat = FakeStructuredChat(
        [
            {"rationale": "조회 없이 판단한다", "targets": []},
            {"rationale": "오래되었다", "suggestions": [unsupported]},
            {"suggestions": [unsupported]},
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)

    result = await cleanup_mod.run_task_cleanup(
        request(),
        FakeToolClient(
            {"list_candidate_tasks": candidate_page(candidate("eventful", has_events=True))}
        ),
        ExecutionTrace(),
    )

    assert result == {"suggestions": []}


async def test_추가_근거_수집은_두_라운드에서_멈춘다(monkeypatch: pytest.MonkeyPatch) -> None:
    chat = FakeStructuredChat(
        [
            {"rationale": "첫 계획", "targets": []},
            {
                "rationale": "근거 부족",
                "suggestions": [],
                "needsMoreEvidence": True,
                "missingEvidence": ["종료 이벤트"],
            },
            {"rationale": "두 번째 계획", "targets": []},
            {
                "rationale": "여전히 부족",
                "suggestions": [],
                "needsMoreEvidence": True,
                "missingEvidence": ["종료 이벤트"],
            },
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    usage = ExecutionTrace()

    result = await cleanup_mod.run_task_cleanup(
        request(),
        FakeToolClient(
            {"list_candidate_tasks": candidate_page(candidate("eventful", has_events=True))}
        ),
        usage,
    )

    assert result == {"suggestions": []}
    assert chat.calls.count(InspectionPlan) == 2
    assert sum(
        step.nodeName == "gather_events" and step.eventKind == "node.started"
        for step in usage.steps
    ) == 2


async def test_백_개를_넘는_후보도_다음_batch에서_평가한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    candidates = [candidate(f"task-{index}", has_events=False) for index in range(101)]
    chat = FakeStructuredChat(
        [
            {"rationale": "첫 배치는 조회가 필요 없다", "targets": []},
            {"rationale": "첫 배치에는 제안이 없다", "suggestions": []},
            {"rationale": "두 번째 배치도 조회가 필요 없다", "targets": []},
            {
                "rationale": "마지막 빈 작업을 제안한다",
                "suggestions": [
                    {
                        "taskId": "task-100",
                        "rationale": "기록된 이벤트가 없는 빈 작업이다.",
                        "evidenceEventIds": [],
                    }
                ],
            },
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)

    result = await cleanup_mod.run_task_cleanup(
        request(),
        FakeToolClient({"list_candidate_tasks": candidate_page(*candidates)}),
        ExecutionTrace(),
    )

    assert [item["taskId"] for item in result["suggestions"]] == ["task-100"]
    assert chat.calls.count(InspectionPlan) == 2


async def test_프롬프트에서_잘린_event_ID는_provenance로_인정하지_않는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events = [
        {
            "id": f"event-{index}",
            "seq": str(index),
            "kind": "gen_ai.user.message",
            "title": "확인 요청",
            "body": "가" * 5_000,
            "filePaths": [],
            "occurredAt": "2026-06-01T00:00:00.000Z",
        }
        for index in range(30)
    ]
    hidden_id = "event-29"
    suggestion = {
        "taskId": "eventful",
        "rationale": "잘린 이벤트를 근거로 제안한다.",
        "evidenceEventIds": [hidden_id],
    }
    chat = FakeStructuredChat(
        [
            {
                "rationale": "이벤트를 조사한다",
                "targets": [
                    {
                        "taskId": "eventful",
                        "order": "desc",
                        "limit": 50,
                        "purpose": "실질 작업 여부 확인",
                    }
                ],
            },
            {"rationale": "잘린 근거를 인용한다", "suggestions": [suggestion]},
            {"suggestions": [suggestion]},
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    client = FakeToolClient(
        {
            "list_candidate_tasks": candidate_page(candidate("eventful", has_events=True)),
            "get_task_events": {
                "events": events,
                "truncated": False,
                "total": len(events),
            },
        }
    )
    usage = ExecutionTrace()

    result = await cleanup_mod.run_task_cleanup(request(), client, usage)

    assert result == {"suggestions": []}
    assert sum(step.eventKind == "validation.failed" for step in usage.steps) == 2


async def test_두번째_수집_round는_같은_event_page를_다시_읽지_않는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target = {
        "taskId": "eventful",
        "order": "desc",
        "limit": 50,
        "purpose": "실질 작업 여부 확인",
    }
    chat = FakeStructuredChat(
        [
            {"rationale": "첫 조회", "targets": [target]},
            {
                "rationale": "추가 근거가 필요하다",
                "suggestions": [],
                "needsMoreEvidence": True,
            },
            {"rationale": "같은 조회를 다시 계획한다", "targets": [target]},
            {"rationale": "더 제안하지 않는다", "suggestions": []},
        ]
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *args, **kwargs: chat)
    client = FakeToolClient(
        {
            "list_candidate_tasks": candidate_page(candidate("eventful", has_events=True)),
            "get_task_events": event_page("eventful", "event-1"),
        }
    )

    result = await cleanup_mod.run_task_cleanup(request(), client, ExecutionTrace())

    assert result == {"suggestions": []}
    assert client.calls.count("get_task_events") == 1
