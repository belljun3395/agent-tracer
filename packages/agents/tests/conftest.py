"""Python 에이전트 테스트의 프로세스 환경과 공유 계측 자원을 고정한다."""

from __future__ import annotations

import pytest
from opentelemetry import trace as trace_api
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

# OTel Python은 프로세스당 TracerProvider 등록을 한 번만 허용한다(재호출은 무시된다).
# pytest가 테스트 수집보다 먼저 이 conftest를 임포트하므로 여기서 한 번만 등록해
# runtime/test_observability.py와 app/test_app.py가 같은 exporter를 공유하게 한다.
SHARED_SPAN_EXPORTER = InMemorySpanExporter()
_PROVIDER = TracerProvider()
_PROVIDER.add_span_processor(SimpleSpanProcessor(SHARED_SPAN_EXPORTER))
trace_api.set_tracer_provider(_PROVIDER)


@pytest.fixture(autouse=True)
def isolate_otel_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """외부 OTLP 설정이 테스트의 전역 provider 선택에 섞이지 않게 한다."""
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    monkeypatch.delenv("OTEL_SDK_DISABLED", raising=False)
    monkeypatch.delenv("OTEL_SERVICE_NAME", raising=False)
