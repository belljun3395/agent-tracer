"""recipe-scan 노드를 그래프 밖에서 직접 실행해 실패 강등을 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

from typing import Any

from agent_graph.agents.recipe_scan.models import (
    ProbeAssignment,
    ProbeDispatch,
    RecipeScanRequest,
)
from agent_graph.agents.recipe_scan.nodes.probe import ProbeNode
from agent_graph.agents.recipe_scan.reader import RecipeLedgerReader
from agent_graph.agents.recipe_scan.search import RecipeSearchReader
from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from tests.support.fakes import FakeLedger, FakeSearch, FakeToolLoopChat

_COMPLETION = {"url": "http://worker:8810/runs/complete", "token": "done-recipe"}


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


async def test_전문가_실행_예외는_실패_보고로_강등된다() -> None:
    class BoomChat(FakeToolLoopChat):
        async def ainvoke(self, _messages: list[object]) -> object:
            raise RuntimeError("agent blew up")

    req = _request()
    node = ProbeNode(
        req,
        RecipeLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        RecipeSearchReader(FakeSearch(), "user-1"),  # type: ignore[arg-type]
        ExecutionTrace(),
        BoomChat([]),
        None,
        agent_name="recipe-scan",
    )

    result = await node.run(
        ProbeDispatch(
            assignment=ProbeAssignment(probe="timeline", rounds=2, question="무엇"),
            cost_budget=1.0,
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
