"""title-suggestion 도구 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

from typing import Any, get_args

import pytest
from pydantic import ValidationError

from agent_graph.agents.title_suggestion.models import (
    MAX_CONTEXT_TURNS,
    RECENT_TURN_LIMIT,
    TitleSuggestionContext,
)
from agent_graph.agents.title_suggestion.policy import (
    MAX_TITLE_MODEL_COST_USD,
    MAX_TOOL_ROUNDS,
    TITLE_MAX_OUTPUT_TOKENS,
)
from agent_graph.agents.title_suggestion.reader import TitleLedgerReader
from agent_graph.agents.title_suggestion.tools import (
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    GET_TASK_EVENTS,
    GET_TASK_EVENTS_DESCRIPTION,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    GetTaskEventsArgs,
    build_title_registry,
)
from tests.support.fakes import FakeLedger
from tests.support.golden import load_contract

_CONTRACT_NAME = "title.suggestion.tool.contract.json"


def _contract() -> Any:
    return load_contract(_CONTRACT_NAME)


def _langchain_tool() -> Any:
    registry = build_title_registry(
        TitleLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        agent_name="title-suggestion",
    )
    return registry.langchain_tools()[0]


def _turns(count: int) -> list[dict[str, Any]]:
    return [{"turnIndex": index, "askedText": f"ask {index}"} for index in range(count)]


def _context(turn_count: int) -> dict[str, Any]:
    return {
        "title": "Untitled",
        "status": "completed",
        "totalEventCount": 3 * turn_count,
        "totalTurnCount": turn_count,
        "truncated": True,
        "turns": _turns(turn_count),
    }


def test_턴_예산이_골든_계약과_같다() -> None:
    assert MAX_TOOL_ROUNDS == _contract()["maxTurns"]


def test_토큰과_비용_예산이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert TITLE_MAX_OUTPUT_TOKENS == limits["maxOutputTokens"]
    assert MAX_TITLE_MODEL_COST_USD == limits["maxBudgetUsd"]


def test_최근_턴_창과_컨텍스트가_싣는_턴_수의_상한이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert RECENT_TURN_LIMIT == limits["recentTurnLimit"]
    assert MAX_CONTEXT_TURNS == limits["maxContextTurns"]
    accepted = TitleSuggestionContext.model_validate(_context(limits["maxContextTurns"]))
    assert len(accepted.turns) == limits["maxContextTurns"]
    with pytest.raises(ValidationError):
        TitleSuggestionContext.model_validate(_context(limits["maxContextTurns"] + 1))


def test_get_task_events의_필수와_선택_인자가_골든_계약과_같다() -> None:
    contract = _contract()["getTaskEvents"]

    required = {name for name, field in GetTaskEventsArgs.model_fields.items() if field.is_required()}
    optional = set(GetTaskEventsArgs.model_fields) - required

    assert required == set(contract["required"])
    assert optional == set(contract["optional"])


def test_표준_tool이_runtime을_숨기고_골든_인자만_노출한다() -> None:
    contract = _contract()["getTaskEvents"]
    tool = _langchain_tool()
    schema = tool.tool_call_schema.model_json_schema()

    assert tool.name == "get_task_events"
    assert set(schema["required"]) == set(contract["required"])
    assert set(schema["properties"]) == set(contract["required"] + contract["optional"])
    assert "runtime" not in schema["properties"]


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


def test_도구_설명이_골든_계약과_같다() -> None:
    contract = _contract()["descriptions"]

    assert {GET_TASK_EVENTS: GET_TASK_EVENTS_DESCRIPTION} == contract
