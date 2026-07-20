"""title-suggestion의 후보 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.routing import build_validation_router
from .models import TitleSuggestionDraft, TitleSuggestionState

TITLE_MAX_OUTPUT_TOKENS = 4_000
MAX_TITLE_MODEL_COST_USD = 0.2
# 모델이 스스로 도구를 고르므로 라운드 수가 곧 조사 예산이다.
MAX_TOOL_ROUNDS = 4

# 라운드 예산은 agent의 호출 한도가 집행한다. 한 라운드가 before_model·model·after_model·tools
# 네 슈퍼스텝을 도는 데다 미들웨어를 더하면 더 늘어나므로, 재귀 한도는 예산을 세는 자리가 아니라
# 폭주만 끊는 그물이다.
AGENT_RECURSION_LIMIT = 10 * MAX_TOOL_ROUNDS

type ValidationRoute = Callable[[TitleSuggestionState], Literal["repair", "finalize", "empty"]]


def validate_title_candidate(
    candidate: TitleSuggestionDraft | None,
    current_title: str,
) -> list[str]:
    """제목 후보의 수·중복·자리표시자 제약을 검증한다."""
    if candidate is None:
        return ["No title-suggestion candidate was produced."]
    suggestions = candidate.suggestions
    if not suggestions:
        return []
    errors: list[str] = []
    if len(suggestions) < 2:
        errors.append("suggestions must be empty or contain 2-3 items")
    current = _normalize_title(current_title)
    seen: set[str] = set()
    for index, suggestion in enumerate(suggestions):
        normalized = _normalize_title(suggestion.title)
        if normalized == current:
            errors.append(f"suggestion {index + 1} repeats the current title")
        if normalized in seen:
            errors.append(f"suggestion {index + 1} duplicates another suggestion")
        seen.add(normalized)
        if _is_placeholder(normalized):
            errors.append(f"suggestion {index + 1} is a placeholder title")
    return errors


def build_routes(trace: ExecutionTrace, validation_node: str) -> ValidationRoute:
    """후보 검증 결과에 따른 분기 함수를 만든다."""
    return build_validation_router(
        trace,
        validation_node,
        pass_reason="candidate passed deterministic title validation",
        repair_reason="candidate failed validation and one repair attempt remains",
        exhausted_reason="candidate remained invalid after the repair attempt",
    )


def _normalize_title(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).casefold()


def _is_placeholder(normalized: str) -> bool:
    return (
        normalized in {"untitled", "test"} or re.fullmatch(r"task(?:\s|[-_:#])*\d+", normalized) is not None
    )
