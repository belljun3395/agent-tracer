"""chat 대화 에이전트의 실행 의존성과 그래프 노드를 조립한다."""

from __future__ import annotations

from typing import Any

import httpx

from ..runtime.execution.trace import ExecutionTrace
from ..runtime.llm.client import make_chat
from ..runtime.llm.structured_agent import recursion_config
from ..runtime.node import node_registry
from ..runtime.validation_graph import FINALIZE, ValidationGraphContext
from .graph import CHAT_GRAPH
from .models import ChatRequest, ChatResult
from .nodes.converse import ConverseNode
from .policy import AGENT_RECURSION_LIMIT, CHAT_MAX_OUTPUT_TOKENS

AGENT_NAME = "chat"


# 대화는 검증 분기가 없어 라우터가 호출되지 않으므로 확정 경로만 돌려주는 자리표시자다.
def _no_validation(_state: Any) -> Any:
    return FINALIZE


async def run_chat(req: ChatRequest, http_client: httpx.AsyncClient, usage: ExecutionTrace) -> dict[str, Any]:
    """chat 노드를 실행 의존성과 결합해 대화 그래프를 수행한다."""
    chat = make_chat(req.model, req.apiKey, req.deadlineMs, max_output_tokens=CHAT_MAX_OUTPUT_TOKENS)
    fallback_model = req.effective_fallback_model()
    fallback_chat = (
        make_chat(fallback_model, req.apiKey, req.deadlineMs, max_output_tokens=CHAT_MAX_OUTPUT_TOKENS)
        if fallback_model is not None
        else None
    )
    context = ValidationGraphContext(
        AGENT_NAME,
        usage,
        node_registry([ConverseNode(req, http_client, usage, chat, fallback_chat, agent_name=AGENT_NAME)]),
        _no_validation,
    )
    final = await CHAT_GRAPH.ainvoke(
        {
            "language": req.language,
            "summary": req.summary,
            "facts": req.facts,
            "messages": [],
            "model_cost_usd": 0.0,
            "result": None,
        },
        context=context,
        config=recursion_config(AGENT_RECURSION_LIMIT),
    )
    return final["result"] or ChatResult().model_dump(mode="json")
