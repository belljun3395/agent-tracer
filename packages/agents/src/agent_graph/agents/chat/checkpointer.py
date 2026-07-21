"""chat 스레드 단기기억을 thread_id로 붙드는 LangGraph 체크포인터를 소유한다."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph


class ChatThreadCheckpointer(InMemorySaver):
    """정본 대화 이력을 thread_id 체크포인트로 심어 한 턴의 도구 루프가 이력 위에서 이어지게 한다."""

    async def aseed(
        self,
        agent: CompiledStateGraph[Any, Any, Any, Any],
        config: RunnableConfig,
        replayed: list[BaseMessage],
    ) -> list[BaseMessage]:
        """지난 이력을 thread_id 체크포인트에 심고 이번 턴에 넣을 최신 메시지만 돌려준다."""
        if not replayed:
            return []
        prior, latest = replayed[:-1], replayed[-1:]
        if prior:
            await agent.aupdate_state(config, {"messages": prior})
        return latest
