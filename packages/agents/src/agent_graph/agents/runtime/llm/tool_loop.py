"""모델이 스스로 도구를 골라 근거를 모으고 구조화 출력으로 끝내는 실행 루프."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from langchain_anthropic.chat_models import _convert_to_anthropic_output_config_format
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel, ValidationError

from ..errors import BudgetExceeded, OutputTruncated
from ..pricing import estimate_cost_usd
from .trajectory import extract_token_usage, is_truncated

if TYPE_CHECKING:
    from ..execution.trace import ExecutionTrace

# 캐시 적중은 접두사가 완전히 같아야 나므로 직전 경계도 함께 남겨 둔다.
ROLLING_BREAKPOINTS = 2

FINALIZE_DIRECTIVE = (
    "The tool budget is exhausted. Produce the final structured output now "
    "using only the evidence you already verified."
)

REPARSE_DIRECTIVE = (
    "Your last output did not match the required schema: {error}\n"
    "Return the corrected structured output. Change nothing else."
)


@dataclass(frozen=True)
class ToolSpec:
    """모델에 노출하는 도구의 이름과 설명과 인자 스키마다."""

    name: str
    description: str
    args_model: type[BaseModel]

    def to_anthropic(self) -> dict[str, object]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.args_model.model_json_schema(),
        }


# 도구 이름과 검증된 인자를 받아 모델에게 돌려줄 본문을 만든다.
ToolRunner = Callable[[str, dict[str, Any]], Awaitable[str]]
# 도구가 실제로 돌려준 결과를 근거 장부에 올린다.
ToolObserver = Callable[[str, dict[str, Any], str], None]


class ToolLoopBudget:
    """루프 한 번의 모델 비용을 누적하고 상한에서 끊는다."""

    def __init__(self, agent_name: str, model_name: str, max_cost_usd: float, spent: float = 0.0) -> None:
        self._agent = agent_name
        self._model = model_name
        self._max = max_cost_usd
        self.spent = spent

    def charge(self, message: AIMessage) -> None:
        usage = extract_token_usage(message)
        cost = estimate_cost_usd(self._model, usage.to_dto()) if usage else None
        if cost is None:
            raise BudgetExceeded(f"{self._agent} cannot enforce its internal budget for model {self._model}")
        self.spent += cost
        if self.spent > self._max:
            raise BudgetExceeded(f"{self._agent} exceeded internal model budget ${self._max:.2f}")


async def run_tool_loop[SchemaT: BaseModel](
    chat: Any,
    *,
    system: str,
    user: str,
    tools: Sequence[ToolSpec],
    schema: type[SchemaT],
    trace: ExecutionTrace,
    run_tool: ToolRunner,
    observe: ToolObserver,
    agent_name: str,
    model_name: str,
    max_rounds: int,
    max_cost_usd: float,
    spent: float = 0.0,
) -> tuple[SchemaT, list[BaseMessage], float]:
    """모델이 도구를 다 쓸 때까지 돌리고 마지막 구조화 출력을 돌려준다."""
    messages: list[BaseMessage] = [_cached_system(system), HumanMessage(content=user)]
    for message in messages:
        trace.record_message(message)
    parsed, spent_now = await _loop(
        _bind(chat, tools, schema),
        messages,
        schema=schema,
        trace=trace,
        run_tool=run_tool,
        observe=observe,
        agent_name=agent_name,
        budget=ToolLoopBudget(agent_name, model_name, max_cost_usd, spent),
        max_rounds=max_rounds,
    )
    return parsed, messages, spent_now


async def continue_tool_loop[SchemaT: BaseModel](
    chat: Any,
    *,
    messages: list[BaseMessage],
    directive: str,
    tools: Sequence[ToolSpec],
    schema: type[SchemaT],
    trace: ExecutionTrace,
    run_tool: ToolRunner,
    observe: ToolObserver,
    agent_name: str,
    model_name: str,
    max_rounds: int,
    max_cost_usd: float,
    spent: float = 0.0,
) -> tuple[SchemaT, float]:
    """같은 대화를 이어 다시 돌린다. 모델은 도구를 더 부를 수 있고 앞선 접두사는 캐시에서 읽는다."""
    messages.append(HumanMessage(content=directive))
    trace.record_message(messages[-1])
    return await _loop(
        _bind(chat, tools, schema),
        messages,
        schema=schema,
        trace=trace,
        run_tool=run_tool,
        observe=observe,
        agent_name=agent_name,
        budget=ToolLoopBudget(agent_name, model_name, max_cost_usd, spent),
        max_rounds=max_rounds,
    )


async def _loop[SchemaT: BaseModel](
    model: Any,
    messages: list[BaseMessage],
    *,
    schema: type[SchemaT],
    trace: ExecutionTrace,
    run_tool: ToolRunner,
    observe: ToolObserver,
    agent_name: str,
    budget: ToolLoopBudget,
    max_rounds: int,
) -> tuple[SchemaT, float]:
    for _ in range(max_rounds):
        answer = await _step(model, messages, trace, budget, agent_name)
        if not answer.tool_calls:
            parsed = await _parse_or_retry(model, messages, answer, schema, trace, budget, agent_name)
            return parsed, budget.spent
        messages.append(answer)
        for call in answer.tool_calls:
            result = await _run(dict(call), run_tool, observe)
            trace.record_message(result)
            messages.append(result)
        _roll_breakpoints(messages)

    messages.append(HumanMessage(content=FINALIZE_DIRECTIVE))
    trace.record_message(messages[-1])
    answer = await _step(model, messages, trace, budget, agent_name)
    parsed = await _parse_or_retry(model, messages, answer, schema, trace, budget, agent_name)
    return parsed, budget.spent


def _bind(chat: Any, tools: Sequence[ToolSpec], schema: type[BaseModel]) -> Any:
    # 도구 목록을 고정한 채 출력 형식만 얹어야 요청 접두사가 유지되고 캐시가 산다.
    return chat.bind_tools([tool.to_anthropic() for tool in tools]).bind(
        output_config={"format": _convert_to_anthropic_output_config_format(schema)},
    )


async def _step(
    model: Any,
    messages: list[BaseMessage],
    trace: ExecutionTrace,
    budget: ToolLoopBudget,
    agent_name: str,
) -> AIMessage:
    answer = await model.ainvoke(messages)
    if not isinstance(answer, AIMessage):
        raise TypeError(f"{agent_name} expected an assistant message")
    trace.add_message(answer)
    trace.record_message(answer)
    budget.charge(answer)
    if is_truncated(answer):
        raise OutputTruncated(f"{agent_name} structured output truncated at max_tokens")
    return answer


async def _run(call: dict[str, Any], run_tool: ToolRunner, observe: ToolObserver) -> ToolMessage:
    name = str(call["name"])
    args = dict(call.get("args") or {})
    content = await run_tool(name, args)
    observe(name, args, content)
    return ToolMessage(content=content, name=name, tool_call_id=str(call["id"]))


def _cached_system(system: str) -> SystemMessage:
    return SystemMessage(
        content=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
    )


def _roll_breakpoints(messages: list[BaseMessage]) -> None:
    """가장 최근 도구 결과들에만 캐시 경계를 남긴다."""
    tool_indexes = [
        index for index, message in enumerate(messages) if isinstance(message, ToolMessage)
    ]
    keep = set(tool_indexes[-ROLLING_BREAKPOINTS:])
    for index in tool_indexes:
        message = messages[index]
        if not isinstance(message, ToolMessage):
            continue
        block: dict[str, object] = {"type": "text", "text": _text_of(message)}
        if index in keep:
            block["cache_control"] = {"type": "ephemeral"}
        messages[index] = ToolMessage(
            content=[block],
            name=message.name,
            tool_call_id=message.tool_call_id,
        )


def _text_of(message: BaseMessage) -> str:
    if isinstance(message.content, str):
        return message.content
    parts = [
        str(block.get("text", ""))
        for block in message.content
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "".join(parts)


async def _parse_or_retry[SchemaT: BaseModel](
    model: Any,
    messages: list[BaseMessage],
    answer: AIMessage,
    schema: type[SchemaT],
    trace: ExecutionTrace,
    budget: ToolLoopBudget,
    agent_name: str,
) -> SchemaT:
    """스키마를 어긴 출력은 그 사유를 모델에게 돌려주고 한 번만 다시 받는다."""
    try:
        return _parse(answer, schema, agent_name)
    except ValueError as error:
        messages.append(answer)
        messages.append(HumanMessage(content=REPARSE_DIRECTIVE.format(error=error)))
        trace.record_message(messages[-1])
        retried = await _step(model, messages, trace, budget, agent_name)
        if retried.tool_calls:
            raise ValueError(f"{agent_name} kept calling tools instead of answering") from error
        return _parse(retried, schema, agent_name)


def _parse[SchemaT: BaseModel](answer: AIMessage, schema: type[SchemaT], agent_name: str) -> SchemaT:
    text = _text_of(answer).strip()
    if not text:
        raise ValueError(f"{agent_name} produced no structured output")
    try:
        return schema.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as error:
        raise ValueError(f"{agent_name} structured output parse failed: {error}") from error
