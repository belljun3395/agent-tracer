"""LangGraph agent의 넓은 실행 결과를 구조화 응답 계약으로 좁힌다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel


@dataclass(frozen=True)
class StructuredAgentResult[Response: BaseModel]:
    """검증을 마친 구조화 응답과 다음 호출에 이어갈 메시지다."""

    response: Response
    messages: list[Any]


def recursion_config(limit: int) -> RunnableConfig:
    """LangGraph 재귀 상한을 정식 실행 설정 타입으로 만든다."""
    return {"recursion_limit": limit}


async def invoke_structured_agent[Response: BaseModel](
    agent: CompiledStateGraph[Any, Any, Any, Any],
    *,
    messages: list[Any],
    context: Any,
    response_type: type[Response],
    recursion_limit: int,
    missing_response: str,
) -> StructuredAgentResult[Response]:
    """agent를 실행하고 SDK의 가변 출력에서 요구한 Pydantic 응답만 꺼낸다."""
    raw_output: object = await agent.ainvoke(
        {"messages": messages},
        context=context,
        config=recursion_config(recursion_limit),
    )
    if not isinstance(raw_output, dict):
        raise ValueError("agent produced a non-object output")

    output = raw_output
    response = output.get("structured_response")
    if not isinstance(response, response_type):
        raise ValueError(missing_response)

    raw_messages = output.get("messages")
    if not isinstance(raw_messages, list):
        raise ValueError("agent output contains no message history")
    return StructuredAgentResult(response=response, messages=raw_messages)
