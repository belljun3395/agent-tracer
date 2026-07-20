"""title-suggestion의 조사와 검증과 복구와 결과 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.structured_agent import invoke_structured_agent
from ..langchain_agent import TitleAgentContext, build_title_agent
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

type InvestigateNode = Callable[[TitleSuggestionState], Awaitable[InvestigateUpdate]]
type ValidateCandidateNode = Callable[[TitleSuggestionState], Awaitable[ValidateCandidateUpdate]]
type RepairNode = Callable[[TitleSuggestionState], Awaitable[RepairUpdate]]


def create_candidate_nodes(
    req: TitleSuggestionRequest,
    reader: TitleLedgerReader,
    usage: ExecutionTrace,
    chat: BaseChatModel,
    *,
    agent_name: str,
) -> tuple[InvestigateNode, ValidateCandidateNode, RepairNode]:
    """도구 루프와 결정적 검증 노드를 실행 의존성에 결합한다."""

    title_agent = build_title_agent(chat, INVESTIGATOR_SYSTEM_PROMPT)

    async def invoke_agent(
        messages: list[Any], spent: float
    ) -> tuple[TitleSuggestionDraft, list[Any], float]:
        budget = ToolLoopBudget(agent_name, req.model, MAX_TITLE_MODEL_COST_USD, spent)
        context = TitleAgentContext(
            agent_name=agent_name,
            trace=usage,
            budget=budget,
            max_tool_rounds=MAX_TOOL_ROUNDS,
            reader=reader,
        )
        result = await invoke_structured_agent(
            title_agent,
            messages=messages,
            context=context,
            response_type=TitleSuggestionDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{agent_name} produced no structured output",
        )
        return result.response, result.messages, budget.spent

    async def investigate(state: TitleSuggestionState) -> InvestigateUpdate:
        draft, messages, cost = await invoke_agent(
            [
                {
                    "role": "user",
                    "content": build_user_prompt(state["task_id"], state["context"], state["language"]),
                }
            ],
            state["model_cost_usd"],
        )
        return {"candidate": draft, "messages": messages, "model_cost_usd": cost}

    async def validate_candidate(state: TitleSuggestionState) -> ValidateCandidateUpdate:
        errors = validate_title_candidate(state["candidate"], state["context"].title)
        if errors:
            usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name="validate_candidate",
            )
        return {"validation_errors": errors}

    async def repair(state: TitleSuggestionState) -> RepairUpdate:
        repair_prompt = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, cost = await invoke_agent(repair_prompt, state["model_cost_usd"])
        return {
            "candidate": draft,
            "messages": messages,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return investigate, validate_candidate, repair


async def finalize(state: TitleSuggestionState) -> ResultUpdate:
    """검증된 제목 후보를 외부 결과로 직렬화한다."""
    candidate = state["candidate"] or TitleSuggestionDraft()
    return {"result": candidate.model_dump(mode="json")}


async def empty(_state: TitleSuggestionState) -> ResultUpdate:
    """후보가 없는 제목 제안 결과를 반환한다."""
    return {"result": {"suggestions": []}}
