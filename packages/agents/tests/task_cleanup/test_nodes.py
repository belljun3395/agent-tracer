"""task-cleanup 노드를 그래프 밖에서 직접 실행해 실패 강등을 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from agent_graph.agents.task_cleanup.models import (
    InspectAssignment,
    InspectDispatch,
    TaskCleanupRequest,
)
from agent_graph.agents.task_cleanup.nodes.inspect import InspectNode
from agent_graph.agents.task_cleanup.reader import CleanupLedgerReader
from tests.support.fakes import FakeLedger, FakeToolLoopChat

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
