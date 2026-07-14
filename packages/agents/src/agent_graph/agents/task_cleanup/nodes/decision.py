"""task-cleanup의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.tool_loop import continue_tool_loop, run_tool_loop
from ..models import CleanupDraft, TaskCleanupRequest, TaskCleanupState
from ..policy import MAX_TOOL_ROUNDS, TASK_CLEANUP_MAX_MODEL_COST_USD, validate_suggestions
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..tools import CLEANUP_TOOL_SPECS, invoke_tool, record_evidence

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

    async def run_tool(name: str, args: dict[str, Any]) -> str:
        return await invoke_tool(client, req.toolCallback, name, args)

    async def investigate(state: TaskCleanupState) -> dict[str, Any]:
        exposed = state["exposed_candidates"]
        event_ids = state["event_ids_by_task"]

        def observe(name: str, args: dict[str, Any], content: str) -> None:
            record_evidence(exposed, event_ids, name, args, content)

        draft, messages, cost = await run_tool_loop(
            chat,
            system=INVESTIGATOR_SYSTEM_PROMPT,
            user=build_user_prompt(state["scanned_at"], state["max_suggestions"], state["language"]),
            tools=CLEANUP_TOOL_SPECS,
            schema=CleanupDraft,
            trace=usage,
            run_tool=run_tool,
            observe=observe,
            agent_name=agent_name,
            model_name=req.model,
            max_rounds=MAX_TOOL_ROUNDS,
            max_cost_usd=TASK_CLEANUP_MAX_MODEL_COST_USD,
            spent=state["model_cost_usd"],
        )
        return {
            "suggestions": draft.suggestions,
            "messages": messages,
            "exposed_candidates": exposed,
            "event_ids_by_task": event_ids,
            "model_cost_usd": cost,
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
        exposed = state["exposed_candidates"]
        event_ids = state["event_ids_by_task"]

        def observe(name: str, args: dict[str, Any], content: str) -> None:
            record_evidence(exposed, event_ids, name, args, content)

        draft, cost = await continue_tool_loop(
            chat,
            messages=state["messages"],
            directive=REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            tools=CLEANUP_TOOL_SPECS,
            schema=CleanupDraft,
            trace=usage,
            run_tool=run_tool,
            observe=observe,
            agent_name=agent_name,
            model_name=req.model,
            max_rounds=MAX_TOOL_ROUNDS,
            max_cost_usd=TASK_CLEANUP_MAX_MODEL_COST_USD,
            spent=state["model_cost_usd"],
        )
        return {
            "suggestions": draft.suggestions,
            "messages": state["messages"],
            "exposed_candidates": exposed,
            "event_ids_by_task": event_ids,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return investigate, validate_decisions, repair
