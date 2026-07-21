"""chat 장기기억을 tracer DB의 chat_user_memories 정본에 직접 읽고 쓰는 LangGraph BaseStore를 소유한다."""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

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

from ..runtime.ledger import LedgerPoolProvider

# 장기기억은 스레드를 가로지르므로 사용자 하나로만 범위가 묶인 네임스페이스를 쓴다.
MEMORY_NAMESPACE = "chat_memory"

_GET = "SELECT key, content, updated_at FROM chat_user_memories WHERE user_id = $1 AND key = $2"
_SEARCH = "SELECT key, content, updated_at FROM chat_user_memories WHERE user_id = $1"
_UPSERT = """
    INSERT INTO chat_user_memories (id, user_id, key, content, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $5)
    ON CONFLICT (user_id, key)
    DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
"""
_DELETE = "DELETE FROM chat_user_memories WHERE user_id = $1 AND key = $2"


def memory_namespace(user_id: str) -> tuple[str, ...]:
    """한 사용자의 장기기억을 담는 BaseStore 네임스페이스 튜플이다."""
    return (MEMORY_NAMESPACE, user_id)


class ChatMemoryStore(BaseStore):
    """chat 장기기억을 tracer DB의 chat_user_memories에 사용자 범위로 직접 읽고 쓰는 저장소다."""

    def __init__(self, ledger: LedgerPoolProvider, user_id: str) -> None:
        self._ledger = ledger
        self._user_id = user_id

    def batch(self, ops: Iterable[Op]) -> list[Result]:
        """이 저장소는 비동기 그래프에서만 도므로 동기 배치는 지원하지 않는다."""
        raise NotImplementedError("ChatMemoryStore is async-only; use abatch")

    async def abatch(self, ops: Iterable[Op]) -> list[Result]:
        """읽기·쓰기·검색 연산을 chat_user_memories 정본 질의로 하나씩 되돌린다."""
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

    async def _get(self, key: str) -> Item | None:
        pool = await self._ledger.pool()
        async with pool.acquire() as connection:
            row = await connection.fetchrow(_GET, self._user_id, key)
        if row is None:
            return None
        return _item(memory_namespace(self._user_id), row)

    async def _search(self) -> list[SearchItem]:
        namespace = memory_namespace(self._user_id)
        pool = await self._ledger.pool()
        async with pool.acquire() as connection:
            rows = await connection.fetch(_SEARCH, self._user_id)
        return [_search_item(namespace, row) for row in rows]

    async def _put(self, op: PutOp) -> None:
        pool = await self._ledger.pool()
        async with pool.acquire() as connection:
            if op.value is None:
                await connection.execute(_DELETE, self._user_id, op.key)
                return
            content = str(op.value.get("content", ""))
            now = datetime.now(UTC)
            await connection.execute(_UPSERT, str(uuid.uuid4()), self._user_id, op.key, content, now)


def _row_time(row: Any) -> datetime:
    raw = row["updated_at"]
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str):
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return datetime.now(UTC)


def _item(namespace: tuple[str, ...], row: Any) -> Item:
    at = _row_time(row)
    return Item(
        value={"content": row["content"]},
        key=str(row["key"]),
        namespace=namespace,
        created_at=at,
        updated_at=at,
    )


def _search_item(namespace: tuple[str, ...], row: Any) -> SearchItem:
    at = _row_time(row)
    return SearchItem(
        namespace=namespace,
        key=str(row["key"]),
        value={"content": row["content"]},
        created_at=at,
        updated_at=at,
    )
