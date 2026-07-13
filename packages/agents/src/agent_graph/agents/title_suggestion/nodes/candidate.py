"""title-suggestion 후보의 합성과 검증과 결과 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ...runtime.serialization import json_value
from ..evidence import task_context
from ..models import TitleSuggestionDraft, TitleSuggestionRequest, TitleSuggestionState
from ..policy import MAX_TITLE_MODEL_COST_USD, validate_title_candidate
from ..prompts import LANGUAGE_DIRECTIVES, REPAIR_SYSTEM_PROMPT, SYNTHESIS_SYSTEM_PROMPT

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


def create_candidate_nodes(
    req: TitleSuggestionRequest,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[TitleNode, TitleNode, TitleNode]:
    """후보 합성과 결정적 검증 노드를 모델 실행 의존성에 결합한다."""

    async def synthesize(state: TitleSuggestionState) -> dict[str, Any]:
        chain_prompt = prompt(
            SYNTHESIS_SYSTEM_PROMPT,
            "Output language: {language}\nTask evidence: {context}\nReturn title alternatives.",
        )
        candidate, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "language": LANGUAGE_DIRECTIVES[state["language"]],
                "context": task_context(state),
            },
            TitleSuggestionDraft,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_TITLE_MODEL_COST_USD,
        )
        return {"candidate": candidate, "model_cost_usd": cost}

    async def validate_candidate(state: TitleSuggestionState) -> dict[str, Any]:
        errors = validate_title_candidate(state["candidate"], state["context"].title)
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_candidate",
            )
        return {"validation_errors": errors}

    async def repair(state: TitleSuggestionState) -> dict[str, Any]:
        candidate = state["candidate"]
        if candidate is None:
            return {"repair_attempted": True}
        chain_prompt = prompt(
            REPAIR_SYSTEM_PROMPT,
            "Output language: {language}\nCurrent title: {current_title}\nCandidate: {candidate}\n"
            "Validation errors: {errors}\nTask evidence: {context}\nReturn the repaired candidate.",
        )
        repaired, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "language": LANGUAGE_DIRECTIVES[state["language"]],
                "current_title": state["context"].title,
                "candidate": json_value(candidate),
                "errors": json_value(state["validation_errors"]),
                "context": task_context(state),
            },
            TitleSuggestionDraft,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_TITLE_MODEL_COST_USD,
        )
        return {
            "candidate": repaired,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return synthesize, validate_candidate, repair


async def finalize(state: TitleSuggestionState) -> dict[str, Any]:
    """검증된 제목 후보를 외부 결과로 직렬화한다."""
    candidate = state["candidate"] or TitleSuggestionDraft()
    return {"result": candidate.model_dump(mode="json")}


async def empty(_state: TitleSuggestionState) -> dict[str, Any]:
    """후보가 없는 제목 제안 결과를 반환한다."""
    return {"result": {"suggestions": []}}
