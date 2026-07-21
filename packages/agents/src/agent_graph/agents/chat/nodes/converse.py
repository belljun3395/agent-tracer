"""chat의 대화 노드가 도구 루프를 돌려 어시스턴트 답변과 제안·기억 쓰기를 낸다."""

from __future__ import annotations

from typing import Any

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.llm.structured_agent import recursion_config
from ...runtime.node import GraphNode
from ..langchain_agent import build_chat_agent
from ..models import (
    ChatHistoryMessage,
    ChatRequest,
    ChatResult,
    ChatState,
    ConverseUpdate,
    MemoryWrite,
    ProposedWrite,
)
from ..policy import AGENT_RECURSION_LIMIT, CHAT_MAX_MODEL_COST_USD, MAX_MODEL_TURNS
from ..prompts import SYSTEM_PROMPT, build_context_prompt
from ..reader import ChatReadClient
from ..tools import build_chat_registry

# 읽기 도구는 HTTP만 타므로 연결 계열 오류만 일시적이며 도메인 응답은 재시도하지 않는다.
TRANSIENT_ERRORS: tuple[type[Exception], ...] = (
    httpx.TransportError,
    ConnectionError,
    TimeoutError,
)


class ConverseNode(GraphNode):
    """대화 이력과 도구로 한 턴의 어시스턴트 답변을 만든다."""

    name = "converse"

    def __init__(
        self,
        req: ChatRequest,
        http_client: httpx.AsyncClient,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        fallback_chat: BaseChatModel | None,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._http_client = http_client
        self._usage = usage
        self._chat = chat
        self._fallback_chat = fallback_chat
        self._agent_name = agent_name

    async def run(self, state: ChatState) -> ConverseUpdate:
        proposals: list[ProposedWrite] = []
        memories: list[MemoryWrite] = []
        registry = build_chat_registry(
            self._read_client(),
            state["facts"],
            proposals,
            memories,
            self._req.toolDescriptions,
            agent_name=self._agent_name,
        )
        system = (
            SYSTEM_PROMPT + "\n\n" + build_context_prompt(state["summary"], state["facts"], state["language"])
        )
        agent = build_chat_agent(
            self._chat,
            system,
            registry.langchain_tools(),
            TRANSIENT_ERRORS,
            fallback_chat=self._fallback_chat,
        )
        budget = ToolLoopBudget(
            self._agent_name, self._req.model, CHAT_MAX_MODEL_COST_USD, state["model_cost_usd"]
        )
        context = StandardAgentContext(
            agent_name=self._agent_name,
            trace=self._usage,
            budget=budget,
            max_model_turns=MAX_MODEL_TURNS,
        )
        raw: Any = await agent.ainvoke(
            {"messages": _replay(self._req.messages)},
            context=context,
            config=recursion_config(AGENT_RECURSION_LIMIT),
        )
        messages = raw["messages"] if isinstance(raw, dict) else []
        result = ChatResult(
            assistantText=_final_text(messages),
            proposedWrites=proposals,
            memoryWrites=memories,
        )
        return {
            "messages": messages,
            "model_cost_usd": budget.spent,
            "result": result.model_dump(mode="json"),
        }

    def _read_client(self) -> ChatReadClient | None:
        if not self._req.readApiBaseUrl:
            return None
        return ChatReadClient(self._http_client, self._req.readApiBaseUrl, self._req.userId)


def _replay(history: list[ChatHistoryMessage]) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for message in history:
        if message.role == "user":
            messages.append(HumanMessage(content=message.content))
        elif message.role == "assistant":
            messages.append(AIMessage(content=message.content))
    return messages


def _final_text(messages: list[Any]) -> str:
    for message in reversed(messages):
        if isinstance(message, AIMessage):
            return _text(message.content)
    return ""


def _text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            block["text"]
            for block in content
            if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str)
        ]
        return "".join(parts)
    return ""
