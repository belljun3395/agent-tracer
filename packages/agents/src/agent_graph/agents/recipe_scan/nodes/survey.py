"""recipe-scan의 조사 계획 노드를 제공한다."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain_core.language_models import BaseChatModel

from ...runtime.execution.trace import ExecutionTrace
from ..models import DispatchPlan, RecipeScanRequest, RecipeScanState, SurveyUpdate
from ..policy import clamp_plan, distributable_rounds
from ..prompts import SURVEY_SYSTEM_PROMPT, build_survey_prompt

type SurveyNode = Callable[[RecipeScanState], Awaitable[SurveyUpdate]]

AVAILABLE_ROUNDS = distributable_rounds()


def create_survey_node(req: RecipeScanRequest, usage: ExecutionTrace, chat: BaseChatModel) -> SurveyNode:
    """조율자가 어디를 얼마나 팔지 스스로 정하게 하고 배분을 예산 안으로 가둔다."""
    planner = chat.with_structured_output(DispatchPlan)

    async def survey(_state: RecipeScanState) -> SurveyUpdate:
        raw = await planner.ainvoke(
            [
                {"role": "system", "content": SURVEY_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_survey_prompt(req.taskId, req.userPrompt, AVAILABLE_ROUNDS),
                },
            ]
        )
        plan = raw if isinstance(raw, DispatchPlan) else DispatchPlan.model_validate(raw)
        kept, cut = clamp_plan(plan, AVAILABLE_ROUNDS)
        chosen = ", ".join(f"{probe.probe}:{probe.rounds}" for probe in kept.probes)
        usage.record_graph_event(
            "route.selected",
            f"survey -> {chosen}" + (f" (배분 {cut}라운드 축소)" if cut else ""),
            node_name="survey",
        )
        return {"plan": kept}

    return survey
