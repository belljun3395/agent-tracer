"""recipe-scan 후보의 합성과 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ...runtime.serialization import json_value
from ..evidence import evidence_context
from ..models import RecipeDraft, RecipeScanRequest, RecipeScanState
from ..policy import MAX_RECIPE_MODEL_COST_USD, validate_recipe_candidates
from ..prompts import LANGUAGE_DIRECTIVES, REPAIR_SYSTEM_PROMPT, SYNTHESIS_SYSTEM_PROMPT

type RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def create_candidate_nodes(
    req: RecipeScanRequest,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[RecipeNode, RecipeNode, RecipeNode]:
    """후보 합성과 결정적 검증 노드를 모델 실행 의존성에 결합한다."""

    async def synthesize(state: RecipeScanState) -> dict[str, Any]:
        chain_prompt = prompt(
            SYNTHESIS_SYSTEM_PROMPT,
            "Anchor task: {task_id}\n"
            "User direction: {user_prompt}\n"
            "Output language: {language}\n"
            "Evidence: {evidence}\n"
            "Provenance catalog: {provenance}\n"
            "Write one candidate per distinct reusable workflow.",
        )
        draft, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "task_id": state["task_id"],
                "user_prompt": state["user_prompt"] or "(none)",
                "language": LANGUAGE_DIRECTIVES[state["language"]],
                "evidence": evidence_context(state),
                "provenance": json_value(state["provenance"]),
            },
            RecipeDraft,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
        )
        return {"candidates": draft.recipes, "model_cost_usd": cost}

    async def validate_candidate(state: RecipeScanState) -> dict[str, Any]:
        errors = validate_recipe_candidates(state["candidates"], state["task_id"], state["provenance"])
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_candidate",
            )
        return {"validation_errors": errors}

    async def repair(state: RecipeScanState) -> dict[str, Any]:
        candidates = state["candidates"]
        if not candidates:
            return {"repair_attempted": True}
        chain_prompt = prompt(
            REPAIR_SYSTEM_PROMPT,
            "Invalid candidates: {candidates}\n"
            "Validation errors: {errors}\n"
            "Provenance catalog: {provenance}\n"
            "Evidence: {evidence}\n"
            "Return the complete repaired candidate list.",
        )
        repaired, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "candidates": json_value(candidates),
                "errors": json_value(state["validation_errors"]),
                "provenance": json_value(state["provenance"]),
                "evidence": evidence_context(state),
            },
            RecipeDraft,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
        )
        return {
            "candidates": repaired.recipes,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return synthesize, validate_candidate, repair
