"""에이전트 실행 한 번이 태우는 모델 비용을 누적하고 상한에서 끊는다."""

from __future__ import annotations

from langchain_core.messages import AIMessage

from ..errors import BudgetExceeded
from ..pricing import estimate_cost_usd
from .trajectory import extract_token_usage, message_identity


class ToolLoopBudget:
    """루프 한 번의 모델 비용을 누적하고 상한에서 끊는다."""

    def __init__(self, agent_name: str, model_name: str, max_cost_usd: float, spent: float = 0.0) -> None:
        self._agent = agent_name
        self._model = model_name
        self._max = max_cost_usd
        self._peak = 0.0
        self._landed = False
        self._spent = spent

    @property
    def spent(self) -> float:
        """이 루프가 지금까지 태운 모델 비용이다."""
        return self._spent

    @property
    def landing(self) -> bool:
        """지금까지 가장 비쌌던 호출을 한 번 더 감당할 수 없는지 알린다."""
        return self._spent + self._peak >= self._max

    def land(self) -> None:
        """결론만 받는 마지막 호출로 넘어갔음을 알린다."""
        self._landed = True

    def charge(self, message: AIMessage) -> None:
        usage = extract_token_usage(message)
        # 폴백이 걸리면 응답이 primary와 다른 모델에서 왔으므로 실제 응답 모델로 단가를 고른다.
        actual_model, _request_id = message_identity(message)
        priced_model = actual_model or self._model
        cost = estimate_cost_usd(priced_model, usage.to_dto()) if usage else None
        if cost is None:
            raise BudgetExceeded(f"{self._agent} cannot enforce its internal budget for model {priced_model}")
        self._spent += cost
        self._peak = max(self._peak, cost)
        # 착지한 뒤의 지출은 이미 끝난 실행의 마지막 호출이라 끊어봐야 산출물만 잃는다.
        if not self._landed and self._spent > self._max:
            raise BudgetExceeded(f"{self._agent} exceeded internal model budget ${self._max:.2f}")
