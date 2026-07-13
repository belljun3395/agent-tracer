"""에이전트와 도구 호출의 OpenTelemetry 스팬 경계를 제공한다."""

from __future__ import annotations

import importlib
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from .attributes import (
    GEN_AI_OPERATION,
    build_invoke_agent_attributes,
    build_tool_attributes,
    build_tool_span_attributes,
)
from .metrics import record_tool_duration

_TRACER_NAME = "langgraph-agents.ai-jobs"


class NoopSpan:
    """계측이 비활성화된 환경에서 스팬 인터페이스를 제공한다."""

    def set_attribute(self, _key: str, _value: object) -> None:
        """속성 기록 요청을 무시한다."""
        return

    def set_status(self, _status: object) -> None:
        """상태 기록 요청을 무시한다."""
        return

    def record_exception(self, _exception: BaseException) -> None:
        """예외 기록 요청을 무시한다."""
        return


@asynccontextmanager
async def invoke_agent_span(
    *,
    job_id: str | None,
    agent_name: str,
    model: str | None,
    parent_context: Any = None,
) -> AsyncIterator[Any]:
    """에이전트 호출을 부모 문맥과 연결된 스팬으로 감싼다."""
    attrs = build_invoke_agent_attributes(job_id=job_id, agent_name=agent_name, model=model)
    trace_mod = _trace_module()
    if trace_mod is None:
        yield NoopSpan()
        return

    tracer = trace_mod.get_tracer(_TRACER_NAME)
    with tracer.start_as_current_span(
        f'{GEN_AI_OPERATION["invoke_agent"]} {agent_name}',
        context=parent_context,
        kind=trace_mod.SpanKind.INTERNAL,
        attributes=attrs,
    ) as span:
        yield span


@asynccontextmanager
async def tool_span(
    tool_name: str,
    *,
    agent_name: str,
    parameters: object | None = None,
) -> AsyncIterator[Any]:
    """도구 호출을 스팬과 실행 시간 메트릭으로 감싼다."""
    started = time.monotonic()
    span_attrs = build_tool_span_attributes(tool_name, agent_name, parameters=parameters)
    metric_attrs = build_tool_attributes(tool_name, agent_name)
    trace_mod = _trace_module()
    if trace_mod is None:
        try:
            yield NoopSpan()
        finally:
            record_tool_duration(time.monotonic() - started, metric_attrs)
        return

    tracer = trace_mod.get_tracer(_TRACER_NAME)
    with tracer.start_as_current_span(
        f'{GEN_AI_OPERATION["execute_tool"]} {tool_name}',
        kind=trace_mod.SpanKind.INTERNAL,
        attributes=span_attrs,
    ) as span:
        error_type = None
        try:
            yield span
        except BaseException as err:
            error_type = type(err).__name__
            span.set_attribute("error.type", error_type)
            span.record_exception(err)
            raise
        finally:
            duration_attrs = {**metric_attrs}
            if error_type is not None:
                duration_attrs["error.type"] = error_type
            record_tool_duration(time.monotonic() - started, duration_attrs)


def mark_span_error(span: Any, subtype: str | None, summary: str) -> None:
    """정규화된 오류를 스팬 상태와 속성에 기록한다."""
    if subtype is None:
        return
    span.set_attribute("error.type", subtype)
    trace_mod = _trace_module()
    if trace_mod is not None:
        span.set_status(trace_mod.Status(trace_mod.StatusCode.ERROR, summary))


def _trace_module() -> Any | None:
    try:
        return importlib.import_module("opentelemetry.trace")
    except ModuleNotFoundError:
        return None
