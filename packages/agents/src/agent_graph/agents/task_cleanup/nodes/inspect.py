"""task-cleanup의 후보 선별과 후보별 조사 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ..langchain_agent import (
    INSPECT_TOOLS,
    TRIAGE_TOOLS,
    CleanupAgentContext,
    build_cleanup_agent,
)
from ..models import (
    CleanupCandidate,
    InspectAssignment,
    InspectReport,
    TaskCleanupRequest,
    TaskCleanupState,
    TriagePlan,
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

type TriageNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]
type InspectNode = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def create_triage_node(
    req: TaskCleanupRequest,
    reader: CleanupLedgerReader,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> TriageNode:
    """조율자가 후보 목록만 보고 어느 것을 열어볼지 스스로 정하게 한다."""

    async def triage(_state: TaskCleanupState) -> dict[str, Any]:
        exposed: dict[str, CleanupCandidate] = {}
        event_ids: dict[str, set[str]] = {}
        budget = ToolLoopBudget(
            f"{agent_name}:triage", req.model, TASK_CLEANUP_MAX_MODEL_COST_USD, 0.0
        )
        agent = build_cleanup_agent(
            chat, TRIAGE_SYSTEM_PROMPT, TRIAGE_ROUNDS, TRIAGE_TOOLS, TriagePlan
        )
        output = await agent.ainvoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": build_triage_prompt(
                            len(req.batch.candidates), inspection_rounds()
                        ),
                    }
                ]
            },
            context=CleanupAgentContext(
                f"{agent_name}:triage",
                usage,
                budget,
                TRIAGE_ROUNDS,
                reader,
                req.batch,
                exposed,
                event_ids,
            ),
            config={"recursion_limit": AGENT_RECURSION_LIMIT},
        )
        raw = output.get("structured_response")
        if not isinstance(raw, TriagePlan):
            raise ValueError(f"{agent_name} triage produced no structured plan")
        kept, cut = clamp_triage(raw, inspection_rounds())
        chosen = ", ".join(f"{item.taskId}:{item.rounds}" for item in kept.inspect) or "없음"
        usage.record_graph_event(
            "route.selected",
            f"triage -> {chosen}" + (f" (배분 {cut}라운드 축소)" if cut else ""),
            node_name="triage",
        )
        return {
            "plan": kept,
            "exposed_candidates": exposed,
            "event_ids_by_task": event_ids,
            "model_cost_usd": budget.spent,
        }

    return triage


def create_inspect_node(
    req: TaskCleanupRequest,
    reader: CleanupLedgerReader,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> InspectNode:
    """후보 하나를 자기 예산과 자기 장부로 열어보고 판정을 올린다."""

    async def inspect(payload: dict[str, Any]) -> dict[str, Any]:
        assignment = InspectAssignment.model_validate(payload["assignment"])
        share = TASK_CLEANUP_MAX_MODEL_COST_USD * payload["cost_share"]
        # 장부를 조사마다 새로 두어 다른 후보의 이벤트를 인용하지 못하게 한다.
        event_ids: dict[str, set[str]] = {}
        name = f"{agent_name}:inspect"
        budget = ToolLoopBudget(name, req.model, share, 0.0)
        agent = build_cleanup_agent(
            chat, INSPECT_SYSTEM_PROMPT, assignment.rounds, INSPECT_TOOLS, InspectReport
        )
        output = await agent.ainvoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": build_inspect_prompt(assignment.taskId, assignment.rounds),
                    }
                ]
            },
            context=CleanupAgentContext(
                name, usage, budget, assignment.rounds, reader, req.batch, {}, event_ids
            ),
            config={"recursion_limit": AGENT_RECURSION_LIMIT},
        )
        report = output.get("structured_response")
        if not isinstance(report, InspectReport):
            raise ValueError(f"{assignment.taskId} inspection produced no structured report")
        return {
            "reports": [report],
            "event_ids_by_task": event_ids,
            "model_cost_usd": budget.spent,
        }

    return inspect
