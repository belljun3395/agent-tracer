"""task-cleanup 도구 루프와 결정적 검증을 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from agent_graph.agents.shared.models import AgentResponse
from agent_graph.agents.task_cleanup import agent as cleanup_mod
from agent_graph.agents.task_cleanup.graph import TASK_CLEANUP_GRAPH, _dispatch
from agent_graph.agents.task_cleanup.models import (
    InspectAssignment,
    InspectDispatch,
    TaskCleanupRequest,
    TriagePlan,
)
from agent_graph.agents.task_cleanup.nodes.inspect import InspectNode
from agent_graph.agents.task_cleanup.policy import clamp_triage
from agent_graph.agents.task_cleanup.reader import CleanupLedgerReader
from tests.support.fakes import FakeLedger, FakeToolLoopChat
from tests.support.narrate import narrate

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


def _triage(*assignments: dict[str, object]) -> dict[str, list[Any]]:
    """조율자는 후보를 직접 열지 못하므로 선별자가 목록을 보고 검토자를 배정하게 대본을 짠다."""
    return {
        "Call list_candidate_tasks": [
            [{"name": "list_candidate_tasks", "args": {}}],
            {"inspect": list(assignments)},
        ]
    }


def _reviewer(task_id: str, report: dict[str, object], *, read: bool = True) -> dict[str, list[Any]]:
    """검토자가 후보 하나의 이벤트를 읽고 판정을 올리는 대본 한 조각을 만든다."""
    turns: list[Any] = []
    if read:
        turns.append([{"name": "get_task_events", "args": {"taskId": task_id}}])
    turns.append(report)
    return {f"Task to judge: {task_id}": turns}


async def _run(_chat: FakeToolLoopChat, ledger: FakeLedger, *candidates: dict[str, object]) -> AgentResponse:
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
        "triage",
        "inspect",
        "investigate",
        "validate_decisions",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }
    edges = {(edge.source, edge.target) for edge in graph.edges}
    # 조율자가 열어볼 후보를 고르고, 고른 만큼 동시에 조사한다.
    assert ("__start__", "triage") in edges
    assert ("triage", "inspect") in edges
    assert ("inspect", "investigate") in edges
    assert ("investigate", "validate_decisions") in edges
    assert ("repair", "validate_decisions") in edges


def test_후보_비용_몫은_배분한_라운드에_비례한다() -> None:
    plan = TriagePlan(
        inspect=[
            {"taskId": "task-1", "rounds": 3},  # type: ignore[list-item]
            {"taskId": "task-2", "rounds": 1},  # type: ignore[list-item]
        ]
    )

    sends = _dispatch({"plan": plan})  # type: ignore[typeddict-item]

    # Send는 페이로드를 직렬화하지 않고 계약 객체 그대로 노드에 넘긴다.
    assert all(isinstance(send.arg, InspectDispatch) for send in sends)
    budgets = {send.arg.assignment.taskId: send.arg.cost_budget for send in sends}
    # 4라운드 중 3:1로 나눈 몫에 전체 상한 $0.5를 곱해 0.375:0.125달러가 배분된다.
    assert budgets == {"task-1": 0.375, "task-2": 0.125}


def test_고른_후보가_예산보다_많으면_많이_요구한_순서로_남긴다() -> None:
    plan = TriagePlan(
        inspect=[
            {"taskId": "task-1", "rounds": 4},  # type: ignore[list-item]
            {"taskId": "task-2", "rounds": 3},  # type: ignore[list-item]
            {"taskId": "task-3", "rounds": 1},  # type: ignore[list-item]
        ]
    )

    kept, cut = clamp_triage(plan, 2)

    assert [item.taskId for item in kept.assignments] == ["task-1", "task-2"]
    assert [item.rounds for item in kept.assignments] == [1, 1]
    assert cut == 6


def test_열어볼_후보가_없으면_즉시_빈_결과로_끝낸다() -> None:
    # 조율자가 도구를 갖지 않으므로 열어볼 후보가 없으면 혼자 조사할 길이 없어 바로 끝난다.
    sends = _dispatch({"plan": TriagePlan(inspect=[])})  # type: ignore[typeddict-item]

    assert [send.node for send in sends] == ["empty"]


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


async def test_검토자가_읽은_후보와_빈_껍데기를_조율자가_함께_제안한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger(_event_rows("event-1"))
    candidates = [_candidate("task-1", has_events=True), _candidate("task-2", has_events=False)]
    worker_turns = {
        **_triage({"taskId": "task-1", "rounds": 2}),
        **_reviewer(
            "task-1",
            {
                "taskId": "task-1",
                "archivable": True,
                "reason": "의미 있는 작업이 없다",
                "citedEventIds": ["event-1"],
            },
        ),
    }
    chat = FakeToolLoopChat(
        [
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
            }
        ],
        worker_turns=worker_turns,
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None
    # 선별자가 고른 후보 하나만 검토자가 이벤트를 사용자 범위로 조회한다.
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
    narrate("task-cleanup :: 검토자가 읽은 후보와 노출된 빈 껍데기를 조율자가 함께 제안한다", res)


async def test_선별자가_노출하지_않은_후보는_버린다(monkeypatch: pytest.MonkeyPatch) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=False)]
    worker_turns = {
        **_triage({"taskId": "task-1", "rounds": 1}),
        **_reviewer(
            "task-1",
            {"taskId": "task-1", "archivable": True, "reason": "빈 껍데기다", "citedEventIds": []},
            read=False,
        ),
    }
    chat = FakeToolLoopChat(
        [
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
        ],
        worker_turns=worker_turns,
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert failures and "ghost" in failures[0].content
    narrate("task-cleanup :: 선별자가 노출한 적 없는 후보 제안은 검증에서 버려진다", res)


async def test_검토자가_읽지_않은_이벤트_후보는_제안으로_받지_않는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=True), _candidate("task-2", has_events=False)]
    # 선별자는 빈 껍데기 task-2만 배정하고, 조율자가 아무도 읽지 않은 task-1을 멋대로 제안한다.
    worker_turns = {
        **_triage({"taskId": "task-2", "rounds": 1}),
        **_reviewer(
            "task-2",
            {"taskId": "task-2", "archivable": True, "reason": "빈 껍데기다", "citedEventIds": []},
            read=False,
        ),
    }
    chat = FakeToolLoopChat(
        [
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
        ],
        worker_turns=worker_turns,
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert failures and "was never inspected" in failures[0].content
    narrate("task-cleanup :: 검토자가 읽지 않은 이벤트 후보는 조율자가 제안해도 버려진다", res)


async def test_검토자가_읽었더니_이벤트가_없는_후보는_인용_없이도_받는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger()
    candidates = [_candidate("task-1", has_events=True)]
    worker_turns = {
        **_triage({"taskId": "task-1", "rounds": 1}),
        **_reviewer(
            "task-1",
            {"taskId": "task-1", "archivable": True, "reason": "알맹이가 없다", "citedEventIds": []},
        ),
    }
    chat = FakeToolLoopChat(
        [
            {
                "suggestions": [
                    {
                        "kind": "archive",
                        "taskId": "task-1",
                        "rationale": "알맹이가 없다",
                        "evidenceEventIds": [],
                    }
                ]
            }
        ],
        worker_turns=worker_turns,
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None
    assert [item["taskId"] for item in res.data["suggestions"]] == ["task-1"]
    narrate("task-cleanup :: 검토자가 읽었더니 이벤트가 없던 후보는 인용 없이도 제안으로 받는다", res)


async def test_아무_도구도_부르지_않으면_빈_결과로_끝낸다(monkeypatch: pytest.MonkeyPatch) -> None:
    ledger = FakeLedger()
    candidates: list[dict[str, object]] = []
    chat = FakeToolLoopChat([{"suggestions": []}])
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None and res.data == {"suggestions": []}
    narrate("task-cleanup :: 도구를 한 번도 부르지 않으면 빈 결과로 끝난다", res)


async def test_조율자가_재파견을_요청하면_후보를_한_번_더_열어보고_완주한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = FakeLedger(_event_rows("event-1"))
    candidates = [_candidate("task-1", has_events=True), _candidate("task-2", has_events=True)]
    archivable = {"archivable": True, "reason": "의미 있는 활동이 없다", "citedEventIds": ["event-1"]}
    worker_turns = {
        **_triage({"taskId": "task-1", "rounds": 2}),
        **_reviewer("task-1", {"taskId": "task-1", **archivable}),
        **_reviewer("task-2", {"taskId": "task-2", **archivable}),
    }
    chat = FakeToolLoopChat(
        [
            {"suggestions": [], "redispatch": [{"taskId": "task-2", "rounds": 1}]},
            {
                "suggestions": [
                    {
                        "kind": "archive",
                        "taskId": "task-1",
                        "rationale": "빈 작업",
                        "evidenceEventIds": ["event-1"],
                    },
                    {
                        "kind": "archive",
                        "taskId": "task-2",
                        "rationale": "빈 작업",
                        "evidenceEventIds": ["event-1"],
                    },
                ]
            },
        ],
        worker_turns=worker_turns,
    )
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(chat, ledger, *candidates)

    assert res.error is None
    assert [item["taskId"] for item in res.data["suggestions"]] == ["task-1", "task-2"]
    # 조율자가 두 번 종합했고 그 사이 후보 하나를 더 열어보게 재파견한다.
    completed = [
        step for step in res.steps if step.nodeName == "investigate" and step.eventKind == "node.completed"
    ]
    assert len(completed) == 2
    assert any("redispatch task-2:1" in step.content for step in res.steps)
    inspected = [
        step for step in res.steps if step.nodeName == "inspect" and step.eventKind == "node.completed"
    ]
    assert len(inspected) == 2
    narrate("task-cleanup :: 조율자가 재파견을 요청하면 후보를 한 번 더 열어보고 완주한다", res)


async def test_후보_조사_예외는_실패_보고로_강등된다() -> None:
    class BoomChat(FakeToolLoopChat):
        async def ainvoke(self, _messages: list[Any]) -> Any:
            raise RuntimeError("inspect blew up")

    req = _request(_candidate("task-1", has_events=True))
    node = InspectNode(
        req,
        CleanupLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        ExecutionTrace(),
        BoomChat([]),
        agent_name="task-cleanup",
    )

    result = await node.run(
        InspectDispatch(assignment=InspectAssignment(taskId="task-1", rounds=2), cost_budget=0.25)
    )

    # 조사가 무너진 후보는 안전하게 보관 불가로, 사유는 실패로 올린다.
    report = result["reports"][0]
    assert report.taskId == "task-1"
    assert report.archivable is False
    assert report.reason.startswith("조사 실패") and "inspect blew up" in report.reason
    assert report.citedEventIds == []
    assert "model_cost_usd" in result


async def test_후보_하나가_무너져도_그래프가_완주하고_나머지가_합쳐진다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class OneInspectFails(FakeToolLoopChat):
        async def ainvoke(self, messages: list[Any]) -> Any:
            names = {getattr(tool, "name", "") for tool in self.bound_tools}
            text = " ".join(str(getattr(message, "content", message)) for message in messages)
            # CleanupDraft를 쥔 조율자는 걸리지 않아 task-2 조사만 골라 무너진다.
            if "InspectReport" in names and "task-2" in text:
                raise RuntimeError("inspect blew up")
            return await super().ainvoke(messages)

    plan = {"inspect": [{"taskId": "task-1", "rounds": 2}, {"taskId": "task-2", "rounds": 2}]}
    chat = OneInspectFails([{"suggestions": []}], report={"TriagePlan": plan})
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(
        chat,
        FakeLedger(),
        _candidate("task-1", has_events=True),
        _candidate("task-2", has_events=True),
    )

    # 한 후보 조사가 예외를 던져도 잡은 실패하지 않고 완주한다.
    assert res.error is None and res.data == {"suggestions": []}
    inspected = [step for step in res.steps if step.nodeName == "inspect"]
    assert sum(1 for step in inspected if step.eventKind == "node.completed") == 2
    assert not any(step.eventKind == "node.failed" for step in inspected)
    narrate("task-cleanup :: 후보 하나의 조사가 무너져도 그래프는 완주하고 나머지 보고가 합쳐진다", res)


async def test_고른_후보만_각자_예산으로_병렬_조사된다(monkeypatch: pytest.MonkeyPatch) -> None:
    plan = {"inspect": [{"taskId": "task-1", "rounds": 2}, {"taskId": "task-2", "rounds": 2}]}
    chat = FakeToolLoopChat([{"suggestions": []}], report={"TriagePlan": plan})
    monkeypatch.setattr(cleanup_mod, "make_chat", lambda *_a, **_k: chat)

    res = await _run(
        chat,
        FakeLedger(),
        _candidate("task-1", has_events=True),
        _candidate("task-2", has_events=True),
    )

    assert res.error is None
    inspected = [step for step in res.steps if step.nodeName == "inspect"]
    assert sum(1 for step in inspected if step.eventKind == "node.completed") == 2
    narrate("task-cleanup :: 조율자가 고른 후보만 각자 예산으로 병렬 조사된다", res)
