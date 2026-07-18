"""recipe-scan의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.tool_loop import ToolLoopBudget
from ..langchain_agent import RecipeAgentContext, build_recipe_agent
from ..models import (
    AGENT_RECURSION_LIMIT,
    MAX_TOOL_ROUNDS,
    RecipeDraft,
    RecipeScanRequest,
    RecipeScanState,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD, validate_recipe_candidates
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt

type RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def create_candidate_nodes(
    req: RecipeScanRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[RecipeNode, RecipeNode, RecipeNode]:
    """도구 루프와 결정적 검증 노드를 실행 의존성에 결합한다."""

    recipe_agent = build_recipe_agent(chat, INVESTIGATOR_SYSTEM_PROMPT, MAX_TOOL_ROUNDS)

    async def invoke_agent(
        messages: list[Any], state: RecipeScanState
    ) -> tuple[RecipeDraft, list[Any], RecipeAgentContext]:
        budget = ToolLoopBudget(
            agent_name, req.model, MAX_RECIPE_MODEL_COST_USD, state["model_cost_usd"]
        )
        context = RecipeAgentContext(
            agent_name,
            client,
            req.toolCallback,
            usage,
            budget,
            state["provenance"],
        )
        output = await recipe_agent.ainvoke(
            {"messages": messages},
            context=context,
            config={"recursion_limit": AGENT_RECURSION_LIMIT},
        )
        draft = output.get("structured_response")
        if not isinstance(draft, RecipeDraft):
            raise ValueError(f"{agent_name} produced no structured output")
        return draft, list(output["messages"]), context

    async def investigate(state: RecipeScanState) -> dict[str, Any]:
        draft, messages, context = await invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(
                        state["task_id"], state["user_prompt"], state["language"]
                    ),
                }
            ],
            state,
        )
        return {
            "candidates": draft.recipes,
            "messages": messages,
            "provenance": context.provenance,
            "model_cost_usd": context.budget.spent,
        }

    async def validate_candidate(state: RecipeScanState) -> dict[str, Any]:
        errors = validate_recipe_candidates(state["candidates"], state["task_id"], state["provenance"])
        if errors:
            usage.record_graph_event("validation.failed", "; ".join(errors), node_name="validate_candidate")
        return {"validation_errors": errors}

    async def repair(state: RecipeScanState) -> dict[str, Any]:
        if not state["candidates"]:
            return {"repair_attempted": True}
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
            "candidates": draft.recipes,
            "messages": messages,
            "provenance": context.provenance,
            "repair_attempted": True,
            "model_cost_usd": context.budget.spent,
        }

    return investigate, validate_candidate, repair
