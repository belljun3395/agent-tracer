"""recipe-scan의 근거 수집과 충분성 평가 그래프 노드를 만든다."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ...runtime.serialization import json_value
from ..evidence import evidence_context, record_tool_records
from ..models import (
    EvidenceAssessment,
    EvidencePlan,
    EvidenceQuery,
    RecipeScanRequest,
    RecipeScanState,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD
from ..prompts import ASSESSOR_SYSTEM_PROMPT, PLANNER_SYSTEM_PROMPT
from ..tools.client import invoke_query
from ..tools.contracts import tool_catalog, validate_query
from ..tools.provenance import add_provenance

type RecipeNode = Callable[[RecipeScanState], Awaitable[dict[str, Any]]]


def create_evidence_nodes(
    req: RecipeScanRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[RecipeNode, RecipeNode, RecipeNode, RecipeNode]:
    """근거 조회와 평가 노드를 모델과 도구 실행 의존성에 결합한다."""

    async def bootstrap(state: RecipeScanState) -> dict[str, Any]:
        queries = [
            EvidenceQuery(
                tool="get_task_summary",
                args={"taskId": state["task_id"], "window": 400},
                purpose="Understand the anchor task cheaply.",
            ),
            EvidenceQuery(
                tool="list_rules",
                args={"taskId": state["task_id"]},
                purpose="Identify rules already governing the workflow.",
            ),
            EvidenceQuery(
                tool="get_task_events",
                args={"taskId": state["task_id"], "limit": 100, "order": "asc"},
                purpose="Read the beginning of the anchor trajectory.",
            ),
        ]
        records = await asyncio.gather(*(invoke_query(client, req.toolCallback, q) for q in queries))
        record_tool_records(usage, records, phase="bootstrap", round_number=1)
        provenance = state["provenance"].model_copy(deep=True)
        for record in records:
            add_provenance(provenance, record)
        return {"evidence": [*state["evidence"], *records], "provenance": provenance}

    async def plan_evidence(state: RecipeScanState) -> dict[str, Any]:
        chain_prompt = prompt(
            PLANNER_SYSTEM_PROMPT,
            "Anchor task: {task_id}\n"
            "User direction: {user_prompt}\n"
            "Previous assessment: {assessment}\n"
            "Tool catalog: {tool_catalog}\n"
            "Evidence collected so far: {evidence}\n"
            "Plan additional evidence reads.",
        )
        plan, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "task_id": state["task_id"],
                "user_prompt": state["user_prompt"] or "(none)",
                "assessment": (json_value(state["assessment"]) if state["assessment"] else "(first pass)"),
                "tool_catalog": json_value(tool_catalog()),
                "evidence": evidence_context(state),
            },
            EvidencePlan,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
        )
        return {"plan": plan, "model_cost_usd": cost}

    async def gather_evidence(state: RecipeScanState) -> dict[str, Any]:
        plan = state["plan"] or EvidencePlan(rationale="No additional reads were planned.")
        valid_queries: list[EvidenceQuery] = []
        for query in plan.queries:
            try:
                validate_query(query)
            except ValueError:
                continue
            valid_queries.append(query)
        records = await asyncio.gather(
            *(invoke_query(client, req.toolCallback, query) for query in valid_queries)
        )
        record_tool_records(
            usage,
            records,
            phase="gather",
            round_number=state["gather_rounds"] + 1,
        )
        provenance = state["provenance"].model_copy(deep=True)
        for record in records:
            add_provenance(provenance, record)
        return {
            "evidence": [*state["evidence"], *records],
            "provenance": provenance,
            "gather_rounds": state["gather_rounds"] + 1,
        }

    async def assess_evidence(state: RecipeScanState) -> dict[str, Any]:
        chain_prompt = prompt(
            ASSESSOR_SYSTEM_PROMPT,
            "Anchor task: {task_id}\n"
            "Evidence: {evidence}\n"
            "Provenance: {provenance}\n"
            "Decide whether a verified reusable workflow can be written.",
        )
        assessment, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "task_id": state["task_id"],
                "evidence": evidence_context(state),
                "provenance": json_value(state["provenance"]),
            },
            EvidenceAssessment,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=MAX_RECIPE_MODEL_COST_USD,
        )
        has_anchor_events = bool(state["provenance"].eventIdsByTask.get(state["task_id"]))
        if assessment.sufficient and not has_anchor_events:
            assessment = assessment.model_copy(
                update={
                    "sufficient": False,
                    "reason": "No anchor event IDs were returned, so the workflow cannot be verified.",
                    "missingEvidence": ["Read anchor task events that demonstrate completed work."],
                }
            )
        return {"assessment": assessment, "model_cost_usd": cost}

    return bootstrap, plan_evidence, gather_evidence, assess_evidence
