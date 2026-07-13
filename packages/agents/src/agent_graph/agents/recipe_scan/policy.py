"""recipe-scan의 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from .models import ProvenanceCatalog, RecipeCandidate, RecipeScanState

MAX_GATHER_ROUNDS = 2
MAX_RECIPE_MODEL_COST_USD = 2.0
RECIPE_MAX_OUTPUT_TOKENS = 16_000

AssessRoute = Callable[[RecipeScanState], Literal["plan_evidence", "synthesize", "empty"]]
ValidationRoute = Callable[[RecipeScanState], Literal["repair", "finalize", "empty"]]


def validate_recipe_candidate(
    candidate: RecipeCandidate | None,
    anchor_task_id: str,
    provenance: ProvenanceCatalog,
) -> list[str]:
    """recipe 후보가 수집한 출처만 인용하는지 검증한다."""
    if candidate is None:
        return ["No recipe candidate was produced."]
    errors: list[str] = []
    slices = {item.taskId: item for item in candidate.contributing_slices}
    if anchor_task_id not in slices:
        errors.append(f"contributing_slices must include anchor task {anchor_task_id}.")
    elif not slices[anchor_task_id].eventIds:
        errors.append("The anchor contributing slice must cite at least one anchor event ID.")
    all_event_ids = set().union(*provenance.eventIdsByTask.values()) if provenance.eventIdsByTask else set()
    cited_event_ids: set[str] = set()
    for item in candidate.contributing_slices:
        if item.taskId not in provenance.taskIds:
            errors.append(f"Unsupported contributing task ID: {item.taskId}.")
        supported = provenance.eventIdsByTask.get(item.taskId, set())
        unknown = sorted(set(item.eventIds) - supported)
        if unknown:
            errors.append(f"Unsupported event IDs for task {item.taskId}: {', '.join(unknown)}.")
        cited_event_ids.update(item.eventIds)
    if not cited_event_ids:
        errors.append("At least one representative event ID must be cited in contributing_slices.")
    for index, correction in enumerate(candidate.corrections):
        unknown = sorted(set(correction.evidence) - all_event_ids)
        if unknown:
            errors.append(f"Correction {index + 1} cites unsupported event IDs: {', '.join(unknown)}.")
    for index, pitfall in enumerate(candidate.pitfalls):
        unknown = sorted(set(pitfall.evidence) - all_event_ids)
        if unknown:
            errors.append(f"Pitfall {index + 1} cites unsupported event IDs: {', '.join(unknown)}.")
    unknown_rules = sorted(set(candidate.governing_rules) - provenance.ruleIds)
    if unknown_rules:
        errors.append(f"Unsupported governing rule IDs: {', '.join(unknown_rules)}.")
    if candidate.revises_recipe_id and candidate.revises_recipe_id not in provenance.recipeIds:
        errors.append(f"Unsupported revises_recipe_id: {candidate.revises_recipe_id}.")
    return errors


def build_routes(trace: ExecutionTrace) -> tuple[AssessRoute, ValidationRoute]:
    """증거 충분성·후보 검증 결과에 따른 분기 함수를 만든다."""

    def route_assessment(state: RecipeScanState) -> Literal["plan_evidence", "synthesize", "empty"]:
        assessment = state["assessment"]
        if assessment is not None and assessment.sufficient:
            route: Literal["plan_evidence", "synthesize", "empty"] = "synthesize"
            reason = assessment.reason
        elif state["gather_rounds"] < MAX_GATHER_ROUNDS:
            route = "plan_evidence"
            reason = assessment.reason if assessment else "No assessment was produced."
        else:
            route = "empty"
            reason = assessment.reason if assessment else "Evidence budget was exhausted."
        trace.record_graph_event(
            "route.selected",
            f"assess_evidence -> {route}: {reason}",
            node_name="assess_evidence",
        )
        return route

    def route_validation(state: RecipeScanState) -> Literal["repair", "finalize", "empty"]:
        if not state["validation_errors"]:
            route: Literal["repair", "finalize", "empty"] = "finalize"
            reason = "candidate passed deterministic provenance validation"
        elif not state["repair_attempted"]:
            route = "repair"
            reason = "candidate failed validation and the one repair attempt is available"
        else:
            route = "empty"
            reason = "candidate remained invalid after the repair attempt"
        trace.record_graph_event(
            "route.selected",
            f"validate_candidate -> {route}: {reason}",
            node_name="validate_candidate",
        )
        return route

    return route_assessment, route_validation
