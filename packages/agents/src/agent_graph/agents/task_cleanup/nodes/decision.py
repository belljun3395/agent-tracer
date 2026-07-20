"""task-cleanup의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.structured_agent import invoke_structured_agent
from ..langchain_agent import CleanupAgentContext, build_cleanup_agent
from ..models import (
    CleanupDraft,
    InvestigateUpdate,
    RepairUpdate,
    TaskCleanupRequest,
    TaskCleanupState,
    ValidateDecisionsUpdate,
)
from ..policy import (
    AGENT_RECURSION_LIMIT,
    TASK_CLEANUP_MAX_MODEL_COST_USD,
    decision_rounds,
    validate_suggestions,
)
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..reader import CleanupLedgerReader

type InvestigateNode = Callable[[TaskCleanupState], Awaitable[InvestigateUpdate]]
type ValidateDecisionsNode = Callable[[TaskCleanupState], Awaitable[ValidateDecisionsUpdate]]
type RepairNode = Callable[[TaskCleanupState], Awaitable[RepairUpdate]]


def create_decision_nodes(
    req: TaskCleanupRequest,
    reader: CleanupLedgerReader,
    usage: ExecutionTrace,
    chat: BaseChatModel,
    *,
    agent_name: str,
) -> tuple[InvestigateNode, ValidateDecisionsNode, RepairNode]:
    """도구 루프와 결정적 검증 노드를 실행 의존성에 결합한다."""

    cleanup_agent = build_cleanup_agent(chat, INVESTIGATOR_SYSTEM_PROMPT)

    async def invoke_agent(
        messages: list[Any], state: TaskCleanupState
    ) -> tuple[CleanupDraft, list[Any], CleanupAgentContext]:
        budget = ToolLoopBudget(
            agent_name,
            req.model,
            TASK_CLEANUP_MAX_MODEL_COST_USD,
            state["model_cost_usd"],
        )
        rounds = decision_rounds(state["plan"])
        context = CleanupAgentContext(
            agent_name=agent_name,
            trace=usage,
            budget=budget,
            max_tool_rounds=rounds,
            reader=reader,
            batch=req.batch,
            exposed_candidates=state["exposed_candidates"],
            event_ids_by_task=state["event_ids_by_task"],
        )
        result = await invoke_structured_agent(
            cleanup_agent,
            messages=messages,
            context=context,
            response_type=CleanupDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{agent_name} produced no structured output",
        )
        return result.response, result.messages, context

    async def investigate(state: TaskCleanupState) -> InvestigateUpdate:
        draft, messages, context = await invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(
                        state["scanned_at"],
                        state["max_suggestions"],
                        state["language"],
                        state["reports"],
                    ),
                }
            ],
            state,
        )
        return {
            "suggestions": draft.suggestions,
            "messages": messages,
            "exposed_candidates": context.exposed_candidates,
            "event_ids_by_task": context.event_ids_by_task,
            "model_cost_usd": context.budget.spent,
        }

    async def validate_decisions(state: TaskCleanupState) -> ValidateDecisionsUpdate:
        valid, errors = validate_suggestions(state["suggestions"], state)
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_decisions",
            )
        return {"suggestions": valid, "validation_errors": errors}

    async def repair(state: TaskCleanupState) -> RepairUpdate:
        repair_prompt = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, context = await invoke_agent(repair_prompt, state)
        return {
            "suggestions": draft.suggestions,
            "messages": messages,
            "exposed_candidates": context.exposed_candidates,
            "event_ids_by_task": context.event_ids_by_task,
            "repair_attempted": True,
            "model_cost_usd": context.budget.spent,
        }

    return investigate, validate_decisions, repair
