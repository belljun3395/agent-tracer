"""title-suggestion의 정적 LangGraph 위상을 제공한다."""

from __future__ import annotations

from ..runtime.validation_graph import build_validation_graph
from .models import TitleSuggestionState

TITLE_SUGGESTION_GRAPH = build_validation_graph(TitleSuggestionState, "validate_candidate")
