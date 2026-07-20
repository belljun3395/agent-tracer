"""recipe-scan의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.llm.structured_agent import invoke_structured_agent
from ...runtime.node import GraphNode
from ..langchain_agent import build_recipe_agent
from ..models import (
    AGENT_RECURSION_LIMIT,
    MAX_TOOL_ROUNDS,
    InvestigateUpdate,
    ProvenanceCatalog,
    RecipeDraft,
    RecipeScanRequest,
    RecipeScanState,
    RepairUpdate,
    ValidateCandidateUpdate,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD, synthesis_rounds, validate_recipe_candidates
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader
from ..tools import build_recipe_registry


class _CandidateAgent(GraphNode):
    def __init__(
        self,
        req: RecipeScanRequest,
        reader: RecipeLedgerReader,
        search: RecipeSearchReader,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._reader = reader
        self._search = search
        self._usage = usage
        self._chat = chat
        self._agent_name = agent_name

    async def _invoke_agent(
        self, messages: list[Any], state: RecipeScanState
    ) -> tuple[RecipeDraft, list[Any], ProvenanceCatalog, StandardAgentContext]:
        budget = ToolLoopBudget(
            self._agent_name, self._req.model, MAX_RECIPE_MODEL_COST_USD, state["model_cost_usd"]
        )
        rounds = synthesis_rounds(state["plan"])
        catalog = state["provenance"]
        registry = build_recipe_registry(self._reader, self._search, catalog, agent_name=self._agent_name)
        agent = build_recipe_agent(
            self._chat,
            INVESTIGATOR_SYSTEM_PROMPT,
            registry.langchain_tools(),
            registry.transient_errors(),
            max_rounds=MAX_TOOL_ROUNDS,
            output=RecipeDraft,
        )
        context = StandardAgentContext(
            agent_name=self._agent_name, trace=self._usage, budget=budget, max_tool_rounds=rounds
        )
        result = await invoke_structured_agent(
            agent,
            messages=messages,
            context=context,
            response_type=RecipeDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{self._agent_name} produced no structured output",
        )
        return result.response, result.messages, catalog, context


class InvestigateNode(_CandidateAgent):
    """전문가 보고와 계획을 모아 레시피 후보를 조사한다."""

    name = "investigate"

    async def run(self, state: RecipeScanState) -> InvestigateUpdate:
        draft, messages, catalog, context = await self._invoke_agent(
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
            "provenance": catalog,
            "model_cost_usd": context.budget.spent,
        }


class RepairNode(_CandidateAgent):
    """검증에서 걸린 후보를 한 번 더 고쳐 쓴다."""

    name = "repair"

    async def run(self, state: RecipeScanState) -> RepairUpdate:
        if not state["candidates"]:
            return {"repair_attempted": True}
        repair_prompt = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, catalog, context = await self._invoke_agent(repair_prompt, state)
        return {
            "candidates": draft.recipes,
            "messages": messages,
            "provenance": catalog,
            "repair_attempted": True,
            "model_cost_usd": context.budget.spent,
        }


class ValidateCandidateNode(GraphNode):
    """레시피 후보가 전문가 장부의 근거만 인용하는지 판정한다."""

    name = "validate_candidate"

    def __init__(self, usage: ExecutionTrace) -> None:
        self._usage = usage

    async def run(self, state: RecipeScanState) -> ValidateCandidateUpdate:
        errors = validate_recipe_candidates(state["candidates"], state["task_id"], state["provenance"])
        if errors:
            self._usage.record_graph_event("validation.failed", "; ".join(errors), node_name=self.name)
        return {"validation_errors": errors}
