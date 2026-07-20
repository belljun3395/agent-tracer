"""task-cleanup의 조사와 검증과 복구 그래프 노드를 만든다."""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.structured_agent import invoke_structured_agent
from ...runtime.node import GraphNode
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
from ..tools import build_cleanup_registry


class _DecisionAgent(GraphNode):
    """조사와 복구 노드가 공유하는 도구 루프 호출을 슬라이스 안에서 소유한다."""

    def __init__(
        self,
        req: TaskCleanupRequest,
        reader: CleanupLedgerReader,
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
        self, messages: list[Any], state: TaskCleanupState
    ) -> tuple[CleanupDraft, list[Any], ToolLoopBudget]:
        budget = ToolLoopBudget(
            self._agent_name,
            self._req.model,
            TASK_CLEANUP_MAX_MODEL_COST_USD,
            state["model_cost_usd"],
        )
        rounds = decision_rounds(state["plan"])
        registry = build_cleanup_registry(
            self._reader,
            self._req.batch,
            state["exposed_candidates"],
            state["event_ids_by_task"],
            agent_name=self._agent_name,
        )
        cleanup_agent = build_cleanup_agent(
            self._chat,
            INVESTIGATOR_SYSTEM_PROMPT,
            registry.langchain_tools(),
            registry.transient_errors(),
            output=CleanupDraft,
        )
        context = CleanupAgentContext(
            agent_name=self._agent_name,
            trace=self._usage,
            budget=budget,
            max_tool_rounds=rounds,
        )
        result = await invoke_structured_agent(
            cleanup_agent,
            messages=messages,
            context=context,
            response_type=CleanupDraft,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{self._agent_name} produced no structured output",
        )
        return result.response, result.messages, budget


class InvestigateNode(_DecisionAgent):
    """조율자가 후보 보고를 모아 정리 제안을 쓴다."""

    name = "investigate"

    async def run(self, state: TaskCleanupState) -> InvestigateUpdate:
        draft, messages, budget = await self._invoke_agent(
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
            "exposed_candidates": state["exposed_candidates"],
            "event_ids_by_task": state["event_ids_by_task"],
            "model_cost_usd": budget.spent,
        }


class RepairNode(_DecisionAgent):
    """검증에서 걸린 제안을 한 번 더 고쳐 쓴다."""

    name = "repair"

    async def run(self, state: TaskCleanupState) -> RepairUpdate:
        repair_prompt = [
            *state["messages"],
            {
                "role": "user",
                "content": REPAIR_DIRECTIVE.format(errors="\n".join(state["validation_errors"])),
            },
        ]
        draft, messages, budget = await self._invoke_agent(repair_prompt, state)
        return {
            "suggestions": draft.suggestions,
            "messages": messages,
            "exposed_candidates": state["exposed_candidates"],
            "event_ids_by_task": state["event_ids_by_task"],
            "repair_attempted": True,
            "model_cost_usd": budget.spent,
        }


class ValidateDecisionsNode(GraphNode):
    """정리 제안이 도구가 노출한 후보와 이벤트만 인용하는지 판정한다."""

    name = "validate_decisions"

    def __init__(self, usage: ExecutionTrace) -> None:
        self._usage = usage

    async def run(self, state: TaskCleanupState) -> ValidateDecisionsUpdate:
        valid, errors = validate_suggestions(state["suggestions"], state)
        if errors:
            self._usage.record_graph_event(
                "validation.failed",
                "; ".join(errors),
                node_name=self.name,
            )
        return {"suggestions": valid, "validation_errors": errors}
