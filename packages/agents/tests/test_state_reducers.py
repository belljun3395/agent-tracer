"""병렬 분기가 같은 상태 칸에 쓸 때의 누적 규칙을 검증한다."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from agent_graph.agents.recipe_scan.models import (
    ProbeReport,
    ProvenanceCatalog,
    RecipeScanState,
)

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
    # 전문가가 각자 맥락에서 모은 근거가 조율자의 장부 하나로 합쳐진다.
    assert final["provenance"].eventIdsByTask["task-1"] == {f"event-{name}" for name in PROBES}
    # 병렬 지출은 덮어쓰지 않고 더해져야 예산이 실제 지출을 반영한다.
    assert final["model_cost_usd"] == 1.5
