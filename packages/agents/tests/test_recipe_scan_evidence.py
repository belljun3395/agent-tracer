"""근거 압축이 예산을 지키면서 인용 가능한 ID를 잃지 않는지 검증한다."""

from __future__ import annotations

import json

from agent_graph.agents.recipe_scan.evidence import (
    MAX_EVIDENCE_CONTEXT_CHARS,
    evidence_context,
)
from agent_graph.agents.recipe_scan.models import EvidenceRecord, ProvenanceCatalog, RecipeScanState


def _state(evidence: list[EvidenceRecord]) -> RecipeScanState:
    return {
        "task_id": "t1",
        "language": "ko",
        "user_prompt": None,
        "evidence": evidence,
        "provenance": ProvenanceCatalog(),
        "plan": None,
        "assessment": None,
        "gather_rounds": 0,
        "model_cost_usd": 0.0,
        "candidates": [],
        "validation_errors": [],
        "repair_attempted": False,
        "result": None,
    }


def _events_record(index: int, event_count: int, filler: int) -> EvidenceRecord:
    events = [
        {"id": f"event-{index}-{n}", "turnId": f"turn-{index}", "title": "x" * filler}
        for n in range(event_count)
    ]
    parsed = {"events": events, "truncated": False, "total": event_count}
    return EvidenceRecord(
        tool="get_task_events",
        args={"taskId": "t1"},
        content=json.dumps(parsed),
        parsed=parsed,
        purpose=f"근거 {index}",
    )


class TestEvidenceContext:
    def test_예산_안에_들면_본문을_그대로_싣는다(self) -> None:
        rendered = json.loads(evidence_context(_state([_events_record(1, 1, 10)])))

        assert rendered[0]["content"]
        assert "compacted" not in rendered[0]

    def test_예산을_넘으면_오래된_근거를_압축하고_최신_근거의_본문을_지킨다(self) -> None:
        records = [_events_record(index, 40, 800) for index in range(1, 12)]

        rendered = json.loads(evidence_context(_state(records)))

        assert len(rendered) == len(records)
        assert len(evidence_context(_state(records))) <= MAX_EVIDENCE_CONTEXT_CHARS
        assert "content" in rendered[-1]
        assert rendered[0]["compacted"] is True

    def test_본문을_버려도_인용할_ID는_남긴다(self) -> None:
        records = [_events_record(index, 40, 800) for index in range(1, 12)]

        rendered = json.loads(evidence_context(_state(records)))

        compacted = [item for item in rendered if item.get("compacted")]
        assert compacted
        for item in compacted:
            assert item["citableIds"]["eventIds"]
            assert item["citableIds"]["turnIds"]

    def test_수집한_근거는_한_건도_사라지지_않는다(self) -> None:
        records = [_events_record(index, 200, 900) for index in range(1, 40)]

        rendered = json.loads(evidence_context(_state(records)))

        assert len(rendered) == len(records)
