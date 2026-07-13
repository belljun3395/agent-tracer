"""실행 취소 레지스트리와 멱등 실행 캐시를 관리한다."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable

from ...shared.models import AgentResponse

ResponseFactory = Callable[[], Awaitable[AgentResponse]]

_IDEMPOTENCY_TTL_S = 300.0
_idempotency_cache: dict[str, tuple[float, asyncio.Task[AgentResponse]]] = {}
_run_tasks: dict[str, asyncio.Task[AgentResponse]] = {}


def cancel_run(run_id: str) -> bool:
    """runId로 등록된 진행 중 실행을 취소한다."""
    task = _run_tasks.get(run_id)
    if task is None or task.done():
        return False
    task.cancel()
    return True


async def run_registered(
    factory: ResponseFactory,
    *,
    idempotency_key: str | None,
    run_key: str | None,
) -> AgentResponse:
    """실행을 취소 레지스트리와 선택적 멱등 캐시에 등록해 기다린다."""
    if idempotency_key is not None:
        now = time.monotonic()
        _prune_idempotency_cache(now)
        cached = _idempotency_cache.get(idempotency_key)
        if cached is not None:
            return await _await_idempotent(idempotency_key, run_key, cached[1])
        task = asyncio.ensure_future(factory())
        _idempotency_cache[idempotency_key] = (now + _IDEMPOTENCY_TTL_S, task)
        return await _await_idempotent(idempotency_key, run_key, task)
    if run_key is None:
        return await factory()
    task = asyncio.ensure_future(factory())
    return await _await_registered(run_key, task)


def _prune_idempotency_cache(now: float) -> None:
    expired = [key for key, (expires_at, _) in _idempotency_cache.items() if expires_at <= now]
    for key in expired:
        del _idempotency_cache[key]


async def _await_registered(
    key: str | None,
    task: asyncio.Task[AgentResponse],
) -> AgentResponse:
    if key:
        _run_tasks[key] = task
    try:
        return await task
    finally:
        if key and _run_tasks.get(key) is task:
            del _run_tasks[key]


def _drop_cached_task(idempotency_key: str, task: asyncio.Task[AgentResponse]) -> None:
    cached = _idempotency_cache.get(idempotency_key)
    if cached is not None and cached[1] is task:
        del _idempotency_cache[idempotency_key]


async def _await_idempotent(
    idempotency_key: str,
    run_key: str | None,
    task: asyncio.Task[AgentResponse],
) -> AgentResponse:
    try:
        response = await _await_registered(run_key, task)
    except BaseException:
        _drop_cached_task(idempotency_key, task)
        raise
    if response.error is not None:
        _drop_cached_task(idempotency_key, task)
    return response
