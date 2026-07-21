"""task-cleanup의 결정 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.orchestration import clamp_rounds
from ..runtime.routing import build_validation_router
from .models import (
    CleanupDraftSuggestion,
    InspectAssignment,
    TaskCleanupState,
    TriagePlan,
)

TASK_CLEANUP_MAX_OUTPUT_TOKENS = 16_000
TASK_CLEANUP_MAX_MODEL_COST_USD = 0.5
# 모델이 스스로 도구를 고르므로 라운드 수가 곧 조사 예산이다.
MAX_TOOL_ROUNDS = 16

# 후보 목록을 훑는 데 쓰는 라운드와, 조사를 마친 뒤 제안을 쓰는 데 남기는 라운드다.
TRIAGE_ROUNDS = 3
DECISION_ROUNDS = 3


def inspection_rounds() -> int:
    """선별과 결정에 쓰고 남은, 후보를 열어보는 데 배분 가능한 라운드다."""
    return MAX_TOOL_ROUNDS - TRIAGE_ROUNDS - DECISION_ROUNDS


def decision_rounds(plan: TriagePlan | None) -> int:
    """선별과 조사에 쓰고 남은, 조율자가 제안을 쓰는 데 갖는 라운드다."""
    if plan is None:
        return MAX_TOOL_ROUNDS
    return max(MAX_TOOL_ROUNDS - TRIAGE_ROUNDS - plan.total_rounds(), DECISION_ROUNDS)


def clamp_triage(plan: TriagePlan, available: int) -> tuple[TriagePlan, int]:
    """조율자의 배분을 남은 예산 안으로 비례 축소하고 깎인 라운드 수를 함께 돌려준다."""
    requested = plan.total_rounds()
    if requested <= available or not plan.assignments:
        return plan, 0
    floor = len(plan.assignments)
    if floor > available:
        # 열어볼 후보가 예산보다 많으면 많이 요구한 순서대로 남길 만큼만 남긴다.
        ranked = sorted(plan.assignments, key=lambda item: item.rounds, reverse=True)[:available]
        kept = TriagePlan(inspect=[item.model_copy(update={"rounds": 1}) for item in ranked])
        return kept, requested - kept.total_rounds()
    granted = clamp_rounds(plan.assignments, available)
    shrunk: list[InspectAssignment] = [
        item.model_copy(update={"rounds": rounds})
        for item, rounds in zip(plan.assignments, granted, strict=True)
    ]
    clamped = TriagePlan(inspect=shrunk)
    return clamped, requested - clamped.total_rounds()


# 한 라운드가 langchain agent의 네 슈퍼스텝을 돌므로 재귀 한도는 예산이 아니라 폭주만 끊는 그물이다.
AGENT_RECURSION_LIMIT = 10 * MAX_TOOL_ROUNDS

ValidationRoute = Callable[[TaskCleanupState], Literal["repair", "finalize", "empty"]]


def validate_suggestions(
    suggestions: list[CleanupDraftSuggestion],
    state: TaskCleanupState,
) -> tuple[list[CleanupDraftSuggestion], list[str]]:
    """정리 제안이 도구가 돌려준 후보와 이벤트만 인용하는지 검증한다."""
    exposed = state["exposed_candidates"]
    valid: list[CleanupDraftSuggestion] = []
    errors: list[str] = []
    seen: set[str] = set()
    for suggestion in suggestions:
        item_errors: list[str] = []
        candidate = exposed.get(suggestion.taskId)
        if candidate is None:
            item_errors.append(f"unsupported candidate task ID {suggestion.taskId}")
        if suggestion.taskId in seen:
            item_errors.append(f"duplicate suggestion for task {suggestion.taskId}")
        seen.add(suggestion.taskId)
        inspected = suggestion.taskId in state["event_ids_by_task"]
        supported_events = state["event_ids_by_task"].get(suggestion.taskId, set())
        cited_events = set(suggestion.evidenceEventIds)
        unknown_events = sorted(cited_events - supported_events)
        if unknown_events:
            item_errors.append(
                f"unsupported event IDs for task {suggestion.taskId}: {', '.join(unknown_events)}"
            )
        if candidate is not None and candidate.hasEvents and not inspected:
            item_errors.append(f"eventful task {suggestion.taskId} was never inspected")
        elif supported_events and not cited_events:
            item_errors.append(f"eventful task {suggestion.taskId} has no inspected event evidence")
        if len(valid) >= state["max_suggestions"]:
            item_errors.append(f"suggestion limit {state['max_suggestions']} exceeded")
        if item_errors:
            errors.extend(item_errors)
        else:
            valid.append(suggestion)
    return valid, errors


def build_routes(trace: ExecutionTrace, validation_node: str) -> ValidationRoute:
    """검증 결과에 따른 분기 함수를 만든다."""
    return build_validation_router(
        trace,
        validation_node,
        pass_reason="suggestions passed deterministic provenance validation",
        repair_reason="suggestions failed validation and one repair attempt remains",
        exhausted_reason="invalid suggestions were dropped after the repair attempt",
        has_result=lambda state: bool(state["suggestions"]),
    )
