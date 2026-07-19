"""테스트용 페이크: 네트워크 없이 그래프 배선을 검증한다."""

from __future__ import annotations

import json as _json
from datetime import UTC, datetime
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

    def bind_tools(self, tools: list[Any], **_kwargs: Any) -> FakeToolLoopChat:
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
        structured_names = {"TitleSuggestionDraft", "CleanupDraft", "RecipeDraft"}
        structured_tool = next(
            (tool for tool in self.bound_tools if getattr(tool, "name", "") in structured_names), None
        )
        if structured_tool is not None:
            tool_name = structured_tool.name
            return mk_ai(
                tool_calls=[
                    {"name": tool_name, "args": turn, "id": "call-structured", "type": "tool_call"}
                ]
            )
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


class FakeLedgerConnection:
    """원장 뷰 조회 대역. 소유 확인과 페이지와 총계를 캔 데이터로 돌려준다."""

    def __init__(self, ledger: FakeLedger) -> None:
        self._ledger = ledger

    async def fetchval(self, statement: str, *args: Any) -> Any:
        if "count(*)" in statement:
            return self._ledger.total
        return 1 if self._ledger.owned else None

    async def fetchrow(self, _statement: str, *_args: Any) -> Any:
        return self._ledger.task if self._ledger.owned else None

    async def fetch(self, statement: str, *args: Any) -> list[Any]:
        if "agent_rule_view" in statement:
            return list(self._ledger.rules)
        self._ledger.queries.append({"desc": "ORDER BY seq DESC" in statement, "args": list(args)})
        return list(self._ledger.rows)


class FakeLedgerAcquire:
    """asyncpg 풀의 연결 획득 비동기 컨텍스트 대역."""

    def __init__(self, ledger: FakeLedger) -> None:
        self._ledger = ledger

    async def __aenter__(self) -> FakeLedgerConnection:
        return FakeLedgerConnection(self._ledger)

    async def __aexit__(self, *_exc: Any) -> None:
        return None


class FakeLedger:
    """원장 연결 풀 공급자 대역. 조회 인자를 기록하고 캔 행을 돌려준다."""

    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        *,
        owned: bool = True,
        total: int | None = None,
        rules: list[dict[str, Any]] | None = None,
        task: dict[str, Any] | None = None,
    ) -> None:
        self.rows = rows or []
        self.owned = owned
        self.total = len(self.rows) if total is None else total
        self.rules = rules or []
        self.task = task or {
            "id": "t1",
            "title": "x",
            "status": "completed",
            "task_kind": "monitoring",
            "workspace_path": None,
            "created_at": datetime(2026, 7, 14, tzinfo=UTC),
            "updated_at": datetime(2026, 7, 14, tzinfo=UTC),
        }
        self.queries: list[dict[str, Any]] = []

    async def pool(self) -> FakeLedger:
        return self

    def acquire(self) -> FakeLedgerAcquire:
        return FakeLedgerAcquire(self)

    async def close(self) -> None:
        return None


class FakeSearch:
    """검색 색인 대역. 색인별 캔 히트를 돌려주고 질의 본문을 기록한다."""

    def __init__(self, hits: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.hits = hits or {}
        self.bodies: list[dict[str, Any]] = []

    async def search(self, index: str, body: dict[str, Any]) -> dict[str, Any]:
        self.bodies.append({"index": index, "body": body})
        found = self.hits.get(index, [])
        return {"hits": {"total": {"value": len(found)}, "hits": found}}

    async def close(self) -> None:
        return None
