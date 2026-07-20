"""워커가 보내는 요청·결과 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

from agent_graph.agents.recipe_scan.models import RecipeCandidate
from agent_graph.agents.title_suggestion.models import TitleSuggestionContext
from tests.support.golden import load_contract


def test_워커가_보내는_title_컨텍스트를_그대로_받는다() -> None:
    payload = load_contract("title.suggestion.context.json")

    context = TitleSuggestionContext.model_validate(payload)

    assert context.model_dump(mode="json", exclude_none=False) == payload


def test_공유_최종_DTO_fixture를_그대로_직렬화한다() -> None:
    payload = load_contract("recipe.scan.result.json")

    candidate = RecipeCandidate.model_validate(payload["recipes"][0])
    serialized = {"recipes": [candidate.model_dump(mode="json", exclude_none=True)]}

    assert serialized == payload
