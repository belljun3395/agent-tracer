"""recipe-scan의 전문가 조사 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ..langchain_agent import PROBE_TOOLS, RecipeAgentContext, build_recipe_agent
from ..models import (
    AGENT_RECURSION_LIMIT,
    MAX_VERDICT_CHARS,
    ProbeDispatch,
    ProbeReport,
    ProvenanceCatalog,
    RecipeScanRequest,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD
from ..prompts import PROBE_SYSTEM_PROMPT, build_probe_prompt
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader

type ProbeNode = Callable[[ProbeDispatch], Awaitable[dict[str, Any]]]


def _failure_verdict(exc: Exception) -> str:
    """전문가 실행이 무너진 사유를 판정 상한 안으로 줄여 보고 문장으로 만든다."""
    summary = str(exc).strip() or type(exc).__name__
    return f"조사 실패: {summary}"[:MAX_VERDICT_CHARS]


def create_probe_node(
    req: RecipeScanRequest,
    reader: RecipeLedgerReader,
    search: RecipeSearchReader,
    usage: ExecutionTrace,
    chat: BaseChatModel,
    *,
    agent_name: str,
) -> ProbeNode:
    """맡은 질문 하나를 자기 도구와 자기 예산과 자기 장부로 조사하는 전문가를 만든다."""

    async def probe(payload: ProbeDispatch) -> dict[str, Any]:
        assignment = payload.assignment
        share = MAX_RECIPE_MODEL_COST_USD * payload.cost_share
        # 장부를 전문가마다 새로 두어 다른 전문가가 읽은 것을 인용하지 못하게 한다.
        catalog = ProvenanceCatalog()
        budget = ToolLoopBudget(f"{agent_name}:{assignment.probe}", req.model, share, 0.0)
        # 전문가 하나가 무너져도 병렬 분기 전체를 버리지 않고 실패 사실을 보고로 올린다.
        # 취소(BaseException 계열)는 잡 전체를 멈추라는 신호이므로 잡지 않고 전파한다.
        try:
            agent = build_recipe_agent(
                chat,
                PROBE_SYSTEM_PROMPT,
                assignment.rounds,
                PROBE_TOOLS[assignment.probe],
                ProbeReport,
            )
            output = await agent.ainvoke(
                {
                    "messages": [
                        {
                            "role": "user",
                            "content": build_probe_prompt(
                                req.taskId, assignment.question, assignment.rounds
                            ),
                        }
                    ]
                },
                context=RecipeAgentContext(
                    f"{agent_name}:{assignment.probe}",
                    usage,
                    budget,
                    assignment.rounds,
                    reader,
                    search,
                    catalog,
                ),
                config={"recursion_limit": AGENT_RECURSION_LIMIT},
            )
            report = output.get("structured_response")
            if not isinstance(report, ProbeReport):
                raise ValueError(f"{assignment.probe} probe produced no structured report")
        except Exception as exc:
            report = ProbeReport(
                probe=assignment.probe,
                verdict=_failure_verdict(exc),
                excerpts=[],
                exhausted=True,
            )
        return {
            "reports": [report],
            "provenance": catalog,
            "model_cost_usd": budget.spent,
        }

    return probe
