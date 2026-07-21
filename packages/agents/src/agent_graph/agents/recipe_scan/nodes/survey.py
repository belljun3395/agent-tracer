"""recipe-scan의 조사 계획 노드를 제공한다."""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.node import GraphNode
from ..models import DispatchPlan, RecipeScanRequest, RecipeScanState, SurveyUpdate
from ..prompts import SURVEY_SYSTEM_PROMPT, build_survey_prompt


class SurveyNode(GraphNode):
    """조율자가 어디를 얼마나 팔지 weight로 스스로 정하게 한다."""

    name = "survey"

    def __init__(self, req: RecipeScanRequest, usage: ExecutionTrace, chat: BaseChatModel) -> None:
        self._req = req
        self._usage = usage
        self._planner = chat.with_structured_output(DispatchPlan)

    async def run(self, _state: RecipeScanState) -> SurveyUpdate:
        req = self._req
        raw = await self._planner.ainvoke(
            [
                {"role": "system", "content": SURVEY_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_survey_prompt(req.taskId, req.userPrompt),
                },
            ]
        )
        plan = raw if isinstance(raw, DispatchPlan) else DispatchPlan.model_validate(raw)
        chosen = ", ".join(f"{probe.probe}:{probe.weight}" for probe in plan.probes)
        self._usage.record_graph_event(
            "route.selected",
            f"{self.name} -> {chosen}",
            node_name=self.name,
        )
        return {"plan": plan}
