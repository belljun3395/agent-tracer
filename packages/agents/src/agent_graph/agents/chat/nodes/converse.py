"""chat의 대화 노드가 도구 루프를 돌려 어시스턴트 답변과 제안·기억 쓰기를 낸다."""

from __future__ import annotations

from typing import Any

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph

from ...runtime.execution.trace import ExecutionTrace
from ...runtime.ledger import LedgerPoolProvider
from ...runtime.llm.budget import ToolLoopBudget
from ...runtime.llm.standard_agent import StandardAgentContext
from ...runtime.node import GraphNode
from ..checkpointer import ChatThreadCheckpointer
from ..langchain_agent import build_chat_agent
from ..models import (
    ChatFact,
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
from ..store import ChatMemoryStore, memory_namespace
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
        ledger: LedgerPoolProvider | None,
        usage: ExecutionTrace,
        chat: BaseChatModel,
        fallback_chat: BaseChatModel | None,
        *,
        agent_name: str,
    ) -> None:
        self._req = req
        self._http_client = http_client
        self._ledger = ledger
        self._usage = usage
        self._chat = chat
        self._fallback_chat = fallback_chat
        self._agent_name = agent_name

    async def run(self, state: ChatState) -> ConverseUpdate:
        proposals: list[ProposedWrite] = []
        memories: list[MemoryWrite] = []
        store = self._store()
        checkpointer = ChatThreadCheckpointer() if store is not None else None
        facts = await self._facts(state["facts"], store)
        registry = build_chat_registry(
            self._read_client(),
            facts,
            proposals,
            memories,
            self._req.toolDescriptions,
            agent_name=self._agent_name,
            store=store,
            user_id=self._req.userId,
        )
        system = SYSTEM_PROMPT + "\n\n" + build_context_prompt(state["summary"], facts, state["language"])
        agent = build_chat_agent(
            self._chat,
            system,
            registry.langchain_tools(),
            TRANSIENT_ERRORS,
            fallback_chat=self._fallback_chat,
            checkpointer=checkpointer,
            store=store,
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
        config = self._config()
        messages_in = await self._seed(agent, checkpointer, config)
        raw: Any = await agent.ainvoke({"messages": messages_in}, context=context, config=config)
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

    def _config(self) -> RunnableConfig:
        # thread_id는 체크포인터가 스레드 단기기억을, user_id는 저장소가 장기기억을 범위로 잡는 열쇠다.
        return {
            "recursion_limit": AGENT_RECURSION_LIMIT,
            "configurable": {"thread_id": self._req.threadId, "user_id": self._req.userId},
        }

    async def _seed(
        self,
        agent: CompiledStateGraph[Any, Any, Any, Any],
        checkpointer: ChatThreadCheckpointer | None,
        config: RunnableConfig,
    ) -> list[BaseMessage]:
        replayed = _replay(self._req.messages)
        if checkpointer is None:
            return replayed
        return await checkpointer.aseed(agent, config, replayed)

    async def _facts(self, seeded: list[ChatFact], store: ChatMemoryStore | None) -> list[ChatFact]:
        if store is None:
            return seeded
        # 저장소가 있으면 프롬프트에 붙일 사실도 정본에서 읽어 봉투 스냅샷과 어긋나지 않게 한다.
        items = await store.asearch(memory_namespace(self._req.userId))
        return [ChatFact(key=item.key, content=str(item.value.get("content", ""))) for item in items]

    def _store(self) -> ChatMemoryStore | None:
        if self._ledger is None:
            return None
        return ChatMemoryStore(self._ledger, self._req.userId)

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
