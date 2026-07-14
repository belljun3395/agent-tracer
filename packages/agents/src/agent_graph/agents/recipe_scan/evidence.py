"""recipe-scan 증거를 프롬프트와 실행 단계 형식으로 정리한다."""

from __future__ import annotations

from langchain_core.messages import AIMessage, ToolMessage

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.serialization import json_value
from .models import EvidenceRecord, RecipeScanState

MAX_EVIDENCE_ITEM_CHARS = 16_000
MAX_EVIDENCE_CONTEXT_CHARS = 80_000
MAX_EVIDENCE_EXCERPT_CHARS = 1_200

_ID_BUCKET_BY_TOOL = {
    "get_task_summary": "taskIds",
    "get_task_events": "eventIds",
    "search_events": "eventIds",
    "list_rules": "ruleIds",
    "find_similar_tasks": "taskIds",
    "search_recipes": "recipeIds",
}
_ID_BUCKET_BY_KEY = {
    "taskid": "taskIds",
    "turnid": "turnIds",
    "eventid": "eventIds",
    "ruleid": "ruleIds",
    "recipeid": "recipeIds",
}


def evidence_context(state: RecipeScanState) -> str:
    """최신 증거에 예산을 먼저 주고, 예산이 마른 증거는 본문을 버리되 인용할 ID는 남긴다."""
    rendered: list[dict[str, object]] = []
    consumed = 0
    for record in reversed(state["evidence"]):
        tiers = (_full(record), _excerpt(record), _identifiers(record))
        item = next(
            (tier for tier in tiers if consumed + _cost(tier) <= MAX_EVIDENCE_CONTEXT_CHARS),
            tiers[-1],
        )
        consumed += _cost(item)
        rendered.append(item)
    rendered.reverse()
    return json_value(rendered)


def _cost(item: dict[str, object]) -> int:
    return len(json_value(item))


def _full(record: EvidenceRecord) -> dict[str, object]:
    return {
        "tool": record.tool,
        "args": record.args,
        "purpose": record.purpose,
        "content": record.content[:MAX_EVIDENCE_ITEM_CHARS],
    }


def _excerpt(record: EvidenceRecord) -> dict[str, object]:
    return _identifiers(record) | {"excerpt": record.content[:MAX_EVIDENCE_EXCERPT_CHARS]}


def _identifiers(record: EvidenceRecord) -> dict[str, object]:
    item: dict[str, object] = {
        "tool": record.tool,
        "args": record.args,
        "purpose": record.purpose,
        "compacted": True,
    }
    citable = _citable_ids(record)
    if citable:
        item["citableIds"] = citable
    return item


def _citable_ids(record: EvidenceRecord) -> dict[str, list[str]]:
    """본문을 버려도 모델이 인용을 이어가도록 도구가 실제로 돌려준 식별자만 추린다."""
    buckets: dict[str, set[str]] = {}
    own_bucket = _ID_BUCKET_BY_TOOL.get(record.tool)

    def visit(value: object) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                lowered = key.lower()
                bucket = _ID_BUCKET_BY_KEY.get(lowered) or (own_bucket if lowered == "id" else None)
                if bucket is not None and isinstance(child, str) and child:
                    buckets.setdefault(bucket, set()).add(child)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(record.parsed)
    return {bucket: sorted(values) for bucket, values in buckets.items()}


def record_tool_records(
    trace: ExecutionTrace,
    records: list[EvidenceRecord],
    *,
    phase: str,
    round_number: int,
) -> None:
    """증거 도구 호출과 결과를 실행 단계에 연결한다."""
    for index, record in enumerate(records):
        call_id = f"recipe-{phase}-{round_number}-{index + 1}"
        trace.record_message(
            AIMessage(
                content=f"Gather evidence: {record.purpose}",
                tool_calls=[{"name": record.tool, "args": record.args, "id": call_id, "type": "tool_call"}],
            )
        )
        trace.record_message(ToolMessage(content=record.content, name=record.tool, tool_call_id=call_id))
