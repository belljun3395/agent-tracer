"""recipe-scan 도구 계약과 콜백 실행과 근거 원장을 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.models import EvidenceQuery, EvidenceRecord, ProvenanceCatalog
from agent_graph.agents.recipe_scan.tools.client import invoke_query
from agent_graph.agents.recipe_scan.tools.contracts import tool_catalog, validate_query
from agent_graph.agents.recipe_scan.tools.provenance import add_provenance
from agent_graph.agents.shared.models import ToolCallback
from tests.fakes import FakeToolClient


def test_Python이_도구_이름_설명_인자스키마를_소유한다() -> None:
    catalog = tool_catalog()

    assert [tool["name"] for tool in catalog] == [
        "get_task_summary",
        "get_task_events",
        "list_rules",
        "search_events",
        "find_similar_tasks",
        "search_recipes",
    ]
    assert all(tool["description"] and tool["parameters"] for tool in catalog)
    search_schema = next(tool["parameters"] for tool in catalog if tool["name"] == "search_events")
    assert isinstance(search_schema, dict)
    assert "kind" not in search_schema["properties"]


def test_도구_스키마에_없는_인자는_콜백_전에_거부한다() -> None:
    query = EvidenceQuery(
        tool="search_events",
        args={"q": "failure", "kind": "drifted.kind"},
        purpose="실패 근거를 찾는다",
    )

    with pytest.raises(ValidationError):
        validate_query(query)


async def test_유효하지_않은_도구_인자는_실제_콜백을_호출하지_않는다() -> None:
    client = FakeToolClient({"search_events": {"events": []}})
    callback = ToolCallback(url="http://worker:8810/tools/invoke", token="token-1")
    query = EvidenceQuery(
        tool="search_events",
        args={"q": "failure", "taskId": "task-1", "kind": "drifted.kind"},
        purpose="실패 근거를 찾는다",
    )

    with pytest.raises(ValidationError):
        await invoke_query(client, callback, query)  # type: ignore[arg-type]

    assert client.calls == []


def test_빈_이벤트_커서는_콜백_전에_거부한다() -> None:
    query = EvidenceQuery(
        tool="get_task_events",
        args={"taskId": "task-1", "cursor": ""},
        purpose="다음 이벤트 페이지를 읽는다",
    )

    with pytest.raises(ValidationError):
        validate_query(query)


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


async def test_검증한_도구_인자와_콜백_응답을_근거_레코드로_보존한다() -> None:
    client = FakeToolClient(
        {"get_task_events": {"events": [{"id": "event-1", "taskId": "task-1"}]}}
    )
    callback = ToolCallback(url="http://worker:8810/tools/invoke", token="token-1")
    query = EvidenceQuery(
        tool="get_task_events",
        args={"taskId": "task-1"},
        purpose="완료 이벤트를 확인한다",
    )

    record = await invoke_query(client, callback, query)  # type: ignore[arg-type]

    assert client.args == [{"taskId": "task-1", "limit": 100, "order": "asc"}]
    assert record.tool == "get_task_events"
    assert record.args == client.args[0]
    assert record.parsed == {"events": [{"id": "event-1", "taskId": "task-1"}]}
    assert record.purpose == "완료 이벤트를 확인한다"


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

    assert catalog.taskIds == {"anchor-task", "related-task"}
    assert catalog.eventIdsByTask == {
        "anchor-task": {"event-1"},
        "related-task": {"event-2"},
    }


@pytest.mark.parametrize(
    ("tool", "args", "parsed", "field", "expected"),
    [
        ("get_task_summary", {"taskId": "task-1"}, {}, "taskIds", {"task-1"}),
        ("list_rules", {"taskId": "task-1"}, [{"id": "rule-1"}], "ruleIds", {"rule-1"}),
        (
            "find_similar_tasks",
            {"anchorTaskId": "task-1"},
            [{"id": "task-2"}],
            "taskIds",
            {"task-2"},
        ),
    ],
)
def test_도구별_근거_ID를_해당_원장에_기록한다(
    tool: str,
    args: dict[str, Any],
    parsed: Any,
    field: str,
    expected: set[str],
) -> None:
    catalog = ProvenanceCatalog()
    record = EvidenceRecord.model_validate(
        {
            "tool": tool,
            "args": args,
            "content": "{}",
            "parsed": parsed,
            "purpose": "근거를 모은다",
        }
    )

    add_provenance(catalog, record)

    assert getattr(catalog, field) == expected
