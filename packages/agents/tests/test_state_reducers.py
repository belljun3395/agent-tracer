"""병렬 분기가 같은 상태 칸에 쓸 때의 누적 규칙을 검증한다."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from agent_graph.agents.recipe_scan.models import ProbeReport, RecipeScanState

PROBES = ("timeline", "rules", "repetition")


async def _probe(payload: dict[str, str]) -> dict[str, Any]:
    return {"reports": [ProbeReport(probe=payload["probe"], verdict="조사했다")]}  # type: ignore[typeddict-item]


def _fan(_state: RecipeScanState) -> list[Send]:
    return [Send("probe", {"probe": name}) for name in PROBES]


async def test_전문가가_병렬로_올린_보고가_모두_남는다() -> None:
    graph = StateGraph(RecipeScanState)
    graph.add_node("dispatch", lambda _state: {})
    graph.add_node("probe", _probe)
    graph.add_edge(START, "dispatch")
    graph.add_conditional_edges("dispatch", _fan, ["probe"])
    graph.add_edge("probe", END)

    final = await graph.compile().ainvoke({"reports": []})

    # 리듀서가 없으면 동시 갱신이 서로를 덮어써 실행이 깨진다.
    assert sorted(report.probe for report in final["reports"]) == sorted(PROBES)
