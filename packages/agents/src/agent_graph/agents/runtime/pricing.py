"""Python-native 그래프의 지출 서킷브레이커용 근사 단가표."""

from __future__ import annotations

from dataclasses import dataclass

from ..shared.models import UsageDTO


@dataclass(frozen=True)
class ModelRate:
    """모델별 백만 토큰당 달러 단가다."""

    input: float
    output: float
    cache_write: float
    cache_read: float


_RATES: dict[str, ModelRate] = {
    "sonnet": ModelRate(input=3.0, output=15.0, cache_write=3.75, cache_read=0.30),
    "haiku": ModelRate(input=1.0, output=5.0, cache_write=1.25, cache_read=0.10),
}


def _rate_for(model: str) -> ModelRate | None:
    lowered = model.lower()
    for key, rate in _RATES.items():
        if key in lowered:
            return rate
    return None


# 이 값은 그래프 내부 예산 상한에만 쓰고 보고·저장용 costUsd는 ai-agent-worker가 별도 단가표로 환산한다.
def estimate_cost_usd(model: str, usage: UsageDTO | None) -> float | None:
    rate = _rate_for(model)
    if rate is None or usage is None:
        return None
    cost = (
        usage.inputTokens * rate.input
        + usage.outputTokens * rate.output
        + usage.cacheCreationTokens * rate.cache_write
        + usage.cacheReadTokens * rate.cache_read
    ) / 1_000_000
    return round(cost, 6)
