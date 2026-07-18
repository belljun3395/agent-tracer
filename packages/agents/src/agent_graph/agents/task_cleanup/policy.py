"""task-cleanup의 결정 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from .models import CleanupDraftSuggestion, TaskCleanupState

TASK_CLEANUP_MAX_OUTPUT_TOKENS = 16_000
TASK_CLEANUP_MAX_MODEL_COST_USD = 0.5
# 모델이 스스로 도구를 고르므로 라운드 수가 곧 조사 예산이다.
MAX_TOOL_ROUNDS = 16

# 라운드 예산은 agent의 호출 한도가 집행한다. 한 라운드가 before_model·model·after_model·tools
# 네 슈퍼스텝을 도는 데다 미들웨어를 더하면 더 늘어나므로, 재귀 한도는 예산을 세는 자리가 아니라
# 폭주만 끊는 그물이다.
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


def build_routes(trace: ExecutionTrace) -> ValidationRoute:
    """검증 결과에 따른 분기 함수를 만든다."""

    def route_validation(state: TaskCleanupState) -> Literal["repair", "finalize", "empty"]:
        if not state["validation_errors"]:
            route: Literal["repair", "finalize", "empty"] = (
                "finalize" if state["suggestions"] else "empty"
            )
            reason = "suggestions passed deterministic provenance validation"
        elif not state["repair_attempted"]:
            route = "repair"
            reason = "suggestions failed validation and one repair attempt remains"
        else:
            route = "finalize" if state["suggestions"] else "empty"
            reason = "invalid suggestions were dropped after the repair attempt"
        trace.record_graph_event(
            "route.selected",
            f"validate_decisions -> {route}: {reason}",
            node_name="validate_decisions",
        )
        return route

    return route_validation
