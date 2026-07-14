"""테스트용 페이크: 네트워크 없이 그래프 배선을 검증한다."""

from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import AIMessage


def mk_ai(
    content: str = "",
    *,
    tool_calls: list[dict[str, Any]] | None = None,
    usage: dict[str, Any] | None = None,
    response_metadata: dict[str, Any] | None = None,
) -> AIMessage:
    return AIMessage(
        content=content,
        tool_calls=tool_calls or [],
        usage_metadata=usage
        or {
            "input_tokens": 100,
            "output_tokens": 40,
            "total_tokens": 140,
            "input_token_details": {"cache_read": 10, "cache_creation": 5},
        },
        response_metadata=response_metadata or {},
    )


class FakeToolLoopChat:
    """도구 루프 대역. 턴마다 도구 호출이나 구조화 출력을 순서대로 재생한다.

    turns의 각 항목은 도구 호출 목록(list)이거나 최종 구조화 출력(dict)이다.
    """

    def __init__(self, turns: list[Any]) -> None:
        self.turns = list(turns)
        self.bound_tools: list[dict[str, Any]] = []
        self.output_config: dict[str, Any] | None = None
        self.requests: list[list[Any]] = []

    def bind_tools(self, tools: list[dict[str, Any]]) -> FakeToolLoopChat:
        self.bound_tools = tools
        return self

    def bind(self, **kwargs: Any) -> FakeToolLoopChat:
        self.output_config = kwargs.get("output_config")
        return self

    async def ainvoke(self, messages: list[Any]) -> AIMessage:
        self.requests.append(list(messages))
        if not self.turns:
            raise AssertionError("no fake turn remains")
        turn = self.turns.pop(0)
        if isinstance(turn, list):
            calls = [
                {"name": call["name"], "args": call.get("args", {}), "id": f"call-{index}", "type": "tool_call"}
                for index, call in enumerate(turn)
            ]
            return mk_ai(tool_calls=calls)
        return mk_ai(content=_json.dumps(turn, ensure_ascii=False))

    def cached_blocks(self) -> int:
        """마지막 요청에서 캐시 경계가 붙은 블록 수다."""
        last = self.requests[-1] if self.requests else []
        found = 0
        for message in last:
            content = getattr(message, "content", None)
            if isinstance(content, list):
                found += sum(
                    1
                    for block in content
                    if isinstance(block, dict) and "cache_control" in block
                )
        return found


class FakeToolResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeToolClient:
    """워커 도구 콜백 대역. 도구 이름별 결과를 돌려주고 호출 순서를 기록한다."""

    def __init__(self, results: dict[str, Any] | None = None) -> None:
        self.results = results or {}
        self.calls: list[str] = []
        self.tokens: list[str] = []
        self.args: list[dict[str, Any]] = []

    async def post(
        self, _url: str, json: dict[str, Any], headers: dict[str, str] | None = None
    ) -> FakeToolResponse:
        name = str(json["name"])
        self.calls.append(name)
        self.tokens.append(str(json["token"]))
        self.args.append(dict(json["args"]))
        if name not in self.results:
            return FakeToolResponse({"error": f"Unknown tool: {name}"})
        return FakeToolResponse({"content": _json.dumps(self.results[name])})

    async def aclose(self) -> None:
        return None
