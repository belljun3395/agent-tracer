"""task-cleanup의 정적 LangGraph 위상을 제공한다."""

from __future__ import annotations

from ..runtime.validation_graph import build_validation_graph
from .models import TaskCleanupState

TASK_CLEANUP_GRAPH = build_validation_graph(TaskCleanupState, "validate_decisions")
