"""title-suggestion의 태스크 증거를 프롬프트와 실행 단계로 정리한다."""

from __future__ import annotations

from langchain_core.messages import AIMessage, ToolMessage

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.serialization import json_value
from .models import TitleEventRecord, TitleSuggestionState

MAX_CONTEXT_CHARS = 48_000
MAX_TOOL_CONTENT_CHARS = 32_000


def task_context(state: TitleSuggestionState) -> str:
    """태스크 요약과 원시 이벤트 페이지를 프롬프트 컨텍스트로 만든다."""
    context = state["context"].model_dump(mode="json", exclude_none=True)
    event_pages = [
        {"args": record.args, "content": record.content[:MAX_TOOL_CONTENT_CHARS]}
        for record in state["event_records"]
    ]
    return json_value({"taskId": state["task_id"], "context": context, "rawEventPages": event_pages})[
        :MAX_CONTEXT_CHARS
    ]


def record_event_pages(trace: ExecutionTrace, records: list[TitleEventRecord]) -> None:
    """추가 이벤트 조회와 결과를 실행 단계에 연결한다."""
    for index, record in enumerate(records):
        call_id = f"title-events-{index + 1}"
        trace.record_message(
            AIMessage(
                content="Read raw task events because the conversation excerpt was insufficient.",
                tool_calls=[
                    {
                        "name": "get_task_events",
                        "args": record.args,
                        "id": call_id,
                        "type": "tool_call",
                    }
                ],
            )
        )
        trace.record_message(
            ToolMessage(
                content=record.content,
                name="get_task_events",
                tool_call_id=call_id,
            )
        )
