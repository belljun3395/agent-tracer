"""recipe-scan 도구 계약을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, get_args

import pytest
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.langchain_agent import PROBE_TOOLS, RECIPE_LANGCHAIN_TOOLS
from agent_graph.agents.recipe_scan.models import (
    MAX_PROBE_ROUNDS,
    MAX_RECIPE_CANDIDATES,
    MAX_TOOL_ROUNDS,
    Excerpt,
    ProbeReport,
    ProvenanceCatalog,
    RecipeCandidate,
)
from agent_graph.agents.recipe_scan.policy import MAX_RECIPE_MODEL_COST_USD, RECIPE_MAX_OUTPUT_TOKENS
from agent_graph.agents.recipe_scan.tools.client import record_evidence
from agent_graph.agents.recipe_scan.tools.contracts import (
    RECIPE_TOOLS,
    TimelineEventKind,
    validate_tool_args,
)

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"

VALID_ARGS: dict[str, dict[str, Any]] = {
    "get_task_summary": {"taskId": "task-1"},
    "get_task_events": {"taskId": "task-1"},
    "list_rules": {"taskId": "task-1"},
    "search_events": {"q": "migration"},
    "find_similar_tasks": {"anchorTaskId": "task-1"},
    "search_recipes": {"q": "migration"},
}


def _contract() -> Any:
    return json.loads((GOLDEN / "recipe.scan.tool.contract.json").read_text(encoding="utf-8"))


def _tools() -> Any:
    return _contract()["tools"]


def _fields(tool: str) -> Any:
    return next(spec.args_model for spec in RECIPE_TOOLS if spec.name == tool).model_fields


def _accepts(tool: str, field: str, value: object) -> bool:
    try:
        validate_tool_args(tool, {**VALID_ARGS[tool], field: value})
    except ValidationError:
        return False
    return True


def _candidate(orders: list[int]) -> RecipeCandidate:
    return RecipeCandidate(
        title="Add a migration",
        intent="마이그레이션을 안전하게 추가한다",
        description="스키마 변경이 필요할 때 쓴다.",
        summary_md="- 변경을 정의한다",
        request="사용자가 마이그레이션 추가를 요청했다.",
        steps=[{"order": order, "action": f"step-{order}"} for order in orders],  # type: ignore[list-item]
        contributing_slices=[{"taskId": "task-1", "eventIds": ["event-1"]}],  # type: ignore[list-item]
        rationale="반복 가능한 절차다.",
    )


def test_턴_예산이_골든_계약과_같다() -> None:
    assert MAX_TOOL_ROUNDS == _contract()["maxTurns"]


def test_후보_상한과_토큰과_비용_예산이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert MAX_RECIPE_CANDIDATES == limits["candidateLimit"]
    assert RECIPE_MAX_OUTPUT_TOKENS == limits["maxOutputTokens"]
    assert MAX_RECIPE_MODEL_COST_USD == limits["maxBudgetUsd"]


def test_모델에게_노출하는_도구_이름이_골든_계약과_같다() -> None:
    assert [spec.name for spec in RECIPE_TOOLS] == list(_tools())


def test_전문가_역할과_도구와_보고가_골든_계약과_같다() -> None:
    orchestration = _contract()["orchestration"]
    roles = {name: [tool.name for tool in tools] for name, tools in PROBE_TOOLS.items()}

    assert MAX_PROBE_ROUNDS == orchestration["workerMaxTurns"]
    assert roles == orchestration["roles"]
    assert list(ProbeReport.model_fields) == orchestration["workerReport"]["required"]
    assert list(Excerpt.model_fields) == orchestration["workerReport"]["excerptRequired"]


def test_표준_tool이_runtime을_숨기고_골든_인자만_노출한다() -> None:
    tools = {tool.name: tool for tool in RECIPE_LANGCHAIN_TOOLS}

    assert set(tools) == set(_tools())
    for name, tool in tools.items():
        schema = tool.tool_call_schema.model_json_schema()
        contract = _tools()[name]
        assert set(schema.get("required", [])) == set(contract["required"])
        assert set(schema["properties"]) == set(contract["required"] + contract["optional"])
        assert "runtime" not in schema["properties"]


def test_도구마다_필수와_선택_인자가_골든_계약과_같다() -> None:
    for tool, contract in _tools().items():
        fields = _fields(tool)
        required = {name for name, field in fields.items() if field.is_required()}

        assert required == set(contract["required"])
        assert set(fields) - required == set(contract["optional"])


def test_도구마다_수치_인자의_기본값과_상하한이_골든_계약과_같다() -> None:
    for tool, contract in _tools().items():
        for field, bound in contract.get("numbers", {}).items():
            assert _fields(tool)[field].default == bound["default"]
            assert _accepts(tool, field, bound["min"])
            assert _accepts(tool, field, bound["max"])
            assert not _accepts(tool, field, bound["min"] - 1)
            assert not _accepts(tool, field, bound["max"] + 1)


def test_도구마다_열거_인자의_값과_기본값이_골든_계약과_같다() -> None:
    for tool, contract in _tools().items():
        for field, enumeration in contract.get("enums", {}).items():
            assert all(_accepts(tool, field, value) for value in enumeration["values"])
            assert not _accepts(tool, field, "drifted.value")
            if "default" in enumeration:
                assert _fields(tool)[field].default == enumeration["default"]


def test_search_events가_거르는_이벤트_종류가_골든_계약과_같다() -> None:
    assert list(get_args(TimelineEventKind)) == _tools()["search_events"]["enums"]["kind"]["values"]


def test_search_events_응답의_taskId로_태스크를_가로지른_근거를_기록한다() -> None:
    response = _tools()["search_events"]["responseEvent"]
    catalog = ProvenanceCatalog()
    hit = {name: "" for name in response["required"]} | {"id": "event-9", "taskId": "other-task"}

    record_evidence(catalog, "search_events", {"q": "migration"}, json.dumps({"events": [hit]}))

    assert "taskId" in response["required"]
    assert catalog.eventIdsByTask == {"other-task": {"event-9"}}


def test_steps의_order가_1부터_연속하지_않으면_거부한다() -> None:
    assert _contract()["steps"]["consecutiveFromOne"] is True
    assert [step.order for step in _candidate([1, 2]).steps] == [1, 2]

    with pytest.raises(ValidationError):
        _candidate([1, 3])


def test_도구_설명이_골든_계약과_같다() -> None:
    contract = _contract()["descriptions"]

    assert {tool.name: tool.description for tool in RECIPE_TOOLS} == contract
