"""title-suggestion의 조사와 검증과 복구와 결과 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.tool_loop import ToolLoopBudget
from ..langchain_agent import TitleAgentContext, build_title_agent
from ..models import TitleSuggestionDraft, TitleSuggestionRequest, TitleSuggestionState
from ..policy import MAX_TITLE_MODEL_COST_USD, MAX_TOOL_ROUNDS, validate_title_candidate
from ..prompts import INVESTIGATOR_SYSTEM_PROMPT, REPAIR_DIRECTIVE, build_user_prompt

type TitleNode = Callable[[TitleSuggestionState], Awaitable[dict[str, Any]]]


def create_candidate_nodes(
    req: TitleSuggestionRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[TitleNode, TitleNode, TitleNode]:
    """도구 루프와 결정적 검증 노드를 실행 의존성에 결합한다."""

    title_agent = build_title_agent(chat, INVESTIGATOR_SYSTEM_PROMPT)

    async def invoke_agent(
        messages: list[Any], spent: float
    ) -> tuple[TitleSuggestionDraft, list[Any], float]:
        budget = ToolLoopBudget(agent_name, req.model, MAX_TITLE_MODEL_COST_USD, spent)
        context = TitleAgentContext(agent_name, client, req.toolCallback, usage, budget)
        output = await title_agent.ainvoke(
            {"messages": messages},
            context=context,
            config={"recursion_limit": 2 * MAX_TOOL_ROUNDS + 10},
        )
        candidate = output.get("structured_response")
        if not isinstance(candidate, TitleSuggestionDraft):
            raise ValueError(f"{agent_name} produced no structured output")
        return candidate, list(output["messages"]), budget.spent

    async def investigate(state: TitleSuggestionState) -> dict[str, Any]:
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
        messages = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, cost = await invoke_agent(
            messages,
            state["model_cost_usd"],
        )
        return {
            "candidate": draft,
            "messages": messages,
            "repair_attempted": True,
            "model_cost_usd": cost,
        }

    return investigate, validate_candidate, repair


async def finalize(state: TitleSuggestionState) -> dict[str, Any]:
    """검증된 제목 후보를 외부 결과로 직렬화한다."""
    candidate = state["candidate"] or TitleSuggestionDraft()
    return {"result": candidate.model_dump(mode="json")}


async def empty(_state: TitleSuggestionState) -> dict[str, Any]:
    """후보가 없는 제목 제안 결과를 반환한다."""
    return {"result": {"suggestions": []}}
