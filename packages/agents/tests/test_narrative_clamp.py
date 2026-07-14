"""그래프 내부 서술이 상한을 넘겨도 실행을 버리지 않는지 검증한다."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.models import RecipeCandidate
from agent_graph.agents.task_cleanup.models import CleanupAssessment, InspectionPlan


def test_점검_계획_서술이_상한을_넘으면_잘라서_받는다() -> None:
    plan = InspectionPlan.model_validate({"rationale": "가" * 900, "targets": []})

    assert len(plan.rationale) == 500


def test_평가_서술도_잘라서_받는다() -> None:
    assessment = CleanupAssessment.model_validate({"rationale": "나" * 900, "suggestions": []})

    assert len(assessment.rationale) == 500


def test_저장되는_후보의_서술은_잘라내지_않고_거부한다() -> None:
    with pytest.raises(ValidationError):
        RecipeCandidate.model_validate(
            {
                "title": "제목",
                "intent": "의도",
                "description": "설명",
                "summary_md": "- 요약",
                "request": "요청",
                "contributing_slices": [{"taskId": "t1", "turnIds": [], "eventIds": ["e1"]}],
                "rationale": "라" * 900,
            },
        )
