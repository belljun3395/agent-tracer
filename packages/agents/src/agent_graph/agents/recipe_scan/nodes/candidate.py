"""recipe-scan의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.tool_loop import continue_tool_loop, run_tool_loop
from ..models import RecipeDraft, RecipeScanRequest, RecipeScanState
from ..policy import MAX_RECIPE_MODEL_COST_USD, MAX_TOOL_ROUNDS, validate_recipe_candidates
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..tools.client import RECIPE_TOOL_SPECS, invoke_tool, record_evidence

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

    async def run_tool(name: str, args: dict[str, Any]) -> str:
        return await invoke_tool(client, req.toolCallback, name, args)

    async def investigate(state: RecipeScanState) -> dict[str, Any]:
        catalog = state["provenance"]

        def observe(name: str, args: dict[str, Any], content: str) -> None:
            record_evidence(catalog, name, args, content)

        draft, messages, cost = await run_tool_loop(
            chat,
            system=INVESTIGATOR_SYSTEM_PROMPT,
            user=build_user_prompt(state["task_id"], state["user_prompt"], state["language"]),
            tools=RECIPE_TOOL_SPECS,
            schema=RecipeDraft,
            trace=usage,
            run_tool=run_tool,
            observe=observe,
            agent_name=agent_name,
            model_name=req.model,
            max_rounds=MAX_TOOL_ROUNDS,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
            spent=state["model_cost_usd"],
        )
        return {
            "candidates": draft.recipes,
            "messages": messages,
            "provenance": catalog,
            "model_cost_usd": cost,
        }

    async def validate_candidate(state: RecipeScanState) -> dict[str, Any]:
        errors = validate_recipe_candidates(state["candidates"], state["task_id"], state["provenance"])
        if errors:
            usage.record_graph_event("validation.failed", "; ".join(errors), node_name="validate_candidate")
        return {"validation_errors": errors}

    async def repair(state: RecipeScanState) -> dict[str, Any]:
        if not state["candidates"]:
            return {"repair_attempted": True}
        catalog = state["provenance"]

        def observe(name: str, args: dict[str, Any], content: str) -> None:
            record_evidence(catalog, name, args, content)

        draft, cost = await continue_tool_loop(
            chat,
            messages=state["messages"],
            directive=REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            tools=RECIPE_TOOL_SPECS,
            schema=RecipeDraft,
            trace=usage,
            run_tool=run_tool,
            observe=observe,
            agent_name=agent_name,
            model_name=req.model,
            max_rounds=MAX_TOOL_ROUNDS,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
            spent=state["model_cost_usd"],
        )
        return {
            "candidates": draft.recipes,
            "messages": state["messages"],
            "provenance": catalog,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return investigate, validate_candidate, repair
