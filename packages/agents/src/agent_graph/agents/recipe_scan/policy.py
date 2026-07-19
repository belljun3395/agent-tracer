"""recipe-scan의 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from .models import (
    MAX_RECIPE_CANDIDATES,
    DispatchPlan,
    ProvenanceCatalog,
    RecipeCandidate,
    RecipeScanState,
)

# 계획을 세우는 데 한 라운드를 쓰므로 배분 가능한 조사 라운드는 그만큼 줄어든다.
SURVEY_ROUNDS = 1

# 조율자는 조사를 전문가에게 맡겼으므로 종합과 인용 확인에 필요한 만큼만 쓴다.
SYNTHESIS_ROUNDS = 3

MAX_RECIPE_MODEL_COST_USD = 2.0
RECIPE_MAX_OUTPUT_TOKENS = 16_000

ValidationRoute = Callable[[RecipeScanState], Literal["repair", "finalize", "empty"]]


def clamp_plan(plan: DispatchPlan, available: int) -> tuple[DispatchPlan, int]:
    """조율자의 배분을 남은 예산 안으로 비례 축소하고 깎인 라운드 수를 함께 돌려준다."""
    requested = plan.total_rounds()
    if requested <= available:
        return plan, 0
    # 전문가마다 최소 한 라운드는 남겨야 계획이 의미를 잃지 않는다.
    floor = len(plan.probes)
    spare = max(available - floor, 0)
    over = requested - floor
    granted = [1 + ((probe.rounds - 1) * spare // over if over else 0) for probe in plan.probes]
    # 몫을 나눈 나머지는 많이 요구한 순서대로 한 라운드씩 돌려주어 예산을 흘리지 않는다.
    order = sorted(range(len(granted)), key=lambda index: plan.probes[index].rounds, reverse=True)
    for index in order[: max(available - sum(granted), 0)]:
        granted[index] += 1
    shrunk = [
        probe.model_copy(update={"rounds": rounds})
        for probe, rounds in zip(plan.probes, granted, strict=True)
    ]
    clamped = DispatchPlan(probes=shrunk)
    return clamped, requested - clamped.total_rounds()


def validate_recipe_candidates(
    candidates: list[RecipeCandidate],
    anchor_task_id: str,
    provenance: ProvenanceCatalog,
) -> list[str]:
    """후보 목록이 수집한 출처만 인용하고 같은 turn을 두 번 쓰지 않는지 검증한다."""
    # 근거가 없으면 후보를 내지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다.
    if not candidates:
        return []
    if len(candidates) > MAX_RECIPE_CANDIDATES:
        return [f"At most {MAX_RECIPE_CANDIDATES} recipe candidates may be returned."]
    errors: list[str] = []
    for index, candidate in enumerate(candidates, start=1):
        errors.extend(
            f"Recipe {index}: {error}"
            for error in validate_recipe_candidate(candidate, anchor_task_id, provenance)
        )
    errors.extend(_duplicate_turn_errors(candidates))
    return errors


def _duplicate_turn_errors(candidates: list[RecipeCandidate]) -> list[str]:
    claimed: dict[tuple[str, str], int] = {}
    errors: list[str] = []
    for index, candidate in enumerate(candidates, start=1):
        for item in candidate.contributing_slices:
            for turn_id in item.turnIds:
                owner = claimed.setdefault((item.taskId, turn_id), index)
                if owner != index:
                    errors.append(f"Recipe {index}: turn {turn_id} was already claimed by recipe {owner}.")
    return errors


def validate_recipe_candidate(
    candidate: RecipeCandidate,
    anchor_task_id: str,
    provenance: ProvenanceCatalog,
) -> list[str]:
    """recipe 후보가 수집한 출처만 인용하는지 검증한다."""
    errors: list[str] = []
    slices = {item.taskId: item for item in candidate.contributing_slices}
    if anchor_task_id not in slices:
        errors.append(f"contributing_slices must include anchor task {anchor_task_id}.")
    elif not slices[anchor_task_id].eventIds:
        errors.append("The anchor contributing slice must cite at least one anchor event ID.")
    all_event_ids = set().union(*provenance.eventIdsByTask.values()) if provenance.eventIdsByTask else set()
    cited_event_ids: set[str] = set()
    for item in candidate.contributing_slices:
        # 목록에 이름만 오른 태스크는 근거가 아니라 이벤트를 읽은 태스크만 기여할 수 있다.
        if item.taskId not in provenance.eventIdsByTask:
            errors.append(f"Unsupported contributing task ID: {item.taskId}.")
        unknown_turns = sorted(set(item.turnIds) - provenance.turnIdsByTask.get(item.taskId, set()))
        if unknown_turns:
            errors.append(f"Unsupported turn IDs for task {item.taskId}: {', '.join(unknown_turns)}.")
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


def build_routes(trace: ExecutionTrace) -> ValidationRoute:
    """검증 결과에 따른 분기 함수를 만든다."""

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

    return route_validation
