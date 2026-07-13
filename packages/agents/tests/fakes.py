"""테스트용 페이크: 네트워크 없이 그래프 배선을 검증한다."""

from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from pydantic import BaseModel


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


class FakeStructuredChat:
    """구조화 체인 대역. 단계별 Pydantic 출력을 순서대로 재생한다."""

    def __init__(self, outputs: list[Any]) -> None:
        self.outputs = list(outputs)
        self.calls: list[type[BaseModel]] = []

    def with_structured_output(self, schema: type[BaseModel], include_raw: bool = False) -> Any:
        async def invoke(_input: Any) -> dict[str, Any]:
            if not self.outputs:
                raise AssertionError(f"no fake structured output remains for {schema.__name__}")
            self.calls.append(schema)
            parsed = schema.model_validate(self.outputs.pop(0))
            raw = mk_ai(content=_json.dumps(parsed.model_dump(mode="json"), ensure_ascii=False))
            return {"raw": raw, "parsed": parsed, "parsing_error": None}

        return RunnableLambda(invoke)


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
