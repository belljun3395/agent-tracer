"""도구 루프가 모델에게 도구를 쥐어 주고 캐시 경계를 굴리는지 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel, Field

from agent_graph.agents.runtime.execution.trace import ExecutionTrace
from agent_graph.agents.runtime.llm.tool_loop import (
    ROLLING_BREAKPOINTS,
    ToolSpec,
    continue_tool_loop,
    run_tool_loop,
)
from tests.fakes import FakeToolLoopChat


class LookupArgs(BaseModel):
    taskId: str = Field(min_length=1)


class Answer(BaseModel):
    found: list[str] = Field(default_factory=list)


TOOLS = (ToolSpec("get_task_events", "Read events.", LookupArgs),)


async def _run(chat: FakeToolLoopChat, *, max_rounds: int = 4) -> tuple[Answer, list[Any], float]:
    seen: list[tuple[str, dict[str, Any], str]] = []

    async def run_tool(name: str, args: dict[str, Any]) -> str:
        return f"result of {name} {args['taskId']}"

    def observe(name: str, args: dict[str, Any], content: str) -> None:
        seen.append((name, args, content))

    result = await run_tool_loop(
        chat,
        system="You investigate.",
        user="Anchor task: t1",
        tools=TOOLS,
        schema=Answer,
        trace=ExecutionTrace(),
        run_tool=run_tool,
        observe=observe,
        agent_name="recipe-scan",
        model_name="claude-haiku-4-5",
        max_rounds=max_rounds,
        max_cost_usd=1.0,
    )
    chat.seen = seen  # type: ignore[attr-defined]
    return result


class TestRunToolLoop:
    async def test_모델이_고른_도구를_실행하고_결과를_대화에_남긴다(self) -> None:
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"found": ["event-1"]},
        ])

        answer, messages, _cost = await _run(chat)

        assert answer.found == ["event-1"]
        assert [tool["name"] for tool in chat.bound_tools] == ["get_task_events"]
        assert any(isinstance(message, ToolMessage) for message in messages)
        assert chat.seen == [("get_task_events", {"taskId": "t1"}, "result of get_task_events t1")]  # type: ignore[attr-defined]

    async def test_출력_형식은_도구를_갈아치우지_않고_얹는다(self) -> None:
        chat = FakeToolLoopChat([{"found": []}])

        await _run(chat)

        assert chat.output_config is not None
        assert chat.bound_tools, "도구 목록이 유지돼야 캐시 접두사가 산다"

    async def test_시스템_프롬프트에_캐시_경계를_건다(self) -> None:
        chat = FakeToolLoopChat([{"found": []}])

        _answer, messages, _cost = await _run(chat)

        system = messages[0]
        assert isinstance(system, SystemMessage)
        assert system.content[0]["cache_control"] == {"type": "ephemeral"}

    async def test_최근_도구_결과에만_캐시_경계를_남긴다(self) -> None:
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "get_task_events", "args": {"taskId": "t2"}}],
            [{"name": "get_task_events", "args": {"taskId": "t3"}}],
            {"found": []},
        ])

        _answer, messages, _cost = await _run(chat)

        marked = [
            message
            for message in messages
            if isinstance(message, ToolMessage)
            and isinstance(message.content, list)
            and "cache_control" in message.content[0]
        ]
        assert len(marked) == ROLLING_BREAKPOINTS

    async def test_라운드를_다_쓰면_결론을_요구하고_끝낸다(self) -> None:
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            [{"name": "get_task_events", "args": {"taskId": "t2"}}],
            {"found": ["event-9"]},
        ])

        answer, messages, _cost = await _run(chat, max_rounds=2)

        assert answer.found == ["event-9"]
        assert "budget is exhausted" in str(messages[-1].content)

    async def test_스키마를_어긴_출력은_사유를_돌려주고_한_번_다시_받는다(self) -> None:
        chat = FakeToolLoopChat([{"found": "not-a-list"}, {"found": ["event-1"]}])

        answer, messages, _cost = await _run(chat)

        assert answer.found == ["event-1"]
        assert "did not match the required schema" in str(messages[-1].content)

    async def test_다시_받은_출력도_스키마를_어기면_실행을_실패로_올린다(self) -> None:
        chat = FakeToolLoopChat([{"found": "not-a-list"}, {"found": "still-wrong"}])

        with pytest.raises(ValueError, match="parse failed"):
            await _run(chat)


class TestContinueToolLoop:
    async def test_이어진_대화에서도_모델이_도구를_더_부를_수_있다(self) -> None:
        chat = FakeToolLoopChat([
            [{"name": "get_task_events", "args": {"taskId": "t1"}}],
            {"found": ["event-1"]},
        ])
        messages: list[Any] = [
            SystemMessage(content="You investigate."),
            HumanMessage(content="Anchor task: t1"),
        ]

        async def run_tool(name: str, args: dict[str, Any]) -> str:
            return f"result of {name} {args['taskId']}"

        answer, _cost = await continue_tool_loop(
            chat,
            messages=messages,
            directive="Validation failed. Ground your citations.",
            tools=TOOLS,
            schema=Answer,
            trace=ExecutionTrace(),
            run_tool=run_tool,
            observe=lambda *_: None,
            agent_name="task-cleanup",
            model_name="claude-haiku-4-5",
            max_rounds=4,
            max_cost_usd=1.0,
        )

        assert answer.found == ["event-1"]
        # 도구를 부른 답 바로 뒤에 도구 결과가 와야 대화가 깨지지 않는다.
        calling = next(
            index
            for index, message in enumerate(messages)
            if isinstance(message, AIMessage) and message.tool_calls
        )
        assert isinstance(messages[calling + 1], ToolMessage)
