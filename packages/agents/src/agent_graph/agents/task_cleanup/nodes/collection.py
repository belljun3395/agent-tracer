"""task-cleanup 후보와 이벤트 근거를 수집하는 그래프 노드를 만든다."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.structured import invoke_structured, prompt
from ...runtime.serialization import json_value
from ..evidence import evidence_context, evidence_snapshot
from ..models import EventEvidence, InspectionPlan, InspectionTarget, TaskCleanupRequest, TaskCleanupState
from ..policy import CANDIDATE_BATCH_SIZE, TASK_CLEANUP_MAX_MODEL_COST_USD
from ..prompts import PLANNER_SYSTEM_PROMPT
from ..tools import MAX_EVENT_READS, MAX_PARALLEL_EVENT_READS, inspect_target, load_candidate_pages

type CleanupNode = Callable[[TaskCleanupState], Awaitable[dict[str, Any]]]


def create_collection_nodes(
    req: TaskCleanupRequest,
    client: httpx.AsyncClient,
    usage: ExecutionTrace,
    chat: Any,
    *,
    agent_name: str,
) -> tuple[CleanupNode, CleanupNode, CleanupNode]:
    """후보 초기화와 이벤트 조회 노드를 실행 의존성과 결합한다."""

    async def bootstrap_candidates(_state: TaskCleanupState) -> dict[str, Any]:
        pages = await load_candidate_pages(client, req.toolCallback, usage)
        candidates = [candidate for page in pages for candidate in page.candidates]
        deduped = list({candidate.id: candidate for candidate in candidates}.values())
        first_batch = deduped[:CANDIDATE_BATCH_SIZE]
        return {
            "candidates": deduped,
            "model_candidates": first_batch,
            "candidate_offset": len(first_batch),
        }

    async def plan_inspection(state: TaskCleanupState) -> dict[str, Any]:
        chain_prompt = prompt(
            PLANNER_SYSTEM_PROMPT,
            "Scan time: {scanned_at}\n"
            "Maximum suggestions: {max_suggestions}\n"
            "Candidates exposed for this run: {candidates}\n"
            "Prior assessment: {assessment}\n"
            "Evidence already read: {evidence}\n"
            "Plan the next bounded event reads.",
        )
        plan, cost = await invoke_structured(
            chat,
            chain_prompt,
            {
                "scanned_at": state["scanned_at"],
                "max_suggestions": state["max_suggestions"] - len(state["accepted_suggestions"]),
                "candidates": json_value(state["model_candidates"]),
                "assessment": json_value(state["assessment"]) if state["assessment"] else "(none)",
                "evidence": evidence_context(state["evidence"]),
            },
            InspectionPlan,
            usage,
            state["model_cost_usd"],
            req.model,
            agent_name=agent_name,
            max_cost_usd=TASK_CLEANUP_MAX_MODEL_COST_USD,
        )
        return {"plan": plan, "model_cost_usd": cost}

    async def gather_events(state: TaskCleanupState) -> dict[str, Any]:
        plan = state["plan"] or InspectionPlan(rationale="No reads were planned.")
        candidates = {candidate.id: candidate for candidate in state["model_candidates"]}
        remaining_reads = max(0, MAX_EVENT_READS - state["event_reads"])
        targets: list[InspectionTarget] = []
        seen_args = {(record.taskId, json_value(record.args)) for record in state["evidence"]}
        for target in plan.targets:
            candidate = candidates.get(target.taskId)
            target_args = target.model_dump(exclude={"purpose"}, exclude_none=True)
            key = (target.taskId, json_value(target_args))
            if candidate is None or not candidate.hasEvents or key in seen_args:
                continue
            seen_args.add(key)
            targets.append(target)
            if len(targets) >= remaining_reads:
                break
        semaphore = asyncio.Semaphore(MAX_PARALLEL_EVENT_READS)

        async def bounded(target: InspectionTarget, index: int) -> EventEvidence:
            async with semaphore:
                return await inspect_target(
                    client,
                    req.toolCallback,
                    usage,
                    target,
                    f"cleanup-events-{state['event_reads'] + index + 1}",
                )

        records = await asyncio.gather(*(bounded(target, i) for i, target in enumerate(targets)))
        evidence = [*state["evidence"], *records]
        _, event_ids_by_task = evidence_snapshot(evidence)
        return {
            "evidence": evidence,
            "event_ids_by_task": event_ids_by_task,
            "gather_rounds": state["gather_rounds"] + 1,
            "event_reads": state["event_reads"] + len(records),
        }

    return bootstrap_candidates, plan_inspection, gather_events
