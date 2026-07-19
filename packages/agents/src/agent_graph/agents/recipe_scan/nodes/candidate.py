"""recipe-scan의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.structured_agent import invoke_structured_agent
from ..langchain_agent import RecipeAgentContext, build_recipe_agent
from ..models import (
    AGENT_RECURSION_LIMIT,
    MAX_TOOL_ROUNDS,
    RecipeDraft,
    RecipeScanRequest,
    RecipeScanState,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD, synthesis_rounds, validate_recipe_candidates
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader

type RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def create_candidate_nodes(
    req: RecipeScanRequest,
    reader: RecipeLedgerReader,
    search: RecipeSearchReader,
    usage: ExecutionTrace,
    chat: BaseChatModel,
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
        rounds = synthesis_rounds(state["plan"])
        context = RecipeAgentContext(
            agent_name=agent_name,
            trace=usage,
            budget=budget,
            max_tool_rounds=rounds,
            reader=reader,
            search=search,
            provenance=state["provenance"],
        )
        result = await invoke_structured_agent(
            recipe_agent,
            messages=messages,
            context=context,
            response_type=RecipeDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{agent_name} produced no structured output",
        )
        return result.response, result.messages, context

    async def investigate(state: RecipeScanState) -> dict[str, Any]:
        draft, messages, context = await invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(
                        state["task_id"],
                        state["user_prompt"],
                        state["language"],
                        state["plan"],
                        state["reports"],
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
