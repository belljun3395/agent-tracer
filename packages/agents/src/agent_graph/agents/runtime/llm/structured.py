"""구조화 모델 호출과 실행 예산 집행을 묶는다."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from langchain_core.messages import BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from ..errors import BudgetExceeded, OutputTruncated
from ..pricing import estimate_cost_usd
from .trajectory import extract_token_usage, is_truncated

if TYPE_CHECKING:
    from ..execution.trace import ExecutionTrace


def prompt(system: str, human: str) -> ChatPromptTemplate:
    """공통 system-human 구조의 채팅 프롬프트를 만든다."""
    return ChatPromptTemplate.from_messages([("system", system), ("human", human)])


async def invoke_structured[SchemaT: BaseModel](
    chat: Any,
    chain_prompt: ChatPromptTemplate,
    values: dict[str, object],
    schema: type[SchemaT],
    trace: ExecutionTrace,
    current_cost: float,
    model_name: str,
    *,
    agent_name: str,
    max_cost_usd: float,
) -> tuple[SchemaT, float]:
    """구조화 응답을 호출하고 사용량·예산·절단 여부를 함께 처리한다."""
    messages = chain_prompt.format_messages(**values)
    for message in messages:
        trace.record_message(message)
    chain = chain_prompt | chat.with_structured_output(schema, include_raw=True)
    output = await chain.ainvoke(values)
    if not isinstance(output, dict):
        return schema.model_validate(output), current_cost
    raw = output.get("raw")
    if isinstance(raw, BaseMessage):
        trace.add_message(raw)
        trace.record_message(raw)
        message_cost = _message_cost(model_name, raw)
        if message_cost is None:
            raise BudgetExceeded(f"{agent_name} cannot enforce its internal budget for model {model_name}")
        current_cost += message_cost
        if current_cost > max_cost_usd:
            raise BudgetExceeded(f"{agent_name} exceeded internal model budget ${max_cost_usd:.2f}")
        if is_truncated(raw):
            raise OutputTruncated(f"{agent_name} structured chain truncated at max_tokens")
    parsed_raw = output.get("parsed")
    if parsed_raw is None:
        raise ValueError(f"{agent_name} structured chain parse failed: {output.get('parsing_error')}")
    return schema.model_validate(parsed_raw), current_cost


def _message_cost(model: str, message: BaseMessage) -> float | None:
    usage = extract_token_usage(message)
    return estimate_cost_usd(model, usage.to_dto() if usage else None)
