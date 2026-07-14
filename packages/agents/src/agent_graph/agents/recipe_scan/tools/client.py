"""recipe-scan 도구 호출과 근거 장부 기록을 소유한다."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ...runtime.callback import invoke_remote_tool
from ...runtime.llm.tool_loop import ToolSpec
from ...runtime.telemetry.spans import tool_span
from ...shared.models import ToolCallback
from ..models import EvidenceRecord, ProvenanceCatalog
from .contracts import RECIPE_TOOLS, validate_tool_args
from .provenance import add_provenance

RECIPE_TOOL_SPECS: tuple[ToolSpec, ...] = tuple(
    ToolSpec(tool.name, tool.description, tool.args_model) for tool in RECIPE_TOOLS
)


def _parse_content(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


async def invoke_tool(
    client: httpx.AsyncClient,
    callback: ToolCallback,
    name: str,
    args: dict[str, Any],
) -> str:
    """모델이 고른 도구를 인자 검증 뒤 워커 콜백으로 실행한다."""
    validated = validate_tool_args(name, args)
    async with tool_span(name, agent_name="recipe-scan", parameters=validated):
        return await invoke_remote_tool(client, callback, name, validated)


def record_evidence(
    catalog: ProvenanceCatalog,
    name: str,
    args: dict[str, Any],
    content: str,
) -> None:
    """도구가 실제로 돌려준 식별자만 인용 가능한 근거로 올린다."""
    record = EvidenceRecord(
        tool=name,  # type: ignore[arg-type]
        args=args,
        content=content,
        parsed=_parse_content(content),
    )
    add_provenance(catalog, record)
