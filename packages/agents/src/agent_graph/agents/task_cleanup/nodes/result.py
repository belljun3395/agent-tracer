"""task-cleanup의 외부 결과를 만드는 종단 그래프 노드를 제공한다."""

from __future__ import annotations

from typing import Any

from ..models import TaskCleanupState


async def finalize(state: TaskCleanupState) -> dict[str, Any]:
    """검증된 제안을 보관 작업 결과로 직렬화한다."""
    suggestions = [
        {"kind": "archive", "taskId": item.taskId, "rationale": item.rationale}
        for item in state["suggestions"][: state["max_suggestions"]]
    ]
    return {"result": {"suggestions": suggestions}}


async def empty(_state: TaskCleanupState) -> dict[str, Any]:
    """제안이 없는 정리 작업 결과를 반환한다."""
    return {"result": {"suggestions": []}}
