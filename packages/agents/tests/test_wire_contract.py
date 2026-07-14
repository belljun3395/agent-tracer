"""워커가 보내는 요청·결과 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agent_graph.agents.recipe_scan.models import RecipeCandidate
from agent_graph.agents.title_suggestion.models import TitleSuggestionContext

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"


def _load(name: str) -> Any:
    return json.loads((GOLDEN / name).read_text(encoding="utf-8"))


def test_워커가_보내는_title_컨텍스트를_그대로_받는다() -> None:
    payload = _load("title.suggestion.context.json")

    context = TitleSuggestionContext.model_validate(payload)

    assert context.model_dump(mode="json", exclude_none=False) == payload


def test_공유_최종_DTO_fixture를_그대로_직렬화한다() -> None:
    payload = _load("recipe.scan.result.json")

    candidate = RecipeCandidate.model_validate(payload["recipes"][0])
    serialized = {"recipes": [candidate.model_dump(mode="json", exclude_none=True)]}

    assert serialized == payload
