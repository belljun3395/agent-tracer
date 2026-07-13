"""recipe-scan 증거를 프롬프트와 실행 단계 형식으로 정리한다."""

from __future__ import annotations

from langchain_core.messages import AIMessage, ToolMessage

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.serialization import json_value
from .models import EvidenceRecord, RecipeScanState

MAX_EVIDENCE_ITEM_CHARS = 16_000
MAX_EVIDENCE_CONTEXT_CHARS = 80_000


def evidence_context(state: RecipeScanState) -> str:
    """수집한 증거를 전체 상한 안의 JSON 컨텍스트로 만든다."""
    items: list[dict[str, object]] = []
    consumed = 0
    for record in state["evidence"]:
        content = record.content[:MAX_EVIDENCE_ITEM_CHARS]
        remaining = MAX_EVIDENCE_CONTEXT_CHARS - consumed
        if remaining <= 0:
            break
        content = content[:remaining]
        consumed += len(content)
        items.append(
            {
                "tool": record.tool,
                "args": record.args,
                "purpose": record.purpose,
                "content": content,
            }
        )
    return json_value(items)


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
