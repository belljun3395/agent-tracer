"""title-suggestion 도구 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, get_args

import pytest
from pydantic import ValidationError

from agent_graph.agents.title_suggestion.policy import MAX_TOOL_ROUNDS
from agent_graph.agents.title_suggestion.tools import (
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    GetTaskEventsArgs,
)

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"


def _contract() -> Any:
    return json.loads((GOLDEN / "title.suggestion.tool.contract.json").read_text(encoding="utf-8"))


def test_턴_예산이_골든_계약과_같다() -> None:
    assert MAX_TOOL_ROUNDS == _contract()["maxTurns"]


def test_get_task_events의_필수와_선택_인자가_골든_계약과_같다() -> None:
    contract = _contract()["getTaskEvents"]

    required = {name for name, field in GetTaskEventsArgs.model_fields.items() if field.is_required()}
    optional = set(GetTaskEventsArgs.model_fields) - required

    assert required == set(contract["required"])
    assert optional == set(contract["optional"])


def test_limit의_기본값과_최소와_최대가_골든_계약과_같다() -> None:
    limit = _contract()["getTaskEvents"]["limit"]

    assert DEFAULT_EVENT_LIMIT == limit["default"]
    assert MIN_EVENT_LIMIT == limit["min"]
    assert MAX_EVENT_LIMIT == limit["max"]
    assert GetTaskEventsArgs.model_validate({"taskId": "task-1"}).limit == limit["default"]
    assert GetTaskEventsArgs.model_validate({"taskId": "task-1", "limit": limit["max"]}).limit == limit["max"]
    with pytest.raises(ValidationError):
        GetTaskEventsArgs.model_validate({"taskId": "task-1", "limit": limit["max"] + 1})


def test_읽기_방향의_기본값과_허용_값이_골든_계약과_같다() -> None:
    order = _contract()["getTaskEvents"]["order"]
    field = GetTaskEventsArgs.model_fields["order"]

    assert DEFAULT_EVENT_ORDER == order["default"]
    assert GetTaskEventsArgs.model_validate({"taskId": "task-1"}).order == order["default"]
    assert list(get_args(field.annotation)) == order["values"]
