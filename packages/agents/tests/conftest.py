"""Python 에이전트 테스트의 프로세스 환경을 고정한다."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolate_otel_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """외부 OTLP 설정이 테스트의 전역 provider 선택에 섞이지 않게 한다."""
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    monkeypatch.delenv("OTEL_SDK_DISABLED", raising=False)
    monkeypatch.delenv("OTEL_SERVICE_NAME", raising=False)
