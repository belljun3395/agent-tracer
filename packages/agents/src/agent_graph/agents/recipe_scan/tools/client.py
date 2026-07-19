"""recipe-scan 도구 실행과 근거 장부 기록을 소유한다."""

from __future__ import annotations

import json
from typing import Any

from ...runtime.telemetry.spans import tool_span
from ..models import EvidenceRecord, ProvenanceCatalog
from ..reader import RecipeLedgerReader
from ..search import RecipeSearchReader
from ..summary import build_task_summary
from .contracts import validate_tool_args
from .provenance import add_provenance

_NOT_FOUND = "Task {task_id} not found."


def _parse_content(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def _unsupported(catalog: ProvenanceCatalog, args: dict[str, Any]) -> dict[str, Any]:
    task_id = args["taskId"]
    seen_events = catalog.eventIdsByTask.get(task_id, set())
    seen_turns = catalog.turnIdsByTask.get(task_id, set())
    return {
        "taskSupported": task_id in catalog.eventIdsByTask,
        "unsupportedEventIds": sorted(set(args.get("eventIds", [])) - seen_events),
        "unsupportedTurnIds": sorted(set(args.get("turnIds", [])) - seen_turns),
        "unsupportedRuleIds": sorted(set(args.get("ruleIds", [])) - catalog.ruleIds),
    }


async def _run(
    reader: RecipeLedgerReader,
    search: RecipeSearchReader,
    catalog: ProvenanceCatalog,
    name: str,
    args: dict[str, Any],
) -> Any:
    if name == "check_citations":
        return _unsupported(catalog, args)
    if name == "get_task_summary":
        loaded = await reader.task_with_events(args["taskId"], args["window"])
        if loaded is None:
            return None
        return build_task_summary(loaded["task"], loaded["rows"], loaded["total"])
    if name == "get_task_events":
        return await reader.task_events(args["taskId"], args["limit"], args.get("cursor"), args["order"])
    if name == "list_rules":
        return await reader.applicable_rules(args["taskId"])
    if name == "search_events":
        return await search.search_events(
            args["q"],
            args["limit"],
            args["offset"],
            args.get("taskId"),
            args.get("kind"),
            args.get("toolName"),
        )
    if name == "find_similar_tasks":
        anchor = await reader.task_with_events(args["anchorTaskId"], 1)
        if anchor is None:
            return None
        return await search.similar_tasks(anchor["task"]["title"], args["anchorTaskId"], args["limit"])
    return await search.search_recipes(args["q"], args["limit"])


async def invoke_tool(
    reader: RecipeLedgerReader,
    search: RecipeSearchReader,
    catalog: ProvenanceCatalog,
    name: str,
    args: dict[str, Any],
) -> str:
    """모델이 고른 도구를 인자 검증 뒤 원장 뷰와 검색 색인에서 실행한다."""
    validated = validate_tool_args(name, args)
    async with tool_span(name, agent_name="recipe-scan", parameters=validated):
        result = await _run(reader, search, catalog, name, validated)
    if result is None:
        task_id = validated.get("taskId") or validated.get("anchorTaskId", "")
        return _NOT_FOUND.format(task_id=task_id)
    return json.dumps(result, ensure_ascii=False)


def record_evidence(
    catalog: ProvenanceCatalog,
    name: str,
    args: dict[str, Any],
    content: str,
) -> None:
    """도구가 실제로 돌려준 식별자만 인용 가능한 근거로 올린다."""
    record = EvidenceRecord(
        tool=name,  # type: ignore[arg-type]
        args=args,
        content=content,
        parsed=_parse_content(content),
    )
    add_provenance(catalog, record)
