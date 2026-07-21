"""chat 대화 에이전트의 실행 의존성과 그래프 노드를 조립하고, 내구성·스트리밍 실행을 낸다."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator, Mapping
from typing import Any

import httpx

from ..runtime.errors import classify_exception
from ..runtime.execution.trace import ExecutionTrace
from ..runtime.ledger import LedgerPoolProvider
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.node import node_registry
from ..runtime.validation_graph import FINALIZE, ValidationGraphContext
from .graph import CHAT_GRAPH
from .models import ChatRequest, ChatResult, ChatState, ChatStreamRequest
from .nodes.converse import ConverseNode
from .policy import AGENT_RECURSION_LIMIT, CHAT_MAX_OUTPUT_TOKENS

AGENT_NAME = "chat"


# 대화는 검증 분기가 없어 라우터가 호출되지 않으므로 확정 경로만 돌려주는 자리표시자다.
def _no_validation(_state: Any) -> Any:
    return FINALIZE


def _build_node(
    req: ChatRequest | ChatStreamRequest,
    http_client: httpx.AsyncClient,
    ledger: LedgerPoolProvider | None,
    usage: ExecutionTrace,
    *,
    streaming: bool,
) -> ConverseNode:
    tokens = CHAT_MAX_OUTPUT_TOKENS
    chat = make_chat(req.model, req.apiKey, req.deadlineMs, max_output_tokens=tokens, streaming=streaming)
    fallback_model = req.effective_fallback_model()
    fallback_chat = (
        make_chat(fallback_model, req.apiKey, req.deadlineMs, max_output_tokens=tokens, streaming=streaming)
        if fallback_model is not None
        else None
    )
    return ConverseNode(req, http_client, ledger, usage, chat, fallback_chat, agent_name=AGENT_NAME)


def _initial_state(req: ChatRequest | ChatStreamRequest) -> ChatState:
    return {
        "language": req.language,
        "summary": req.summary,
        "facts": req.facts,
        "messages": [],
        "model_cost_usd": 0.0,
        "result": None,
    }


async def run_chat(
    req: ChatRequest,
    http_client: httpx.AsyncClient,
    ledger: LedgerPoolProvider | None,
    usage: ExecutionTrace,
) -> dict[str, Any]:
    """chat 노드를 실행 의존성과 결합해 대화 그래프를 수행한다."""
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        node_registry([_build_node(req, http_client, ledger, usage, streaming=False)]),
        _no_validation,
    )
    final = await CHAT_GRAPH.ainvoke(
        _initial_state(req),
        context=context,
        config=recursion_config(AGENT_RECURSION_LIMIT),
    )
    return final["result"] or ChatResult().model_dump(mode="json")


async def stream_chat(
    req: ChatStreamRequest,
    http_client: httpx.AsyncClient,
    ledger: LedgerPoolProvider | None,
) -> AsyncIterator[bytes]:
    """대화 턴을 실행하며 토큰 delta와 최종 result를 NDJSON 줄로 흘려보낸다."""
    trace = ExecutionTrace()
    node = _build_node(req, http_client, ledger, trace, streaming=True)
    started = time.monotonic()
    try:
        async for chunk in node.stream(_initial_state(req)):
            if chunk["type"] == "result":
                yield _encode({**chunk, **_envelope(req, trace, started)})
            else:
                yield _encode(chunk)
    except asyncio.CancelledError:
        # 클라이언트가 연결을 끊으면 스트림 실행을 취소로 전파해 모델 호출을 멈춘다.
        raise
    except BaseException as err:
        error = classify_exception(err)
        yield _encode({"type": "error", "data": {"subtype": error.subtype, "summary": error.summary}})


def _envelope(req: ChatStreamRequest, trace: ExecutionTrace, started: float) -> dict[str, object]:
    usage = trace.to_usage_dto()
    return {
        "modelUsed": req.model,
        "actualModel": trace.actual_model,
        "usage": usage.model_dump(mode="json") if usage is not None else None,
        "numTurns": trace.turns or None,
        "providerRequestId": trace.provider_request_id,
        "durationMs": int((time.monotonic() - started) * 1000),
    }


def _encode(payload: Mapping[str, object]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode()
