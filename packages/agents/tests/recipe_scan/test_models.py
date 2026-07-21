"""recipe-scan 요청 봉투와 상태 리듀서의 누적 규칙을 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.models import (
    ProbeReport,
    ProvenanceCatalog,
    RecipeScanRequest,
    RecipeScanState,
)

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-1"}


def test_도메인_입력과_콜백_창구를_요구한다() -> None:
    with pytest.raises(ValidationError):
        RecipeScanRequest.model_validate({"model": "m", "apiKey": "k"})


def test_런타임_정의를_요청으로_받지_않는다() -> None:
    with pytest.raises(ValidationError):
        RecipeScanRequest.model_validate(
            {
                "model": "m",
                "apiKey": "k",
                "taskId": "t1",
                "systemPrompt": "s",
                "outputSchema": {"type": "object"},
                "tools": [],
                "userId": "user-1",
                "completionCallback": _COMPLETION,
            }
        )


def test_도메인_봉투를_보존한다() -> None:
    req = RecipeScanRequest.model_validate(
        {
            "model": "m",
            "apiKey": "k",
            "taskId": " t1 ",
            "language": "ko",
            "userPrompt": " 작업에서 레시피를 찾아줘 ",
            "userId": "user-1",
            "completionCallback": _COMPLETION,
        }
    )

    assert req.taskId == "t1"
    assert req.language == "ko"
    assert req.userPrompt == "작업에서 레시피를 찾아줘"
    assert req.deadlineMs == 720_000


PROBES = ("timeline", "rules", "repetition")


async def _probe(payload: dict[str, str]) -> dict[str, Any]:
    name = payload["probe"]
    return {
        "reports": [ProbeReport(probe=name, verdict="조사했다")],  # type: ignore[typeddict-item]
        "provenance": ProvenanceCatalog(eventIdsByTask={"task-1": {f"event-{name}"}}),
        "model_cost_usd": 0.5,
    }


def _fan(_state: RecipeScanState) -> list[Send]:
    return [Send("probe", {"probe": name}) for name in PROBES]


async def test_전문가가_병렬로_올린_보고가_모두_남는다() -> None:
    graph = StateGraph(RecipeScanState)
    graph.add_node("dispatch", lambda _state: {})
    graph.add_node("probe", _probe)
    graph.add_edge(START, "dispatch")
    graph.add_conditional_edges("dispatch", _fan, ["probe"])
    graph.add_edge("probe", END)

    final = await graph.compile().ainvoke(
        {"reports": [], "provenance": ProvenanceCatalog(), "model_cost_usd": 0.0}
    )

    # 리듀서가 없으면 동시 갱신이 서로를 덮어써 실행이 깨진다.
    assert sorted(report.probe for report in final["reports"]) == sorted(PROBES)
    assert final["provenance"].eventIdsByTask["task-1"] == {f"event-{name}" for name in PROBES}
    assert final["model_cost_usd"] == 1.5
