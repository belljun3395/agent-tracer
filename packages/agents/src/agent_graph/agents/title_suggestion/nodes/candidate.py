"""title-suggestion의 조사와 검증과 복구와 결과 노드를 제공한다."""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.llm.structured_agent import invoke_structured_agent
from ...runtime.node import GraphNode
from ...runtime.validation_graph import EMPTY, FINALIZE
from ..langchain_agent import build_title_agent
from ..models import (
    InvestigateUpdate,
    RepairUpdate,
    ResultUpdate,
    TitleSuggestionDraft,
    TitleSuggestionRequest,
    TitleSuggestionState,
    ValidateCandidateUpdate,
)
from ..policy import (
    AGENT_RECURSION_LIMIT,
    MAX_TITLE_MODEL_COST_USD,
    MAX_TOOL_ROUNDS,
    validate_title_candidate,
)
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt
from ..reader import TitleLedgerReader
from ..tools import build_title_registry


class _CandidateAgent(GraphNode):
    def __init__(
        self,
        req: TitleSuggestionRequest,
        reader: TitleLedgerReader,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._reader = reader
        self._usage = usage
        self._chat = chat
        self._agent_name = agent_name

    async def _invoke_agent(
        self, messages: list[Any], spent: float
    ) -> tuple[TitleSuggestionDraft, list[Any], float]:
        budget = ToolLoopBudget(self._agent_name, self._req.model, MAX_TITLE_MODEL_COST_USD, spent)
        registry = build_title_registry(self._reader, agent_name=self._agent_name)
        agent = build_title_agent(self._chat, INVESTIGATOR_SYSTEM_PROMPT, registry.langchain_tools())
        context = StandardAgentContext(
            agent_name=self._agent_name,
            trace=self._usage,
            budget=budget,
            max_tool_rounds=MAX_TOOL_ROUNDS,
        )
        result = await invoke_structured_agent(
            agent,
            messages=messages,
            context=context,
            response_type=TitleSuggestionDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{self._agent_name} produced no structured output",
        )
        return result.response, result.messages, budget.spent


class InvestigateNode(_CandidateAgent):
    """대화 발췌와 필요한 이벤트로 제목 후보를 조사한다."""

    name = "investigate"

    async def run(self, state: TitleSuggestionState) -> InvestigateUpdate:
        draft, messages, cost = await self._invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(state["task_id"], state["context"], state["language"]),
                }
            ],
            state["model_cost_usd"],
        )
        return {"candidate": draft, "messages": messages, "model_cost_usd": cost}


class RepairNode(_CandidateAgent):
    """검증에서 걸린 후보를 한 번 더 고쳐 쓴다."""

    name = "repair"

    async def run(self, state: TitleSuggestionState) -> RepairUpdate:
        repair_prompt = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, cost = await self._invoke_agent(repair_prompt, state["model_cost_usd"])
        return {
            "candidate": draft,
            "messages": messages,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }


class ValidateCandidateNode(GraphNode):
    """제목 후보가 결정적 제약을 지키는지 판정한다."""

    name = "validate_candidate"

    def __init__(self, usage: ExecutionTrace) -> None:
        self._usage = usage

    async def run(self, state: TitleSuggestionState) -> ValidateCandidateUpdate:
        errors = validate_title_candidate(state["candidate"], state["context"].title)
        if errors:
            self._usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name=self.name,
            )
        return {"validation_errors": errors}


class FinalizeNode(GraphNode):
    """검증된 제목 후보를 외부 결과로 직렬화한다."""

    name = FINALIZE

    async def run(self, state: TitleSuggestionState) -> ResultUpdate:
        candidate = state["candidate"] or TitleSuggestionDraft()
        return {"result": candidate.model_dump(mode="json")}


class EmptyNode(GraphNode):
    """후보가 없는 제목 제안 결과를 반환한다."""

    name = EMPTY

    async def run(self, _state: TitleSuggestionState) -> ResultUpdate:
        return {"result": {"suggestions": []}}
