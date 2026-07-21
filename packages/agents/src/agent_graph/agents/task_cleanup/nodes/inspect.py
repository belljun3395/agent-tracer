"""task-cleanup의 후보 선별과 후보별 조사 노드를 제공한다."""

from __future__ import annotations

import logging

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.llm.structured_agent import invoke_structured_agent
from ...runtime.node import GraphNode
from ..langchain_agent import build_cleanup_agent
from ..models import (
    CLEANUP_REVIEWER_ROLE,
    MAX_INSPECT_REASON_CHARS,
    CleanupCandidate,
    InspectDispatch,
    InspectReport,
    InspectUpdate,
    TaskCleanupRequest,
    TaskCleanupState,
    TriagePlan,
    TriageUpdate,
)
from ..policy import (
    AGENT_RECURSION_LIMIT,
    TASK_CLEANUP_MAX_MODEL_COST_USD,
    TRIAGE_ROUNDS,
    clamp_triage,
    inspection_rounds,
)
from ..prompts import (
    INSPECT_SYSTEM_PROMPT,
    TRIAGE_SYSTEM_PROMPT,
    build_inspect_prompt,
    build_triage_prompt,
)
from ..reader import CleanupLedgerReader
from ..tools import INSPECT_TOOL_NAMES, TRIAGE_TOOL_NAMES, build_cleanup_registry

_log = logging.getLogger(__name__)


def _failure_reason(exc: Exception) -> str:
    summary = str(exc).strip() or type(exc).__name__
    return f"조사 실패: {summary}"[:MAX_INSPECT_REASON_CHARS]


class TriageNode(GraphNode):
    """조율자가 후보 목록만 보고 어느 것을 열어볼지 스스로 정하게 한다."""

    name = "triage"

    def __init__(
        self,
        req: TaskCleanupRequest,
        reader: CleanupLedgerReader,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        fallback_chat: BaseChatModel | None,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._reader = reader
        self._usage = usage
        self._chat = chat
        self._fallback_chat = fallback_chat
        self._agent_name = agent_name

    async def run(self, _state: TaskCleanupState) -> TriageUpdate:
        req = self._req
        exposed: dict[str, CleanupCandidate] = {}
        event_ids: dict[str, set[str]] = {}
        triage_name = f"{self._agent_name}:triage"
        budget = ToolLoopBudget(triage_name, req.model, TASK_CLEANUP_MAX_MODEL_COST_USD, 0.0)
        registry = build_cleanup_registry(
            self._reader, req.batch, exposed, event_ids, agent_name=self._agent_name
        )
        agent = build_cleanup_agent(
            self._chat,
            TRIAGE_SYSTEM_PROMPT,
            registry.langchain_tools(TRIAGE_TOOL_NAMES),
            registry.transient_errors(),
            max_rounds=TRIAGE_ROUNDS,
            output=TriagePlan,
            fallback_chat=self._fallback_chat,
        )
        result = await invoke_structured_agent(
            agent,
            messages=[
                {
                    "role": "user",
                    "content": build_triage_prompt(len(req.batch.candidates), inspection_rounds()),
                }
            ],
            context=StandardAgentContext(
                agent_name=triage_name,
                trace=self._usage,
                budget=budget,
                max_tool_rounds=TRIAGE_ROUNDS,
            ),
            response_type=TriagePlan,
            recursion_limit=AGENT_RECURSION_LIMIT,
            missing_response=f"{self._agent_name} triage produced no structured plan",
        )
        kept, cut = clamp_triage(result.response, inspection_rounds())
        chosen = ", ".join(f"{item.taskId}:{item.rounds}" for item in kept.assignments) or "없음"
        self._usage.record_graph_event(
            "route.selected",
            f"{self.name} -> {chosen}" + (f" (배분 {cut}라운드 축소)" if cut else ""),
            node_name=self.name,
        )
        return {
            "plan": kept,
            "exposed_candidates": exposed,
            "event_ids_by_task": event_ids,
            "model_cost_usd": budget.spent,
        }


class InspectNode(GraphNode):
    """후보 하나를 자기 예산과 자기 장부로 열어보고 판정을 올린다."""

    name = "inspect"

    def __init__(
        self,
        req: TaskCleanupRequest,
        reader: CleanupLedgerReader,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        fallback_chat: BaseChatModel | None,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._reader = reader
        self._usage = usage
        self._chat = chat
        self._fallback_chat = fallback_chat
        self._agent_name = agent_name

    async def run(self, payload: InspectDispatch) -> InspectUpdate:
        req = self._req
        assignment = payload.assignment
        share = payload.cost_budget
        # 장부를 조사마다 새로 두어 다른 후보의 이벤트를 인용하지 못하게 한다.
        event_ids: dict[str, set[str]] = {}
        name = f"{self._agent_name}:{CLEANUP_REVIEWER_ROLE}"
        budget = ToolLoopBudget(name, req.model, share, 0.0)
        # 취소(BaseException 계열)는 잡 전체를 멈추라는 신호이므로 잡지 않고 전파한다.
        try:
            registry = build_cleanup_registry(
                self._reader, req.batch, {}, event_ids, agent_name=self._agent_name
            )
            agent = build_cleanup_agent(
                self._chat,
                INSPECT_SYSTEM_PROMPT,
                registry.langchain_tools(INSPECT_TOOL_NAMES),
                registry.transient_errors(),
                max_rounds=assignment.rounds,
                output=InspectReport,
                fallback_chat=self._fallback_chat,
            )
            result = await invoke_structured_agent(
                agent,
                messages=[
                    {
                        "role": "user",
                        "content": build_inspect_prompt(assignment.taskId, assignment.rounds),
                    }
                ],
                context=StandardAgentContext(
                    agent_name=name,
                    trace=self._usage,
                    budget=budget,
                    max_tool_rounds=assignment.rounds,
                ),
                response_type=InspectReport,
                recursion_limit=AGENT_RECURSION_LIMIT,
                missing_response=f"{assignment.taskId} inspection produced no structured report",
            )
            report = result.response
        except Exception as exc:
            # 조사가 무너진 후보는 안전하게 보존하도록 보관 불가로 올린다.
            reason = _failure_reason(exc)
            _log.warning("inspect failed for %s: %s", assignment.taskId, exc)
            report = InspectReport(
                taskId=assignment.taskId,
                archivable=False,
                reason=reason,
                citedEventIds=[],
            )
        return {
            "reports": [report],
            "event_ids_by_task": event_ids,
            "model_cost_usd": budget.spent,
        }
