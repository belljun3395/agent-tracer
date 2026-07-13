"""task-cleanup의 결정 검증과 후보 배치 분기 정책을 소유한다."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from ..runtime.execution.trace import ExecutionTrace
from .models import CleanupDraftSuggestion, TaskCleanupState
from .tools import MAX_EVENT_READS

MAX_GATHER_ROUNDS = 2
CANDIDATE_BATCH_SIZE = 100
TASK_CLEANUP_MAX_OUTPUT_TOKENS = 16_000
TASK_CLEANUP_MAX_MODEL_COST_USD = 0.5

BootstrapRoute = Callable[[TaskCleanupState], Literal["plan_inspection", "empty"]]
AssessmentRoute = Callable[[TaskCleanupState], Literal["plan_inspection", "validate_decisions"]]
ValidationRoute = Callable[[TaskCleanupState], Literal["repair", "accept_batch"]]
BatchRoute = Callable[[TaskCleanupState], Literal["plan_inspection", "finalize", "empty"]]


def validate_suggestions(
    suggestions: list[CleanupDraftSuggestion],
    state: TaskCleanupState,
) -> tuple[list[CleanupDraftSuggestion], list[CleanupDraftSuggestion], list[str]]:
    """정리 제안이 노출된 후보와 수집한 이벤트만 인용하는지 검증한다."""
    exposed = {candidate.id: candidate for candidate in state["model_candidates"]}
    valid: list[CleanupDraftSuggestion] = []
    invalid: list[CleanupDraftSuggestion] = []
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
        supported_events = state["event_ids_by_task"].get(suggestion.taskId, set())
        cited_events = set(suggestion.evidenceEventIds)
        unknown_events = sorted(cited_events - supported_events)
        if unknown_events:
            item_errors.append(
                f"unsupported event IDs for task {suggestion.taskId}: {', '.join(unknown_events)}"
            )
        if candidate is not None and candidate.hasEvents and not cited_events:
            item_errors.append(f"eventful task {suggestion.taskId} has no inspected event evidence")
        remaining = state["max_suggestions"] - len(state["accepted_suggestions"])
        if len(valid) >= remaining:
            item_errors.append(f"suggestion limit {state['max_suggestions']} exceeded")
        if item_errors:
            invalid.append(suggestion)
            errors.extend(item_errors)
        else:
            valid.append(suggestion)
    return valid, invalid, errors


def advance_candidate_batch(state: TaskCleanupState) -> dict[str, Any]:
    """검증한 제안을 보존하고 다음 후보 배치를 준비한다."""
    accepted = [*state["accepted_suggestions"], *state["valid_suggestions"]]
    offset = state["candidate_offset"]
    next_batch = (
        state["candidates"][offset : offset + CANDIDATE_BATCH_SIZE]
        if len(accepted) < state["max_suggestions"]
        else []
    )
    return {
        "accepted_suggestions": accepted[: state["max_suggestions"]],
        "model_candidates": next_batch,
        "candidate_offset": offset + len(next_batch),
        "evidence": [],
        "event_ids_by_task": {},
        "plan": None,
        "assessment": None,
        "gather_rounds": 0,
        "valid_suggestions": [],
        "invalid_suggestions": [],
        "validation_errors": [],
        "repair_attempted": False,
    }


def build_routes(
    trace: ExecutionTrace,
) -> tuple[BootstrapRoute, AssessmentRoute, ValidationRoute, BatchRoute]:
    """후보·증거·검증 상태에 따른 네 조건부 분기 함수를 만든다."""

    def route_bootstrap(state: TaskCleanupState) -> Literal["plan_inspection", "empty"]:
        route: Literal["plan_inspection", "empty"] = (
            "plan_inspection" if state["model_candidates"] else "empty"
        )
        trace.record_graph_event(
            "route.selected",
            f"bootstrap_candidates -> {route}",
            node_name="bootstrap_candidates",
        )
        return route

    def route_assessment(
        state: TaskCleanupState,
    ) -> Literal["plan_inspection", "validate_decisions"]:
        assessment = state["assessment"]
        can_read_more = state["gather_rounds"] < MAX_GATHER_ROUNDS and state["event_reads"] < MAX_EVENT_READS
        route: Literal["plan_inspection", "validate_decisions"] = (
            "plan_inspection"
            if assessment is not None and assessment.needsMoreEvidence and can_read_more
            else "validate_decisions"
        )
        trace.record_graph_event(
            "route.selected",
            f"assess_candidates -> {route}",
            node_name="assess_candidates",
        )
        return route

    def route_validation(state: TaskCleanupState) -> Literal["repair", "accept_batch"]:
        if state["invalid_suggestions"] and not state["repair_attempted"]:
            route: Literal["repair", "accept_batch"] = "repair"
        else:
            route = "accept_batch"
        trace.record_graph_event(
            "route.selected",
            f"validate_decisions -> {route}",
            node_name="validate_decisions",
        )
        return route

    def route_batch(state: TaskCleanupState) -> Literal["plan_inspection", "finalize", "empty"]:
        if state["model_candidates"]:
            route: Literal["plan_inspection", "finalize", "empty"] = "plan_inspection"
        elif state["accepted_suggestions"]:
            route = "finalize"
        else:
            route = "empty"
        trace.record_graph_event(
            "route.selected",
            f"accept_batch -> {route}",
            node_name="accept_batch",
        )
        return route

    return route_bootstrap, route_assessment, route_validation, route_batch
