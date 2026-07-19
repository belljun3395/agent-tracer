from __future__ import annotations

import json
from pathlib import Path

from agent_graph.agents.runtime.pricing import _RATES, estimate_cost_usd
from agent_graph.agents.shared.models import UsageDTO

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"


def test_단가가_골든_계약과_같다() -> None:
    contract = json.loads((GOLDEN / "model.pricing.json").read_text(encoding="utf-8"))["rates"]

    assert {
        name: {
            "input": rate.input,
            "output": rate.output,
            "cacheWrite": rate.cache_write,
            "cacheRead": rate.cache_read,
        }
        for name, rate in _RATES.items()
    } == contract


def _usage() -> UsageDTO:
    return UsageDTO(
        inputTokens=1_000_000,
        outputTokens=1_000_000,
        cacheReadTokens=0,
        cacheCreationTokens=0,
    )


class TestEstimateCost:
    def test_sonnet_요율로_계산한다(self) -> None:
        # 1M input($3) + 1M output($15) = $18.
        assert estimate_cost_usd("claude-sonnet-4-6", _usage()) == 18.0

    def test_haiku_요율로_계산한다(self) -> None:
        # 1M input($1) + 1M output($5) = $6.
        assert estimate_cost_usd("claude-haiku-4-5", _usage()) == 6.0

    def test_모르는_모델은_None(self) -> None:
        assert estimate_cost_usd("gpt-4o", _usage()) is None

    def test_usage가_없으면_None(self) -> None:
        assert estimate_cost_usd("claude-sonnet-4-6", None) is None

    def test_캐시_토큰도_반영한다(self) -> None:
        usage = UsageDTO(
            inputTokens=0, outputTokens=0, cacheReadTokens=1_000_000, cacheCreationTokens=1_000_000
        )
        # 캐시 읽기 0.30달러와 캐시 쓰기 3.75달러를 더하면 4.05달러다.
        assert estimate_cost_usd("claude-sonnet-4-6", usage) == 4.05
