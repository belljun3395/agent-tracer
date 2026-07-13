"""HTTP 헤더와 OpenTelemetry 추적 문맥을 상호 변환한다."""

from __future__ import annotations

import importlib
from collections.abc import Mapping
from typing import Any


def extract_trace_context(headers: Mapping[str, str]) -> Any:
    """전달받은 HTTP 헤더에서 추적 부모 문맥을 읽는다."""
    propagate_mod = _propagation_module()
    if propagate_mod is None:
        return None
    return propagate_mod.extract(headers)


def inject_trace_context(headers: dict[str, str]) -> dict[str, str]:
    """현재 추적 문맥을 주어진 HTTP 헤더에 기록한다."""
    propagate_mod = _propagation_module()
    if propagate_mod is not None:
        propagate_mod.inject(headers)
    return headers


def _propagation_module() -> Any | None:
    try:
        return importlib.import_module("opentelemetry.propagate")
    except ModuleNotFoundError:
        return None
