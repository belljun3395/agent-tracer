"""원장 뷰를 읽는 연결 풀의 수명을 소유한다."""

from __future__ import annotations

import asyncio

import asyncpg

# 런타임의 Pool은 첨자를 받지 않으므로 평가가 지연되는 별칭으로만 제네릭 형태를 쓴다.
type LedgerPool = asyncpg.Pool[asyncpg.Record]

MIN_POOL_SIZE = 1
MAX_POOL_SIZE = 8


class LedgerPoolProvider:
    """원장 연결 풀을 처음 필요한 순간에 열고 그 뒤로는 같은 풀을 내준다."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: LedgerPool | None = None
        self._lock = asyncio.Lock()

    async def pool(self) -> LedgerPool:
        """원장 뷰에 붙는 연결 풀을 돌려준다."""
        async with self._lock:
            if self._pool is None:
                opened = await asyncpg.create_pool(
                    self._dsn, min_size=MIN_POOL_SIZE, max_size=MAX_POOL_SIZE
                )
                if opened is None:
                    raise RuntimeError("원장 연결 풀을 열지 못했다")
                self._pool = opened
            return self._pool

    async def close(self) -> None:
        """열린 적이 있으면 연결 풀을 닫는다."""
        async with self._lock:
            if self._pool is not None:
                await self._pool.close()
                self._pool = None
