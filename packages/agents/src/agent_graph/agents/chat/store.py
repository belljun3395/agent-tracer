"""chat 장기기억을 tracer-api 정본에 HTTP로 잇는 LangGraph BaseStore를 소유한다."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

import httpx
from langgraph.store.base import (
    BaseStore,
    GetOp,
    Item,
    ListNamespacesOp,
    Op,
    PutOp,
    Result,
    SearchItem,
    SearchOp,
)

from .reader import USER_HEADER

# 장기기억은 스레드를 가로지르므로 사용자 하나로만 범위가 묶인 네임스페이스를 쓴다.
MEMORY_NAMESPACE = "chat_memory"
_MEMORY_PATH = "/api/v1/chat/memory"


def memory_namespace(user_id: str) -> tuple[str, ...]:
    """한 사용자의 장기기억을 담는 BaseStore 네임스페이스 튜플이다."""
    return (MEMORY_NAMESPACE, user_id)


class ChatMemoryStore(BaseStore):
    """chat 장기기억을 tracer-api의 chat_user_memories에 사용자 범위로 프록시하는 저장소다."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, user_id: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._user_id = user_id

    def batch(self, ops: Iterable[Op]) -> list[Result]:
        """이 저장소는 비동기 그래프에서만 도므로 동기 배치는 지원하지 않는다."""
        raise NotImplementedError("ChatMemoryStore is async-only; use abatch")

    async def abatch(self, ops: Iterable[Op]) -> list[Result]:
        """읽기·쓰기·검색 연산을 tracer-api 장기기억 API 호출로 하나씩 되돌린다."""
        results: list[Result] = []
        for op in ops:
            if isinstance(op, GetOp):
                results.append(await self._get(op.key))
            elif isinstance(op, SearchOp):
                results.append(await self._search())
            elif isinstance(op, PutOp):
                await self._put(op)
                results.append(None)
            elif isinstance(op, ListNamespacesOp):
                results.append([memory_namespace(self._user_id)])
        return results

    async def _rows(self) -> list[dict[str, Any]]:
        response = await self._client.get(
            f"{self._base_url}{_MEMORY_PATH}", headers={USER_HEADER: self._user_id}
        )
        response.raise_for_status()
        # tracer-api 응답은 { ok, data } 봉투로 감싸여 오므로 data 안의 items를 꺼낸다.
        payload = response.json()
        body = payload.get("data") if isinstance(payload, dict) else None
        container = body if isinstance(body, dict) else payload
        items = container.get("items", []) if isinstance(container, dict) else []
        return [row for row in items if isinstance(row, dict)]

    async def _get(self, key: str) -> Item | None:
        for row in await self._rows():
            if row.get("key") == key:
                return _item(memory_namespace(self._user_id), row)
        return None

    async def _search(self) -> list[SearchItem]:
        namespace = memory_namespace(self._user_id)
        return [_search_item(namespace, row) for row in await self._rows()]

    async def _put(self, op: PutOp) -> None:
        if op.value is None:
            return
        content = str(op.value.get("content", ""))
        response = await self._client.put(
            f"{self._base_url}{_MEMORY_PATH}/{op.key}",
            json={"content": content},
            headers={USER_HEADER: self._user_id},
        )
        response.raise_for_status()


def _parsed_time(row: dict[str, Any]) -> datetime:
    raw = row.get("updatedAt")
    if isinstance(raw, str):
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return datetime.now(UTC)


def _item(namespace: tuple[str, ...], row: dict[str, Any]) -> Item:
    at = _parsed_time(row)
    return Item(
        value={"content": row.get("content", "")},
        key=str(row.get("key", "")),
        namespace=namespace,
        created_at=at,
        updated_at=at,
    )


def _search_item(namespace: tuple[str, ...], row: dict[str, Any]) -> SearchItem:
    at = _parsed_time(row)
    return SearchItem(
        namespace=namespace,
        key=str(row.get("key", "")),
        value={"content": row.get("content", "")},
        created_at=at,
        updated_at=at,
    )
