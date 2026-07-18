"""에이전트 실행 한 번이 태우는 모델 비용을 누적하고 상한에서 끊는다."""

from __future__ import annotations

from langchain_core.messages import AIMessage

from ..errors import BudgetExceeded
from ..pricing import estimate_cost_usd
from .trajectory import extract_token_usage


class ToolLoopBudget:
    """루프 한 번의 모델 비용을 누적하고 상한에서 끊는다."""

    def __init__(self, agent_name: str, model_name: str, max_cost_usd: float, spent: float = 0.0) -> None:
        self._agent = agent_name
        self._model = model_name
        self._max = max_cost_usd
        self.spent = spent

    def charge(self, message: AIMessage) -> None:
        usage = extract_token_usage(message)
        cost = estimate_cost_usd(self._model, usage.to_dto()) if usage else None
        if cost is None:
            raise BudgetExceeded(f"{self._agent} cannot enforce its internal budget for model {self._model}")
        self.spent += cost
        if self.spent > self._max:
            raise BudgetExceeded(f"{self._agent} exceeded internal model budget ${self._max:.2f}")
