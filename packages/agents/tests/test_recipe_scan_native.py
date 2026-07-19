"""Python-native recipe-scan의 그래프 위상과 후보 검증을 확인한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH, _dispatch
from agent_graph.agents.recipe_scan.models import (
    MAX_TOOL_ROUNDS,
    DispatchPlan,
    ProbeAssignment,
    ProbeDispatch,
    ProvenanceCatalog,
    RecipeCandidate,
    RecipeScanRequest,
)
from agent_graph.agents.recipe_scan.nodes.probe import create_probe_node
from agent_graph.agents.recipe_scan.policy import (
    MIN_SYNTHESIS_ROUNDS,
    SURVEY_ROUNDS,
    distributable_rounds,
    synthesis_rounds,
    validate_recipe_candidate,
)
from agent_graph.agents.recipe_scan.reader import RecipeLedgerReader
from agent_graph.agents.recipe_scan.search import RecipeSearchReader
from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from tests.fakes import FakeLedger, FakeSearch, FakeToolLoopChat


def test_recipe_전용_그래프_위상을_명시한다() -> None:
    graph = RECIPE_SCAN_GRAPH.get_graph()

    assert set(graph.nodes) == {
        "__start__",
        "survey",
        "probe",
        "investigate",
        "validate_candidate",
        "repair",
        "finalize",
        "empty",
        "__end__",
    }


def test_전문가_비용_몫은_배분한_라운드에_비례한다() -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 6, "question": "무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 2, "question": "어떤 규칙이"},  # type: ignore[list-item]
        ]
    )

    sends = _dispatch({"plan": plan})  # type: ignore[typeddict-item]

    # Send는 페이로드를 직렬화하지 않고 계약 객체 그대로 노드에 넘긴다.
    assert all(isinstance(send.arg, ProbeDispatch) for send in sends)
    shares = {send.arg.assignment.probe: send.arg.cost_share for send in sends}
    # 8라운드 중 6:2로 나눴으니 비용도 0.75:0.25로 갈린다.
    assert shares == {"timeline": 0.75, "rules": 0.25}


def test_계획이_없으면_조율자가_혼자_조사한다() -> None:
    sends = _dispatch({"plan": None})  # type: ignore[typeddict-item]

    assert [send.node for send in sends] == ["investigate"]


def test_배분_가능한_라운드는_종합_최소_몫을_먼저_뗀다() -> None:
    # 전문가에게 나눠줄 수 있는 라운드는 계획과 종합 최소 몫을 뗀 나머지다.
    assert distributable_rounds() == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - MIN_SYNTHESIS_ROUNDS


def test_종합_라운드는_전문가가_적게_쓰면_남은_만큼_더_받는다() -> None:
    small = DispatchPlan(
        probes=[{"probe": "rules", "rounds": 3, "question": "무엇"}]  # type: ignore[list-item]
    )
    large = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 6, "question": "무엇"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 5, "question": "규칙"},  # type: ignore[list-item]
        ]
    )

    # 종합은 남은 라운드를 그대로 받아 전문가를 적게 띄우면 더 여유를 갖는다.
    assert synthesis_rounds(small) == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - 3
    assert synthesis_rounds(large) == MAX_TOOL_ROUNDS - SURVEY_ROUNDS - 11
    assert synthesis_rounds(small) > synthesis_rounds(large)
    # 계획이 없으면 조율자가 혼자 도는 실행이라 종합이 예산을 통째로 갖는다.
    assert synthesis_rounds(None) == MAX_TOOL_ROUNDS


def test_종합_라운드는_최소_몫_아래로_내려가지_않는다() -> None:
    greedy = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 10, "question": "무엇"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 10, "question": "규칙"},  # type: ignore[list-item]
        ]
    )

    assert synthesis_rounds(greedy) == MIN_SYNTHESIS_ROUNDS


async def test_전문가_실행_예외는_실패_보고로_강등된다() -> None:
    class BoomChat(FakeToolLoopChat):
        async def ainvoke(self, messages: list[object]) -> object:
            raise RuntimeError("agent blew up")

    req = RecipeScanRequest(
        model="claude-sonnet-4-6",
        apiKey="sk-test",
        taskId="t1",
        userId="user-1",
        completionCallback={"url": "http://worker/c", "token": "x"},  # type: ignore[arg-type]
    )
    node = create_probe_node(
        req,
        RecipeLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        RecipeSearchReader(FakeSearch(), "user-1"),  # type: ignore[arg-type]
        ExecutionTrace(),
        BoomChat([]),
        agent_name="recipe-scan",
    )

    result = await node(
        ProbeDispatch(
            assignment=ProbeAssignment(probe="timeline", rounds=2, question="무엇"),
            cost_share=0.5,
        )
    )

    # 예외를 던진 전문가는 판정을 실패로 싣고 소진 표시를 올려 조율자가 알게 한다.
    report = result["reports"][0]
    assert report.probe == "timeline"
    assert report.exhausted is True
    assert report.verdict.startswith("조사 실패") and "agent blew up" in report.verdict
    assert report.excerpts == []
    # 실패해도 지출은 합산에 실린다.
    assert "model_cost_usd" in result


def test_anchor_slice는_실제_anchor_event를_인용해야_한다() -> None:
    candidate = RecipeCandidate(
        title="Add migration",
        intent="마이그레이션을 안전하게 추가한다",
        description="스키마 변경이 필요할 때 쓴다.",
        summary_md="- 변경을 정의한다\n- 검증한다",
        request="사용자가 마이그레이션 추가를 요청했다.",
        contributing_slices=[{"taskId": "task-1", "eventIds": []}],
        rationale="반복 가능한 절차다.",
    )
    provenance = ProvenanceCatalog(
        eventIdsByTask={"task-1": {"event-1"}, "task-2": {"event-2"}},
    )

    errors = validate_recipe_candidate(candidate, "task-1", provenance)

    assert "The anchor contributing slice must cite at least one anchor event ID." in errors


def test_이벤트를_읽지_않은_태스크는_기여_슬라이스로_인정하지_않는다() -> None:
    candidate = RecipeCandidate(
        title="Add migration",
        intent="마이그레이션을 안전하게 추가한다",
        description="스키마 변경이 필요할 때 쓴다.",
        summary_md="- 변경을 정의한다\n- 검증한다",
        request="사용자가 마이그레이션 추가를 요청했다.",
        contributing_slices=[
            {"taskId": "task-1", "eventIds": ["event-1"]},
            {"taskId": "task-2", "eventIds": []},
        ],
        rationale="반복 가능한 절차다.",
    )
    provenance = ProvenanceCatalog(eventIdsByTask={"task-1": {"event-1"}})

    errors = validate_recipe_candidate(candidate, "task-1", provenance)

    assert "Unsupported contributing task ID: task-2." in errors

