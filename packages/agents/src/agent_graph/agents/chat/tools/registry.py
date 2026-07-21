"""요청별 의존을 받아 chat의 37개 도구를 langchain 도구로 조립한다."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool

from ...runtime.telemetry.spans import tool_span
from ..models import ChatFact, MemoryWrite, ProposedWrite
from ..reader import ChatReadClient
from ..store import ChatMemoryStore, memory_namespace
from .specs import ARGS_MODELS, MEMORY_TOOL_NAMES, READ_TOOL_NAMES, WRITE_TOOL_NAMES

# 모델에게 제안이 실행되지 않았음을 못박아 확정으로 오인하지 않게 한다.
PROPOSAL_NOTE = "Queued for user confirmation. This action has NOT run yet."


def _clean(kwargs: dict[str, Any]) -> dict[str, object]:
    return {key: value for key, value in kwargs.items() if value is not None}


class ChatToolRegistry:
    """chat 도구를 langchain 도구로 어댑트하며 도구 수와 무관한 조립을 제공한다."""

    def __init__(self, tools: list[BaseTool]) -> None:
        self._tools = tools

    def langchain_tools(self) -> list[BaseTool]:
        """등록된 chat 도구 전체를 langchain 도구 목록으로 낸다."""
        return list(self._tools)


def build_chat_registry(
    read_client: ChatReadClient | None,
    facts: list[ChatFact],
    proposals: list[ProposedWrite],
    memories: list[MemoryWrite],
    descriptions: dict[str, str],
    *,
    agent_name: str,
    store: ChatMemoryStore | None = None,
    user_id: str = "",
) -> ChatToolRegistry:
    """읽기 진입점과 사용자 사실과 제안·기억 장부와 장기기억 저장소를 쥔 chat 도구 레지스트리를 만든다."""
    _assert_memory_names()
    tools: list[BaseTool] = [
        *(_read_tool(name, read_client, descriptions, agent_name) for name in READ_TOOL_NAMES),
        *(_proposal_tool(name, proposals, descriptions, agent_name) for name in WRITE_TOOL_NAMES),
        _recall_tool(facts, descriptions, agent_name, store, user_id),
        _remember_tool(memories, descriptions, agent_name, store, user_id),
    ]
    return ChatToolRegistry(tools)


def _structured(name: str, descriptions: dict[str, str], coroutine: Any) -> StructuredTool:
    # 인자 스키마를 계약 와이어 이름(예: from) 그대로 노출하려면 별칭을 적용한 JSON 스키마를 넘긴다.
    # noinspection PyTypeChecker
    return StructuredTool(
        name=name,
        description=descriptions.get(name, name),
        args_schema=ARGS_MODELS[name].model_json_schema(),
        coroutine=coroutine,
    )


def _read_tool(
    name: str, read_client: ChatReadClient | None, descriptions: dict[str, str], agent_name: str
) -> StructuredTool:
    async def run(**kwargs: Any) -> str:
        args = _clean(kwargs)
        async with tool_span(name, agent_name=agent_name, parameters=args):
            if read_client is None:
                return f"Read backend for {name} is unavailable."
            response = await read_client.read(name, args)
            if response.status_code >= 400:
                return f"{name} failed with status {response.status_code}."
            return response.text

    return _structured(name, descriptions, run)


def _proposal_tool(
    name: str, proposals: list[ProposedWrite], descriptions: dict[str, str], agent_name: str
) -> StructuredTool:
    async def run(**kwargs: Any) -> str:
        args = _clean(kwargs)
        async with tool_span(name, agent_name=agent_name, parameters=args):
            proposals.append(ProposedWrite(toolName=name, args=args))
            return json.dumps(
                {"toolName": name, "status": "pending", "note": PROPOSAL_NOTE}, ensure_ascii=False
            )

    return _structured(name, descriptions, run)


def _recall_tool(
    facts: list[ChatFact],
    descriptions: dict[str, str],
    agent_name: str,
    store: ChatMemoryStore | None,
    user_id: str,
) -> StructuredTool:
    async def run(**_kwargs: Any) -> str:
        async with tool_span("recall_facts", agent_name=agent_name, parameters={}):
            payload = await _recall_payload(facts, store, user_id)
            return json.dumps({"facts": payload}, ensure_ascii=False)

    return _structured("recall_facts", descriptions, run)


async def _recall_payload(
    facts: list[ChatFact], store: ChatMemoryStore | None, user_id: str
) -> list[dict[str, str]]:
    if store is None:
        return [{"key": fact.key, "content": fact.content} for fact in facts]
    # 저장소가 있으면 이번 턴에 방금 기억한 사실까지 정본에서 다시 읽는다.
    items = await store.asearch(memory_namespace(user_id))
    return [{"key": item.key, "content": str(item.value.get("content", ""))} for item in items]


def _remember_tool(
    memories: list[MemoryWrite],
    descriptions: dict[str, str],
    agent_name: str,
    store: ChatMemoryStore | None,
    user_id: str,
) -> StructuredTool:
    async def run(**kwargs: Any) -> str:
        args = _clean(kwargs)
        key = str(args["key"])
        content = str(args.get("content", ""))
        async with tool_span("remember_fact", agent_name=agent_name, parameters={"key": key}):
            if store is not None:
                await store.aput(memory_namespace(user_id), key, {"content": content})
            # 워커가 memory_updated를 흘리고 정본에 못 박도록 기억 쓰기는 계속 결과로 되돌린다.
            memories.append(MemoryWrite(key=key, content=content))
            return json.dumps({"key": key, "content": content, "status": "remembered"}, ensure_ascii=False)

    return _structured("remember_fact", descriptions, run)


def _assert_memory_names() -> None:
    if set(MEMORY_TOOL_NAMES) != {"recall_facts", "remember_fact"}:
        raise ValueError("chat memory tool names drifted from the contract")
