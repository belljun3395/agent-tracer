"""recipe-scan의 전문가 조사 노드를 제공한다."""

from __future__ import annotations

import logging

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.llm.structured_agent import invoke_structured_agent
from ...runtime.node import GraphNode
from ..langchain_agent import build_recipe_agent
from ..models import (
    AGENT_RECURSION_LIMIT,
    MAX_VERDICT_CHARS,
    ProbeDispatch,
    ProbeReport,
    ProbeUpdate,
    ProvenanceCatalog,
    RecipeScanRequest,
)
from ..policy import MAX_RECIPE_MODEL_COST_USD
from ..prompts import PROBE_SYSTEM_PROMPT, build_probe_prompt
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader
from ..tools import PROBE_TOOLS, build_recipe_registry

_log = logging.getLogger(__name__)


def _failure_verdict(exc: Exception) -> str:
    """전문가 실행이 무너진 사유를 판정 상한 안으로 줄여 보고 문장으로 만든다."""
    summary = str(exc).strip() or type(exc).__name__
    return f"조사 실패: {summary}"[:MAX_VERDICT_CHARS]


class ProbeNode(GraphNode):
    """맡은 질문 하나를 자기 도구와 자기 예산과 자기 장부로 조사하는 전문가를 만든다."""

    name = "probe"

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

    async def run(self, payload: ProbeDispatch) -> ProbeUpdate:
        req = self._req
        assignment = payload.assignment
        share = MAX_RECIPE_MODEL_COST_USD * payload.cost_share
        # 장부를 전문가마다 새로 두어 다른 전문가가 읽은 것을 인용하지 못하게 한다.
        catalog = ProvenanceCatalog()
        probe_name = f"{self._agent_name}:{assignment.probe}"
        budget = ToolLoopBudget(probe_name, req.model, share, 0.0)
        # 전문가 하나가 무너져도 병렬 분기 전체를 버리지 않고 실패 사실을 보고로 올린다.
        # 취소(BaseException 계열)는 잡 전체를 멈추라는 신호이므로 잡지 않고 전파한다.
        try:
            registry = build_recipe_registry(
                self._reader,
                self._search,
                catalog,
                PROBE_TOOLS[assignment.probe],
                agent_name=self._agent_name,
            )
            agent = build_recipe_agent(
                self._chat,
                PROBE_SYSTEM_PROMPT,
                registry.langchain_tools(),
                registry.transient_errors(),
                max_rounds=assignment.rounds,
                output=ProbeReport,
            )
            result = await invoke_structured_agent(
                agent,
                messages=[
                    {
                        "role": "user",
                        "content": build_probe_prompt(req.taskId, assignment.question, assignment.rounds),
                    }
                ],
                context=StandardAgentContext(
                    agent_name=probe_name,
                    trace=self._usage,
                    budget=budget,
                    max_tool_rounds=assignment.rounds,
                ),
                response_type=ProbeReport,
                recursion_limit=AGENT_RECURSION_LIMIT,
                missing_response=f"{assignment.probe} probe produced no structured report",
            )
            report = result.response
        except Exception as exc:
            verdict = _failure_verdict(exc)
            _log.warning("probe %s failed: %s", assignment.probe, exc)
            report = ProbeReport(
                probe=assignment.probe,
                verdict=verdict,
                excerpts=[],
                exhausted=True,
            )
        return {
            "reports": [report],
            "provenance": catalog,
            "model_cost_usd": budget.spent,
        }
