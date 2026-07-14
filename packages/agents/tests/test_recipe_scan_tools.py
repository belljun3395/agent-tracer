"""recipe-scan 도구 계약과 콜백 실행과 근거 원장을 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.models import EvidenceRecord, ProvenanceCatalog
from agent_graph.agents.recipe_scan.tools.client import RECIPE_TOOL_SPECS, invoke_tool, record_evidence
from agent_graph.agents.recipe_scan.tools.contracts import validate_tool_args
from agent_graph.agents.recipe_scan.tools.provenance import add_provenance
from agent_graph.agents.shared.models import ToolCallback
from tests.fakes import FakeToolClient


def test_Python이_도구_이름_설명_인자스키마를_소유한다() -> None:
    catalog = [tool.to_anthropic() for tool in RECIPE_TOOL_SPECS]

    assert [tool["name"] for tool in catalog] == [
        "get_task_summary",
        "get_task_events",
        "list_rules",
        "search_events",
        "find_similar_tasks",
        "search_recipes",
    ]
    assert all(tool["description"] and tool["input_schema"] for tool in catalog)
    search_schema = next(tool["input_schema"] for tool in catalog if tool["name"] == "search_events")
    assert isinstance(search_schema, dict)
    assert "kind" in search_schema["properties"]
    assert search_schema["required"] == ["q"]


def test_taskId_없이도_태스크를_가로질러_검색한다() -> None:
    assert validate_tool_args("search_events", {"q": "failure"}) == {
        "q": "failure",
        "limit": 20,
        "offset": 0,
    }


def test_도구_스키마에_없는_인자는_콜백_전에_거부한다() -> None:
    with pytest.raises(ValidationError):
        validate_tool_args("search_events", {"q": "failure", "drifted": "arg"})


def test_알_수_없는_이벤트_종류는_콜백_전에_거부한다() -> None:
    with pytest.raises(ValidationError):
        validate_tool_args("search_events", {"q": "failure", "kind": "drifted.kind"})


def test_아는_이벤트_종류로_거를_수_있다() -> None:
    validated = validate_tool_args(
        "search_events",
        {"q": "failure", "kind": "agent_tracer.user.message"},
    )

    assert validated["kind"] == "agent_tracer.user.message"


def test_모델이_없는_도구를_부르면_거부한다() -> None:
    with pytest.raises(ValueError, match="unknown recipe-scan tool"):
        validate_tool_args("delete_everything", {})


async def test_유효하지_않은_도구_인자는_실제_콜백을_호출하지_않는다() -> None:
    client = FakeToolClient({"search_events": {"events": []}})
    callback = ToolCallback(url="http://worker:8810/tools/invoke", token="token-1")

    with pytest.raises(ValidationError):
        await invoke_tool(
            client,  # type: ignore[arg-type]
            callback,
            "search_events",
            {"q": "failure", "taskId": "task-1", "kind": "drifted.kind"},
        )

    assert client.calls == []


def test_빈_이벤트_커서는_콜백_전에_거부한다() -> None:
    with pytest.raises(ValidationError):
        validate_tool_args("get_task_events", {"taskId": "task-1", "cursor": ""})


def test_revision이_있는_recipe만_수정_근거로_인정한다() -> None:
    catalog = ProvenanceCatalog()
    record = EvidenceRecord(
        tool="search_recipes",
        args={"q": "migration"},
        content="[]",
        parsed=[
            {"id": "versioned", "rev": 2},
            {"id": "boolean", "rev": True},
            {"id": "unversioned"},
        ],
        purpose="기존 recipe를 찾는다",
    )

    add_provenance(catalog, record)

    assert catalog.recipeIds == {"versioned"}


async def test_모델이_생략한_인자는_도구_기본값으로_채워_부른다() -> None:
    client = FakeToolClient(
        {"get_task_events": {"events": [{"id": "event-1", "taskId": "task-1"}]}}
    )
    callback = ToolCallback(url="http://worker:8810/tools/invoke", token="token-1")

    content = await invoke_tool(
        client,  # type: ignore[arg-type]
        callback,
        "get_task_events",
        {"taskId": "task-1"},
    )

    assert client.args == [{"taskId": "task-1", "limit": 100, "order": "asc"}]
    assert "event-1" in content


def test_도구가_돌려준_이벤트만_인용_가능한_근거로_올린다() -> None:
    catalog = ProvenanceCatalog()

    record_evidence(
        catalog,
        "get_task_events",
        {"taskId": "task-1"},
        '{"events": [{"id": "event-1", "turnId": "turn-1"}]}',
    )

    assert catalog.eventIdsByTask == {"task-1": {"event-1"}}
    assert catalog.turnIdsByTask == {"task-1": {"turn-1"}}


def test_이벤트_근거는_태스크별_원장으로_모으고_불완전한_행은_버린다() -> None:
    catalog = ProvenanceCatalog()
    record = EvidenceRecord(
        tool="search_events",
        args={"taskId": "anchor-task", "q": "failure"},
        content="{}",
        parsed={
            "events": [
                {"id": "event-1"},
                {"id": "event-2", "taskId": "related-task"},
                {"id": ""},
                {"taskId": "anchor-task"},
                "not-an-event",
            ]
        },
        purpose="관련 이벤트를 찾는다",
    )

    add_provenance(catalog, record)

    assert catalog.eventIdsByTask == {
        "anchor-task": {"event-1"},
        "related-task": {"event-2"},
    }


def test_규칙_ID를_근거_원장에_기록한다() -> None:
    catalog = ProvenanceCatalog()
    record = EvidenceRecord(
        tool="list_rules",
        args={"taskId": "task-1"},
        content="[]",
        parsed=[{"id": "rule-1"}],
    )

    add_provenance(catalog, record)

    assert catalog.ruleIds == {"rule-1"}


@pytest.mark.parametrize(
    ("tool", "args", "parsed"),
    [
        ("get_task_summary", {"taskId": "task-1"}, {"id": "task-1"}),
        ("find_similar_tasks", {"anchorTaskId": "task-1"}, [{"id": "task-2"}]),
    ],
)
def test_이름만_돌려준_태스크는_근거_원장에_오르지_않는다(
    tool: str,
    args: dict[str, Any],
    parsed: Any,
) -> None:
    catalog = ProvenanceCatalog()
    record = EvidenceRecord.model_validate(
        {"tool": tool, "args": args, "content": "{}", "parsed": parsed}
    )

    add_provenance(catalog, record)

    assert catalog.eventIdsByTask == {}
