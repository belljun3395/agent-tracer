"""recipe-scan 그래프의 위상·비용 배분·모델 주도 조사를 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from anthropic import AuthenticationError

from agent_graph.agents.recipe_scan import agent as recipe_mod
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
from agent_graph.agents.runtime.execution.runner import execute
from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from agent_graph.agents.shared.models import AgentResponse
from tests.support.fakes import FakeLedger, FakeSearch, FakeToolLoopChat
from tests.support.narrate import narrate

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-recipe"}


def _event_row(event_id: str, turn_id: str, title: str) -> dict[str, object]:
    return {
        "id": event_id,
        "seq": 1,
        "turn_id": turn_id,
        "kind": "execute_tool",
        "title": title,
        "body": None,
        "tool_name": None,
        "file_paths": [],
        "metadata": {},
        "occurred_at": datetime(2026, 7, 14, tzinfo=UTC),
    }


def _default_ledger() -> FakeLedger:
    return FakeLedger(
        [
            _event_row("event-1", "turn-1", "마이그레이션"),
            _event_row("event-2", "turn-2", "대시보드"),
        ],
        rules=[
            {
                "id": "rule-1",
                "name": "규칙",
                "expectation": {"kind": "action", "tool": "Bash"},
                "task_id": "t1",
                "anchor_event_id": "event-1",
                "source": "agent",
                "severity": "info",
                "rationale": None,
                "signature": "sig-1",
                "created_at": datetime(2026, 7, 14, tzinfo=UTC),
            }
        ],
    )


def _request(**overrides: Any) -> RecipeScanRequest:
    values: dict[str, Any] = {
        "model": "claude-sonnet-4-6",
        "apiKey": "sk-test",
        "taskId": "t1",
        "language": "ko",
        "userId": "user-1",
        "completionCallback": _COMPLETION,
    }
    values.update(overrides)
    return RecipeScanRequest.model_validate(values)


def _recipe(**overrides: Any) -> dict[str, object]:
    base: dict[str, object] = {
        "title": "Add migration",
        "intent": "마이그레이션",
        "description": "설명",
        "summary_md": "- a",
        "request": "사용자가 마이그레이션 작업을 recipe로 만들라고 했다.",
        "corrections": [],
        "pitfalls": [],
        "governing_rules": ["rule-1"],
        "contributing_slices": [{"taskId": "t1", "turnIds": ["turn-1"], "eventIds": ["event-1"]}],
        "rationale": "근거",
    }
    base.update(overrides)
    return base


async def _run(
    monkeypatch: pytest.MonkeyPatch,
    chat: FakeToolLoopChat,
    ledger: FakeLedger | None = None,
) -> AgentResponse:
    req = _request()
    monkeypatch.setattr(recipe_mod, "make_chat", lambda *a, **k: chat)
    fake_ledger = ledger if ledger is not None else _default_ledger()
    return await execute(
        "recipe-scan",
        req.model,
        req.deadlineMs,
        lambda usage: recipe_mod.run_recipe_scan(req, fake_ledger, FakeSearch(), usage),
    )


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
    small = DispatchPlan(probes=[{"probe": "rules", "rounds": 3, "question": "무엇"}])  # type: ignore[list-item]
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

    req = _request()
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
    provenance = ProvenanceCatalog(eventIdsByTask={"task-1": {"event-1"}, "task-2": {"event-2"}})

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


async def test_모델이_스스로_도구를_골라_근거를_모으고_후보를_낸다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat = FakeToolLoopChat(
        [
            [
                {"name": "get_task_summary", "args": {"taskId": "t1"}},
                {"name": "list_rules", "args": {"taskId": "t1"}},
            ],
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe()]},
        ]
    )

    res = await _run(monkeypatch, chat)

    assert res.error is None
    assert res.data is not None and res.data["recipes"][0]["title"] == "Add migration"
    assert [step.toolName for step in res.steps if step.role == "tool"] == [
        "get_task_summary",
        "list_rules",
        "get_task_events",
    ]
    narrate("recipe-scan :: 모델이 스스로 도구를 골라 근거를 모으고 후보를 낸다", chat, res)


async def test_도구를_한_번도_부르지_않아도_빈_결과로_끝난다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat = FakeToolLoopChat([{"recipes": []}])
    ledger = _default_ledger()

    res = await _run(monkeypatch, chat, ledger)

    assert res.error is None and res.data == {"recipes": []}
    # 도구를 부르지 않았으니 원장을 한 번도 조회하지 않는다.
    assert ledger.queries == []
    narrate("recipe-scan :: 도구를 한 번도 부르지 않아도 빈 결과로 끝난다", chat, res)


async def test_도구가_돌려주지_않은_ID는_한_번_수정한_뒤_검증한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = _recipe(governing_rules=["invented-rule"])
    chat = FakeToolLoopChat(
        [
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [invalid]},
            {"recipes": [_recipe()]},
        ]
    )

    res = await _run(monkeypatch, chat)

    assert res.error is None and res.data is not None
    assert res.data["recipes"][0]["governing_rules"] == ["rule-1"]
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert len(failures) == 1 and "invented-rule" in failures[0].content
    assert sum(step.nodeName == "repair" and step.eventKind == "node.started" for step in res.steps) == 1
    narrate("recipe-scan :: 도구가 돌려주지 않은 ID는 한 번 수정한 뒤 검증한다", chat, res)


async def test_수정_후에도_ID가_거짓이면_후보를_버린다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = _recipe(contributing_slices=[{"taskId": "t1", "turnIds": [], "eventIds": ["ghost"]}])
    chat = FakeToolLoopChat(
        [
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"recipes": [invalid]},
            {"recipes": [invalid]},
        ]
    )

    res = await _run(monkeypatch, chat)

    assert res.error is None and res.data == {"recipes": []}
    assert sum(step.eventKind == "validation.failed" for step in res.steps) == 2
    narrate("recipe-scan :: 수정 후에도 ID가 거짓이면 후보를 버린다", chat, res)


async def test_서로_다른_turn은_각각의_후보로_남는다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    second = _recipe(
        title="Add dashboard",
        contributing_slices=[{"taskId": "t1", "turnIds": ["turn-2"], "eventIds": ["event-2"]}],
    )
    chat = FakeToolLoopChat(
        [
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe(), second]},
        ]
    )

    res = await _run(monkeypatch, chat)

    assert res.error is None and res.data is not None
    assert [recipe["title"] for recipe in res.data["recipes"]] == ["Add migration", "Add dashboard"]
    narrate("recipe-scan :: 서로 다른 turn은 각각의 후보로 남는다", chat, res)


async def test_같은_turn을_두_후보가_주장하면_수정을_요구한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    duplicate = _recipe(title="Add dashboard")
    chat = FakeToolLoopChat(
        [
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "list_rules", "args": {"taskId": "t1"}}],
            {"recipes": [_recipe(), duplicate]},
            {"recipes": [_recipe()]},
        ]
    )

    res = await _run(monkeypatch, chat)

    assert res.error is None and res.data is not None
    assert [recipe["title"] for recipe in res.data["recipes"]] == ["Add migration"]
    failures = [step for step in res.steps if step.eventKind == "validation.failed"]
    assert len(failures) == 1 and "turn-1" in failures[0].content
    narrate("recipe-scan :: 같은 turn을 두 후보가 주장하면 수정을 요구한다", chat, res)


async def test_모델_호출_실패는_완료가_아니라_노드_실패로_기록한다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FailingChat(FakeToolLoopChat):
        def with_structured_output(self, _schema: object, **_kwargs: object) -> object:
            return self

        async def ainvoke(self, messages: list[object]) -> object:
            raise AuthenticationError(
                "bad key",
                response=httpx.Response(401, request=httpx.Request("POST", "https://api.anthropic.com")),
                body=None,
            )

    chat = FailingChat([])

    res = await _run(monkeypatch, chat)

    assert res.error is not None
    # 계획 단계가 첫 모델 호출이므로 실패도 거기서 궤적에 남는다.
    events = [step.eventKind for step in res.steps if step.nodeName == "survey"]
    assert events == ["node.started", "node.failed"]
    narrate("recipe-scan :: 모델 호출 실패는 완료가 아니라 노드 실패로 기록한다", chat, res)


async def test_조율자가_세운_계획이_조사_지시문과_라운드에_반영된다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    plan = DispatchPlan(probes=[{"probe": "rules", "rounds": 3, "question": "어떤 규칙이 걸렸나"}])  # type: ignore[list-item]
    chat = FakeToolLoopChat([{"recipes": []}], plan=plan)

    res = await _run(monkeypatch, chat)

    assert res.error is None
    sent = " ".join(
        str(getattr(message, "content", message)) for request in chat.requests for message in request
    )
    # 계획이 조사 지시문으로 펴지고 배분한 라운드가 그대로 예산이 된다.
    assert "rules (3 rounds): 어떤 규칙이 걸렸나" in sent
    assert "3 of 3 tool-calling rounds remain" in sent
    assert any("survey -> rules:3" in step.content for step in res.steps)
    narrate("recipe-scan :: 조율자가 세운 계획이 조사 지시문과 라운드에 반영된다", chat, res)


async def test_계획한_전문가들이_각자_도구만_쥐고_병렬로_돈다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 4, "question": "무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 3, "question": "어떤 규칙이"},  # type: ignore[list-item]
        ]
    )
    chat = FakeToolLoopChat([{"recipes": []}], plan=plan)

    res = await _run(monkeypatch, chat)

    assert res.error is None
    # 전문가는 자기 근거 원천의 도구만 쥔다.
    assert sorted(sorted(names) for names in chat.probe_calls) == [
        ["check_citations", "get_task_events", "get_task_summary"],
        ["check_citations", "list_rules", "search_recipes"],
    ]
    # 두 전문가가 모두 돌았음이 궤적에 남는다.
    probe_nodes = [step for step in res.steps if step.nodeName == "probe"]
    assert sum(1 for step in probe_nodes if step.eventKind == "node.completed") == 2
    narrate("recipe-scan :: 계획한 전문가들이 각자 도구만 쥐고 병렬로 돈다", chat, res)


async def test_전문가_하나가_무너져도_그래프가_완주하고_나머지가_합쳐진다(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class OneProbeFails(FakeToolLoopChat):
        async def ainvoke(self, messages: list[object]) -> object:
            names = {getattr(tool, "name", "") for tool in self.bound_tools}
            # rules 전문가만 골라 무너뜨린다. 조율자는 RecipeDraft를 쥐므로 걸리지 않는다.
            if "ProbeReport" in names and "list_rules" in names:
                raise RuntimeError("rules probe blew up")
            return await super().ainvoke(messages)

    plan = DispatchPlan(
        probes=[
            {"probe": "timeline", "rounds": 4, "question": "무엇을 했나"},  # type: ignore[list-item]
            {"probe": "rules", "rounds": 3, "question": "어떤 규칙이"},  # type: ignore[list-item]
        ]
    )
    chat = OneProbeFails([{"recipes": []}], plan=plan)

    res = await _run(monkeypatch, chat)

    # 한 전문가가 예외를 던져도 잡은 실패하지 않고 완주한다.
    assert res.error is None and res.data == {"recipes": []}
    probe_nodes = [step for step in res.steps if step.nodeName == "probe"]
    # 두 분기 모두 노드로는 완주하고, 실패로 무너진 분기는 없다.
    assert sum(1 for step in probe_nodes if step.eventKind == "node.completed") == 2
    assert not any(step.eventKind == "node.failed" for step in probe_nodes)
    narrate("recipe-scan :: 전문가 하나가 무너져도 그래프가 완주하고 나머지가 합쳐진다", chat, res)
