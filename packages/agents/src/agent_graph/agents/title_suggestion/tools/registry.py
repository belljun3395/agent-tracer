"""요청별 의존을 받아 title-suggestion 도구 레지스트리를 조립하고 인자를 검증한다."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from ...runtime.tooling import ToolRegistry
from ..reader import TitleLedgerReader
from .get_task_events import GetTaskEventsTool

_ARGS_BY_TOOL: dict[str, type[BaseModel]] = {GetTaskEventsTool.name: GetTaskEventsTool.args_model}


def validate_tool_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """모델이 고른 도구 인자를 소유 스키마로 검증해 조회 인자를 만든다."""
    args_model = _ARGS_BY_TOOL.get(name)
    if args_model is None:
        raise ValueError(f"unknown title-suggestion tool: {name}")
    return args_model.model_validate(args).model_dump(exclude_none=True)


def build_title_registry(reader: TitleLedgerReader, *, agent_name: str) -> ToolRegistry:
    """요청별 사용자 범위 원장 조회를 쥔 도구 레지스트리를 만든다."""
    return ToolRegistry((GetTaskEventsTool(reader),), agent_name=agent_name)
