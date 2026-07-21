"""recipe-scan 그래프의 위상과 팬아웃 배선(Send 대상·비용 배분)을 고정한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH, _dispatch
from agent_graph.agents.recipe_scan.models import DispatchPlan, ProbeDispatch
from tests.support.topology import edge_lines


def test_그래프의_간선_집합을_고정한다() -> None:
    print(RECIPE_SCAN_GRAPH.get_graph().draw_ascii())
    assert edge_lines(RECIPE_SCAN_GRAPH) == {
        "__start__ → survey",
        "survey ⇢ probe",
        "survey ⇢ investigate",
        "probe → investigate",
        "investigate ⇢ probe",
        "investigate ⇢ validate_candidate",
        "validate_candidate ⇢ repair",
        "validate_candidate ⇢ finalize",
        "validate_candidate ⇢ empty",
        "repair → validate_candidate",
        "finalize → __end__",
        "empty → __end__",
    }


def test_전문가_비용_몫은_배분한_weight에_비례한다() -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "weight": 6, "question": "무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "weight": 2, "question": "어떤 규칙이"},  # type: ignore[list-item]
        ]
    )

    sends = _dispatch({"plan": plan})  # type: ignore[typeddict-item]

    # Send는 페이로드를 직렬화하지 않고 계약 객체 그대로 노드에 넘긴다.
    assert all(isinstance(send.arg, ProbeDispatch) for send in sends)
    budgets = {send.arg.assignment.probe: send.arg.cost_budget for send in sends}
    # weight 합 8 중 6:2로 나눈 몫에 전체 상한 $2.0을 곱해 1.5:0.5달러가 배분된다.
    assert budgets == {"timeline": 1.5, "rules": 0.5}


def test_계획이_없으면_조율자가_혼자_조사한다() -> None:
    sends = _dispatch({"plan": None})  # type: ignore[typeddict-item]

    assert [send.node for send in sends] == ["investigate"]
