"""recipe-scan 도구 콜백 호출과 응답 파싱을 소유한다."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ...runtime.callback import invoke_remote_tool
from ...runtime.telemetry.spans import tool_span
from ...shared.models import ToolCallback
from ..models import EvidenceQuery, EvidenceRecord
from .contracts import validate_query


def _parse_content(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


async def invoke_query(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    query: EvidenceQuery,
) -> EvidenceRecord:
    """검증된 도구 질의를 워커 콜백으로 실행해 근거 레코드로 만든다."""
    args = validate_query(query)
    async with tool_span(query.tool, agent_name="recipe-scan", parameters=args):
        content = await invoke_remote_tool(client, callback, query.tool, args)
    return EvidenceRecord(
        tool=query.tool,
        args=args,
        content=content,
        parsed=_parse_content(content),
        purpose=query.purpose,
    )
