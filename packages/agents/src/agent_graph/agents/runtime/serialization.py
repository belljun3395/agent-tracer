"""에이전트 프롬프트에 넣을 값을 결정적으로 직렬화한다."""

from __future__ import annotations

import json

from pydantic import BaseModel


def json_value(value: object) -> str:
    """도메인 값을 정렬된 JSON 문자열로 바꾼다."""
    return json.dumps(value, ensure_ascii=False, default=_json_default, sort_keys=True)


def _json_default(value: object) -> object:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, set):
        return sorted(value)
    raise TypeError(f"unsupported JSON value: {type(value).__name__}")
