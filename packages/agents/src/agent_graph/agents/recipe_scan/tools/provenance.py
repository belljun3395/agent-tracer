"""recipe-scan 도구 결과에서 검증 가능한 근거 식별자를 누적한다."""

from __future__ import annotations

from ..models import EvidenceRecord, ProvenanceCatalog


def merge_provenance(into: ProvenanceCatalog, other: ProvenanceCatalog) -> None:
    """전문가가 자기 맥락에서 모은 장부를 조율자의 장부로 합친다."""
    for task_id, event_ids in other.eventIdsByTask.items():
        into.eventIdsByTask.setdefault(task_id, set()).update(event_ids)
    for task_id, turn_ids in other.turnIdsByTask.items():
        into.turnIdsByTask.setdefault(task_id, set()).update(turn_ids)
    into.ruleIds.update(other.ruleIds)
    into.recipeIds.update(other.recipeIds)


def add_provenance(catalog: ProvenanceCatalog, record: EvidenceRecord) -> None:
    """도구 응답 본문에서 이벤트와 규칙과 레시피 식별자를 기록한다."""
    parsed = record.parsed
    if record.tool in {"get_task_events", "search_events"} and isinstance(parsed, dict):
        _add_events(catalog, record, parsed.get("events"))
    elif record.tool == "list_rules" and isinstance(parsed, list):
        _add_ids(catalog.ruleIds, parsed)
    elif record.tool == "search_recipes" and isinstance(parsed, list):
        _add_versioned_recipe_ids(catalog.recipeIds, parsed)


# search_events는 태스크를 가로지르므로 출처는 응답 본문의 taskId이고 인자의 taskId는 get_task_events만 쓴다.
def _add_events(catalog: ProvenanceCatalog, record: EvidenceRecord, raw_events: object) -> None:
    if not isinstance(raw_events, list):
        return
    default_task_id = record.args.get("taskId")
    for raw in raw_events:
        if not isinstance(raw, dict):
            continue
        task_id = raw.get("taskId") or default_task_id
        event_id = raw.get("id")
        turn_id = raw.get("turnId")
        if not isinstance(task_id, str) or not task_id or not isinstance(event_id, str) or not event_id:
            continue
        catalog.eventIdsByTask.setdefault(task_id, set()).add(event_id)
        if isinstance(turn_id, str) and turn_id:
            catalog.turnIdsByTask.setdefault(task_id, set()).add(turn_id)


def _add_ids(target: set[str], values: list[object]) -> None:
    for value in values:
        if isinstance(value, dict):
            _add_string(target, value.get("id"))


def _add_versioned_recipe_ids(target: set[str], values: list[object]) -> None:
    for value in values:
        if not isinstance(value, dict):
            continue
        revision = value.get("rev")
        if isinstance(revision, int) and not isinstance(revision, bool):
            _add_string(target, value.get("id"))


def _add_string(target: set[str], value: object) -> None:
    if isinstance(value, str) and value:
        target.add(value)
