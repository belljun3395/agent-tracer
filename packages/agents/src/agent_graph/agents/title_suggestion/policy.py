"""title-suggestion의 후보 검증과 조건부 분기 정책을 소유한다."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from typing import Literal

from ..runtime.execution.trace import ExecutionTrace
from .models import TitleSuggestionDraft, TitleSuggestionState

TITLE_MAX_OUTPUT_TOKENS = 4_000
MAX_TITLE_MODEL_COST_USD = 0.2

type AssessmentRoute = Callable[[TitleSuggestionState], Literal["empty", "gather_events", "synthesize"]]
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


def build_routes(trace: ExecutionTrace) -> tuple[AssessmentRoute, ValidationRoute]:
    """컨텍스트 평가와 후보 검증 결과에 따른 분기 함수를 만든다."""

    def route_assessment(
        state: TitleSuggestionState,
    ) -> Literal["empty", "gather_events", "synthesize"]:
        assessment = state["assessment"]
        action = assessment.action if assessment is not None else "gather"
        route: Literal["empty", "gather_events", "synthesize"]
        if action == "keep" and not _is_placeholder(_normalize_title(state["context"].title)):
            route = "empty"
        elif action == "keep":
            route = "synthesize"
            reason = "The current title is a placeholder and cannot be kept."
        elif action == "gather":
            route = "gather_events"
        else:
            route = "synthesize"
        if action != "keep" or route == "empty":
            reason = assessment.reason if assessment is not None else "No assessment was produced."
        trace.record_graph_event(
            "route.selected",
            f"assess_context -> {route}: {reason}",
            node_name="assess_context",
        )
        return route

    def route_validation(
        state: TitleSuggestionState,
    ) -> Literal["repair", "finalize", "empty"]:
        if not state["validation_errors"]:
            route: Literal["repair", "finalize", "empty"] = "finalize"
            reason = "candidate passed deterministic title validation"
        elif not state["repair_attempted"]:
            route = "repair"
            reason = "candidate failed validation and one repair attempt remains"
        else:
            route = "empty"
            reason = "candidate remained invalid after the repair attempt"
        trace.record_graph_event(
            "route.selected",
            f"validate_candidate -> {route}: {reason}",
            node_name="validate_candidate",
        )
        return route

    return route_assessment, route_validation


def _normalize_title(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).casefold()


def _is_placeholder(normalized: str) -> bool:
    return (
        normalized in {"untitled", "test"} or re.fullmatch(r"task(?:\s|[-_:#])*\d+", normalized) is not None
    )
