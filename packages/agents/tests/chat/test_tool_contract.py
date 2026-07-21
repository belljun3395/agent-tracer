"""chat 도구 표면과 예산을 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

from typing import Any

from agent_graph.agents.chat.policy import (
    CHAT_MAX_MODEL_COST_USD,
    CHAT_MAX_OUTPUT_TOKENS,
    MAX_MODEL_TURNS,
)
from agent_graph.agents.chat.tools import (
    MEMORY_TOOL_NAMES,
    READ_TOOL_NAMES,
    TOOL_SPECS,
    WRITE_TOOL_NAMES,
    EnumArg,
    NumberArg,
    ToolSpec,
    build_chat_registry,
)
from tests.support.golden import load_contract

CONTRACT_FIXTURE = "chat.tool.contract.json"


def _contract() -> Any:
    return load_contract(CONTRACT_FIXTURE)


def _langchain_tools() -> dict[str, Any]:
    registry = build_chat_registry(None, [], [], [], {}, agent_name="chat")
    return {tool.name: tool for tool in registry.langchain_tools()}


def _expected(spec: ToolSpec) -> dict[str, Any]:
    expected: dict[str, Any] = {
        "required": list(spec.required),
        "optional": list(spec.optional),
        "mutation": spec.mutation,
    }
    for arg, constraint in spec.constraints.items():
        if isinstance(constraint, EnumArg):
            expected[arg] = {"values": list(constraint.values)}
        elif isinstance(constraint, NumberArg):
            expected[arg] = {
                "default": constraint.default,
                "min": constraint.minimum,
                "max": constraint.maximum,
            }
    return expected


def test_턴_예산이_골든_계약과_같다() -> None:
    assert _contract()["maxTurns"] == MAX_MODEL_TURNS


def test_토큰과_비용_예산이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert limits["maxOutputTokens"] == CHAT_MAX_OUTPUT_TOKENS
    assert limits["maxBudgetUsd"] == CHAT_MAX_MODEL_COST_USD


def test_모델에게_여는_도구_이름이_골든_계약과_같다() -> None:
    assert set(_langchain_tools()) == set(_contract()["tools"])
    assert set(TOOL_SPECS) == set(_contract()["tools"])


def test_mutation_분할이_골든_계약과_같다() -> None:
    tools = _contract()["tools"]
    mutation = {name for name, spec in tools.items() if spec["mutation"]}

    assert set(WRITE_TOOL_NAMES) == mutation
    assert set(READ_TOOL_NAMES) | set(MEMORY_TOOL_NAMES) == set(tools) - mutation
    assert set(MEMORY_TOOL_NAMES) == {"recall_facts", "remember_fact"}


def test_각_도구의_인자_계약이_골든_계약과_바이트로_같다() -> None:
    tools = _contract()["tools"]

    for name, spec in TOOL_SPECS.items():
        assert _expected(spec) == tools[name]


def test_표준_tool이_runtime을_숨기고_골든_인자만_노출한다() -> None:
    tools = _langchain_tools()
    contract = _contract()["tools"]

    for name, tool in tools.items():
        schema = tool.tool_call_schema
        spec = contract[name]
        assert set(schema.get("required", [])) == set(spec["required"])
        assert set(schema["properties"]) == set(spec["required"] + spec["optional"])
        assert "runtime" not in schema["properties"]
