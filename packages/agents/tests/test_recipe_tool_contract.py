"""recipe-scan 도구 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, get_args

from agent_graph.agents.recipe_scan.models import MAX_RECIPE_CANDIDATES, MAX_TOOL_ROUNDS
from agent_graph.agents.recipe_scan.policy import MAX_RECIPE_MODEL_COST_USD, RECIPE_MAX_OUTPUT_TOKENS
from agent_graph.agents.recipe_scan.tools.contracts import SearchEventsArgs, TimelineEventKind

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"


def _contract() -> Any:
    return json.loads((GOLDEN / "recipe.scan.tool.contract.json").read_text(encoding="utf-8"))


def test_턴_예산이_골든_계약과_같다() -> None:
    assert MAX_TOOL_ROUNDS == _contract()["maxTurns"]


def test_후보_상한과_토큰과_비용_예산이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert MAX_RECIPE_CANDIDATES == limits["candidateLimit"]
    assert RECIPE_MAX_OUTPUT_TOKENS == limits["maxOutputTokens"]
    assert MAX_RECIPE_MODEL_COST_USD == limits["maxBudgetUsd"]


def test_search_events의_필수와_선택_인자가_골든_계약과_같다() -> None:
    contract = _contract()["searchEvents"]

    required = {name for name, field in SearchEventsArgs.model_fields.items() if field.is_required()}
    optional = set(SearchEventsArgs.model_fields) - required

    assert required == set(contract["required"])
    assert optional == set(contract["optional"])


def test_search_events가_거르는_이벤트_종류가_골든_계약과_같다() -> None:
    assert list(get_args(TimelineEventKind)) == _contract()["searchEvents"]["kinds"]
