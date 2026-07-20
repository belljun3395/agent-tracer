"""recipe-scan 후보를 외부 응답으로 만드는 종단 그래프 노드를 제공한다."""

from __future__ import annotations

from ...runtime.node import GraphNode
from ...runtime.validation_graph import EMPTY, FINALIZE
from ..models import RecipeScanState, ResultUpdate


class FinalizeNode(GraphNode):
    """검증된 후보 목록을 레시피 결과로 직렬화한다."""

    name = FINALIZE

    async def run(self, state: RecipeScanState) -> ResultUpdate:
        recipes = [
            candidate.model_dump(mode="json", exclude_none=True)
            for candidate in state["candidates"]
        ]
        return {"result": {"recipes": recipes}}


class EmptyNode(GraphNode):
    """후보가 없는 레시피 결과를 반환한다."""

    name = EMPTY

    async def run(self, _state: RecipeScanState) -> ResultUpdate:
        return {"result": {"recipes": []}}
