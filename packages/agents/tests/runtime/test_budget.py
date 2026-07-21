"""ToolLoopBudget이 실제 응답 모델로 과금하는지 검증한다(페이크 모델, 네트워크 없음)."""

from __future__ import annotations

import pytest

from agent_graph.agents.runtime.errors import BudgetExceeded
from agent_graph.agents.runtime.llm.budget import ToolLoopBudget
from tests.support.fakes import mk_ai

_USAGE = {
    "input_tokens": 1_000_000,
    "output_tokens": 0,
    "total_tokens": 1_000_000,
    "input_token_details": {"cache_read": 0, "cache_creation": 0},
}


def test_실제_응답_모델로_단가를_매긴다() -> None:
    # sonnet 생성자로 열어도 응답이 haiku에서 왔으면 haiku 단가($1/1M input)로 매긴다.
    budget = ToolLoopBudget("agent", "claude-sonnet-4-6", 10.0)
    message = mk_ai(usage=_USAGE, response_metadata={"model": "claude-haiku-4-5"})

    budget.charge(message)

    assert budget.spent == pytest.approx(1.0)


def test_응답에_모델이_없으면_생성자_모델로_매긴다() -> None:
    budget = ToolLoopBudget("agent", "claude-sonnet-4-6", 10.0)
    message = mk_ai(usage=_USAGE, response_metadata={})

    budget.charge(message)

    assert budget.spent == pytest.approx(3.0)


def test_모르는_실제_모델이면_예산을_거부한다() -> None:
    budget = ToolLoopBudget("agent", "claude-sonnet-4-6", 10.0)
    message = mk_ai(usage=_USAGE, response_metadata={"model": "gpt-4o"})

    with pytest.raises(BudgetExceeded):
        budget.charge(message)
