"""recipe-scan 후보를 외부 응답으로 만드는 종단 그래프 노드를 제공한다."""

from __future__ import annotations

from typing import Any

from ..models import RecipeScanState


async def finalize(state: RecipeScanState) -> dict[str, Any]:
    """검증된 후보 목록을 레시피 결과로 직렬화한다."""
    recipes = [candidate.model_dump(mode="json", exclude_none=True) for candidate in state["candidates"]]
    return {"result": {"recipes": recipes}}


async def empty(_state: RecipeScanState) -> dict[str, Any]:
    """후보가 없는 레시피 결과를 반환한다."""
    return {"result": {"recipes": []}}
