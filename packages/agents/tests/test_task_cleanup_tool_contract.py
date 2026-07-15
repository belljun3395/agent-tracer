"""task-cleanup 도구 계약과 제안 종류를 커널의 골든 픽스처로 검증한다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, get_args

import pytest
from pydantic import BaseModel, ValidationError

from agent_graph.agents.task_cleanup.langchain_agent import get_task_events, list_candidate_tasks
from agent_graph.agents.task_cleanup.models import (
    MAX_EVIDENCE_EVENT_IDS,
    MAX_SUGGESTIONS,
    CandidatePage,
    CleanupCandidate,
    CleanupEvent,
    CleanupSuggestionKind,
    EventPage,
)
from agent_graph.agents.task_cleanup.policy import (
    MAX_TOOL_ROUNDS,
    TASK_CLEANUP_MAX_MODEL_COST_USD,
    TASK_CLEANUP_MAX_OUTPUT_TOKENS,
)
from agent_graph.agents.task_cleanup.tools import (
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    GET_TASK_EVENTS,
    LIST_CANDIDATE_TASKS,
    EventOrder,
    GetTaskEventsArgs,
    ListCandidateTasksArgs,
    validate_tool_args,
)

# 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
GOLDEN = Path(__file__).parents[2] / "kernel" / "src" / "agent" / "__fixtures__"


def _contract() -> Any:
    return json.loads((GOLDEN / "task.cleanup.tool.contract.json").read_text(encoding="utf-8"))


def _tool(name: str) -> Any:
    return _contract()["tools"][name]


def _partition(args_model: type[BaseModel]) -> tuple[set[str], set[str]]:
    required = {name for name, field in args_model.model_fields.items() if field.is_required()}
    return required, set(args_model.model_fields) - required


def test_턴_예산이_골든_계약과_같다() -> None:
    assert MAX_TOOL_ROUNDS == _contract()["maxTurns"]


def test_모델에게_여는_도구_이름이_골든_계약과_같다() -> None:
    assert {tool.name for tool in (list_candidate_tasks, get_task_events)} == set(_contract()["tools"])


def test_표준_tool이_runtime을_숨기고_골든_인자만_노출한다() -> None:
    tools = {tool.name: tool for tool in (list_candidate_tasks, get_task_events)}

    assert set(tools) == set(_contract()["tools"])
    for name, tool in tools.items():
        schema = tool.tool_call_schema.model_json_schema()
        contract = _tool(name)
        assert set(schema.get("required", [])) == set(contract["required"])
        assert set(schema["properties"]) == set(contract["required"] + contract["optional"])
        assert "runtime" not in schema["properties"]


def test_list_candidate_tasks의_필수와_선택_인자가_골든_계약과_같다() -> None:
    contract = _tool(LIST_CANDIDATE_TASKS)
    required, optional = _partition(ListCandidateTasksArgs)

    assert required == set(contract["required"])
    assert optional == set(contract["optional"])


def test_get_task_events의_필수와_선택_인자가_골든_계약과_같다() -> None:
    contract = _tool(GET_TASK_EVENTS)
    required, optional = _partition(GetTaskEventsArgs)

    assert required == set(contract["required"])
    assert optional == set(contract["optional"])


def test_list_candidate_tasks의_limit_기본값과_상하한이_골든_계약과_같다() -> None:
    limit = _tool(LIST_CANDIDATE_TASKS)["limit"]

    assert DEFAULT_CANDIDATE_LIMIT == limit["default"]
    assert ListCandidateTasksArgs().limit is None
    assert ListCandidateTasksArgs(limit=limit["max"]).limit == limit["max"]
    assert ListCandidateTasksArgs(limit=limit["min"]).limit == limit["min"]
    with pytest.raises(ValidationError):
        ListCandidateTasksArgs(limit=limit["max"] + 1)
    with pytest.raises(ValidationError):
        ListCandidateTasksArgs(limit=limit["min"] - 1)


def test_get_task_events의_limit_기본값과_상하한이_골든_계약과_같다() -> None:
    limit = _tool(GET_TASK_EVENTS)["limit"]

    assert DEFAULT_EVENT_LIMIT == limit["default"]
    assert GetTaskEventsArgs(taskId="task-1").limit is None
    assert GetTaskEventsArgs(taskId="task-1", limit=limit["max"]).limit == limit["max"]
    assert GetTaskEventsArgs(taskId="task-1", limit=limit["min"]).limit == limit["min"]
    with pytest.raises(ValidationError):
        GetTaskEventsArgs(taskId="task-1", limit=limit["max"] + 1)
    with pytest.raises(ValidationError):
        GetTaskEventsArgs(taskId="task-1", limit=limit["min"] - 1)


def test_get_task_events의_읽기_방향_기본값과_허용값이_골든_계약과_같다() -> None:
    order = _tool(GET_TASK_EVENTS)["order"]

    assert DEFAULT_EVENT_ORDER == order["default"]
    assert list(get_args(EventOrder)) == order["values"]
    assert GetTaskEventsArgs(taskId="task-1").order is None
    with pytest.raises(ValidationError):
        GetTaskEventsArgs(taskId="task-1", order="sideways")  # type: ignore[arg-type]


def test_생략한_인자는_콜백으로_보내지_않아_워커의_기본값이_걸린다() -> None:
    assert validate_tool_args(GET_TASK_EVENTS, {"taskId": "task-1"}) == {"taskId": "task-1"}
    assert validate_tool_args(LIST_CANDIDATE_TASKS, {}) == {}


def test_제안_종류가_골든_계약과_같다() -> None:
    assert list(get_args(CleanupSuggestionKind)) == _contract()["outputKinds"]


def test_제안_상한과_근거_상한과_토큰과_비용_예산이_골든_계약과_같다() -> None:
    limits = _contract()["limits"]

    assert MAX_SUGGESTIONS == limits["maxSuggestions"]
    assert MAX_EVIDENCE_EVENT_IDS == limits["maxEvidenceEventIds"]
    assert TASK_CLEANUP_MAX_OUTPUT_TOKENS == limits["maxOutputTokens"]
    assert TASK_CLEANUP_MAX_MODEL_COST_USD == limits["maxBudgetUsd"]


def test_list_candidate_tasks의_응답_본문이_골든_계약과_같다() -> None:
    responses = _contract()["responses"][LIST_CANDIDATE_TASKS]

    assert set(CandidatePage.model_fields) == set(responses["page"])
    assert set(CleanupCandidate.model_fields) == set(responses["item"])


def test_get_task_events의_응답_본문이_골든_계약과_같다() -> None:
    responses = _contract()["responses"][GET_TASK_EVENTS]

    assert set(EventPage.model_fields) == set(responses["page"])
    assert set(CleanupEvent.model_fields) == set(responses["item"])


def test_워커가_응답에_필드를_늘려도_도구_루프가_깨지지_않는다() -> None:
    page = CandidatePage.model_validate(
        {
            "candidates": [
                {
                    "id": "task-1",
                    "visibleTitle": "",
                    "status": "running",
                    "lastEventAt": None,
                    "hasEvents": False,
                    "activeChildCount": 0,
                    "candidateReasons": ["no-events"],
                    "archivedAt": None,
                }
            ],
            "truncated": False,
            "total": 1,
            "moreCandidatesOutsideBatch": False,
            "scannedAt": "2026-07-14T00:00:00Z",
        }
    )

    assert [candidate.id for candidate in page.candidates] == ["task-1"]
