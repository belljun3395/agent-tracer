"""task-cleanup의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ..langchain_agent import CleanupAgentContext, build_cleanup_agent
from ..models import CleanupDraft, TaskCleanupRequest, TaskCleanupState
from ..policy import (
    AGENT_RECURSION_LIMIT,
    MAX_TOOL_ROUNDS,
    TASK_CLEANUP_MAX_MODEL_COST_USD,
    validate_suggestions,
)
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt

type CleanupNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]


def create_decision_nodes(
    req: TaskCleanupRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[CleanupNode, CleanupNode, CleanupNode]:
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
        context = CleanupAgentContext(
            agent_name,
            usage,
            budget,
            MAX_TOOL_ROUNDS,
            client,
            req.toolCallback,
            state["exposed_candidates"],
            state["event_ids_by_task"],
        )
        output = await cleanup_agent.ainvoke(
            {"messages": messages},
            context=context,
            config={"recursion_limit": AGENT_RECURSION_LIMIT},
        )
        draft = output.get("structured_response")
        if not isinstance(draft, CleanupDraft):
            raise ValueError(f"{agent_name} produced no structured output")
        return draft, list(output["messages"]), context

    async def investigate(state: TaskCleanupState) -> dict[str, Any]:
        draft, messages, context = await invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(
                        state["scanned_at"], state["max_suggestions"], state["language"]
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

    async def validate_decisions(state: TaskCleanupState) -> dict[str, Any]:
        valid, errors = validate_suggestions(state["suggestions"], state)
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_decisions",
            )
        return {"suggestions": valid, "validation_errors": errors}

    async def repair(state: TaskCleanupState) -> dict[str, Any]:
        messages = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, context = await invoke_agent(
            messages,
            state,
        )
        return {
            "suggestions": draft.suggestions,
            "messages": messages,
            "exposed_candidates": context.exposed_candidates,
            "event_ids_by_task": context.event_ids_by_task,
            "repair_attempted": True,
            "model_cost_usd": context.budget.spent,
        }

    return investigate, validate_decisions, repair
