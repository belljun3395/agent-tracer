"""task-cleanup 후보 판단과 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ...runtime.serialization import json_value
from ..evidence import evidence_context, evidence_snapshot
from ..models import CleanupAssessment, CleanupDraft, TaskCleanupRequest, TaskCleanupState
from ..policy import TASK_CLEANUP_MAX_MODEL_COST_USD, advance_candidate_batch, validate_suggestions
from ..prompts import ASSESSOR_SYSTEM_PROMPT, LANGUAGE_DIRECTIVES, REPAIR_SYSTEM_PROMPT

type CleanupNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]


def create_decision_nodes(
    req: TaskCleanupRequest,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[CleanupNode, CleanupNode, CleanupNode, CleanupNode]:
    """후보 판단과 결정 검증 노드를 모델과 실행 추적에 결합한다."""

    async def assess_candidates(state: TaskCleanupState) -> dict[str, Any]:
        evidence, provenance = evidence_snapshot(state["evidence"])
        chain_prompt = prompt(
            ASSESSOR_SYSTEM_PROMPT,
            "Scan time: {scanned_at}\n"
            "Output language: {language}\n"
            "Maximum suggestions: {max_suggestions}\n"
            "Candidates: {candidates}\n"
            "Inspected evidence: {evidence}\n"
            "Known event provenance: {provenance}\n"
            "Prior assessment: {prior_assessment}\n"
            "Return conservative cleanup decisions and whether another evidence round is needed.",
        )
        assessment, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "scanned_at": state["scanned_at"],
                "language": LANGUAGE_DIRECTIVES[state["language"]],
                "max_suggestions": state["max_suggestions"] - len(state["accepted_suggestions"]),
                "candidates": json_value(state["model_candidates"]),
                "evidence": evidence,
                "provenance": json_value(provenance),
                "prior_assessment": (json_value(state["assessment"]) if state["assessment"] else "(none)"),
            },
            CleanupAssessment,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=TASK_CLEANUP_MAX_MODEL_COST_USD,
        )
        return {"assessment": assessment, "model_cost_usd": cost}

    async def validate_decisions(state: TaskCleanupState) -> dict[str, Any]:
        suggestions = state["assessment"].suggestions if state["assessment"] else []
        valid, invalid, errors = validate_suggestions(suggestions, state)
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_decisions",
            )
        return {
            "valid_suggestions": valid,
            "invalid_suggestions": invalid,
            "validation_errors": errors,
        }

    async def repair(state: TaskCleanupState) -> dict[str, Any]:
        chain_prompt = prompt(
            REPAIR_SYSTEM_PROMPT,
            "Invalid suggestions: {invalid}\n"
            "Validation errors: {errors}\n"
            "Candidates: {candidates}\n"
            "Output language: {language}\n"
            "Inspected evidence: {evidence}\n"
            "Event provenance: {provenance}\n"
            "Return repaired suggestions only.",
        )
        repaired, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "invalid": json_value(state["invalid_suggestions"]),
                "errors": json_value(state["validation_errors"]),
                "candidates": json_value(state["model_candidates"]),
                "language": LANGUAGE_DIRECTIVES[state["language"]],
                "evidence": evidence_context(state["evidence"]),
                "provenance": json_value(state["event_ids_by_task"]),
            },
            CleanupDraft,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=TASK_CLEANUP_MAX_MODEL_COST_USD,
        )
        preserved = state["valid_suggestions"]
        assessment = CleanupAssessment(
            rationale="Preserved valid suggestions and repaired only invalid suggestions.",
            suggestions=[*preserved, *repaired.suggestions],
        )
        return {
            "assessment": assessment,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    async def accept_batch(state: TaskCleanupState) -> dict[str, Any]:
        return advance_candidate_batch(state)

    return assess_candidates, validate_decisions, repair, accept_batch
