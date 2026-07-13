"""task-cleanup의 이벤트 증거를 제한된 프롬프트 컨텍스트로 만든다."""

from __future__ import annotations

from ..runtime.serialization import json_value
from .models import EventEvidence

MAX_EVIDENCE_ITEM_CHARS = 12_000
MAX_EVIDENCE_CONTEXT_CHARS = 80_000
MAX_EVENT_BODY_CHARS = 4_000
MAX_EVENT_TITLE_CHARS = 500
MAX_EVENT_FILE_PATHS = 10
MAX_EVENT_FILE_PATH_CHARS = 300


def evidence_snapshot(
    evidence: list[EventEvidence],
) -> tuple[str, dict[str, set[str]]]:
    """노출 가능한 이벤트 본문과 출처 식별자를 함께 만든다."""
    rendered: list[dict[str, object]] = []
    visible_ids: dict[str, set[str]] = {}
    consumed = 0
    for record in evidence:
        if record.page is None:
            error_item: dict[str, object] = {
                "taskId": record.taskId,
                "args": record.args,
                "error": record.content[:MAX_EVIDENCE_ITEM_CHARS],
            }
            consumed = _append_evidence_item(rendered, error_item, consumed)
            continue
        if not record.page.events:
            empty_item: dict[str, object] = {
                "taskId": record.taskId,
                "args": record.args,
                "events": [],
            }
            consumed = _append_evidence_item(rendered, empty_item, consumed)
            continue
        for event in record.page.events:
            payload = event.model_dump(mode="json", exclude_none=True)
            payload["title"] = event.title[:MAX_EVENT_TITLE_CHARS]
            if event.body is not None:
                payload["body"] = event.body[:MAX_EVENT_BODY_CHARS]
            payload["filePaths"] = [
                path[:MAX_EVENT_FILE_PATH_CHARS] for path in event.filePaths[:MAX_EVENT_FILE_PATHS]
            ]
            event_item: dict[str, object] = {
                "taskId": record.taskId,
                "args": record.args,
                "event": payload,
            }
            next_consumed = _append_evidence_item(rendered, event_item, consumed)
            if next_consumed == consumed:
                return json_value(rendered), visible_ids
            consumed = next_consumed
            visible_ids.setdefault(record.taskId, set()).add(event.id)
    return json_value(rendered), visible_ids


def evidence_context(evidence: list[EventEvidence]) -> str:
    """증거 스냅샷에서 프롬프트 본문만 반환한다."""
    return evidence_snapshot(evidence)[0]


def _append_evidence_item(rendered: list[dict[str, object]], item: dict[str, object], consumed: int) -> int:
    item_size = len(json_value(item))
    if item_size > MAX_EVIDENCE_ITEM_CHARS or consumed + item_size > MAX_EVIDENCE_CONTEXT_CHARS:
        return consumed
    rendered.append(item)
    return consumed + item_size
