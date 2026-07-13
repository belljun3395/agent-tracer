"""에이전트 본체에 데드라인·관측·오류 응답 조립을 적용한다."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

from ...shared.models import AgentResponse, UsageDTO
from ..errors import DeadlineExceeded, classify_exception
from ..telemetry.attributes import apply_usage_attributes
from ..telemetry.metrics import record_client_metrics
from ..telemetry.spans import invoke_agent_span, mark_span_error
from .registry import run_registered
from .trace import ExecutionTrace

AgentBody = Callable[[ExecutionTrace], Awaitable[dict[str, object]]]


async def execute(
    label: str,
    model: str,
    deadline_ms: int,
    body: AgentBody,
    job_id: str | None = None,
    idempotency_key: str | None = None,
    run_id: str | None = None,
    parent_context: Any = None,
) -> AgentResponse:
    """에이전트 실행을 등록하고 표준 응답으로 돌려준다."""
    key = run_id or idempotency_key or job_id
    return await run_registered(
        lambda: _execute(label, model, deadline_ms, body, job_id, parent_context),
        idempotency_key=idempotency_key,
        run_key=key,
    )


async def _execute(
    label: str,
    model: str,
    deadline_ms: int,
    body: AgentBody,
    job_id: str | None = None,
    parent_context: Any = None,
) -> AgentResponse:
    started = time.monotonic()
    trace = ExecutionTrace()
    data: dict[str, object] | None = None
    error = None
    usage_dto: UsageDTO | None = None
    async with invoke_agent_span(
        job_id=job_id,
        agent_name=label,
        model=model,
        parent_context=parent_context,
    ) as span:
        try:
            data = await asyncio.wait_for(body(trace), timeout=max(0.001, deadline_ms / 1000))
        except TimeoutError:
            error = classify_exception(DeadlineExceeded(f"agent {label} exceeded {deadline_ms}ms"))
        except asyncio.CancelledError:
            raise
        except BaseException as err:  # noqa: BLE001
            error = classify_exception(err)
        usage_dto = trace.to_usage_dto()
        apply_usage_attributes(span, usage_dto)
        if error is not None:
            mark_span_error(span, error.subtype, error.summary)

    duration_ms = int((time.monotonic() - started) * 1000)
    error_subtype = error.subtype if error else None
    record_client_metrics(model, duration_ms / 1000, usage_dto, error_subtype)
    return AgentResponse(
        data=data,
        modelUsed=model,
        durationMs=duration_ms,
        numTurns=trace.turns or None,
        usage=usage_dto,
        error=error,
        steps=trace.steps,
        actualModel=trace.actual_model,
        providerRequestId=trace.provider_request_id,
    )
