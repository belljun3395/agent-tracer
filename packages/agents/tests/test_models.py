"""세 Python-native 에이전트의 HTTP 요청 경계를 검증한다."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from agent_graph.agents.recipe_scan.models import RecipeScanRequest
from agent_graph.agents.task_cleanup.models import TaskCleanupRequest
from agent_graph.agents.title_suggestion.models import TitleSuggestionRequest

_CALLBACK: dict[str, str] = {"url": "http://worker:8810/tools/invoke", "token": "tok-1"}
_COMPLETION: dict[str, str] = {"url": "http://worker:8810/runs/complete", "token": "done-1"}
_TITLE_CONTEXT: dict[str, object] = {
    "title": "Untitled",
    "status": "completed",
    "workspacePath": "/workspace/project",
    "totalEventCount": 1,
    "totalTurnCount": 1,
    "truncated": False,
    "turns": [{"turnIndex": 1, "askedText": "인증 누수를 고쳐줘", "assistantText": "수정했습니다."}],
}


class TestTitleSuggestionRequest:
    def test_도메인_봉투를_보존한다(self) -> None:
        req = TitleSuggestionRequest.model_validate(
            {
                "model": "m",
                "apiKey": "k",
                "taskId": " task-1 ",
                "language": "ko",
                "context": _TITLE_CONTEXT,
                "toolCallback": _CALLBACK,
                "completionCallback": _COMPLETION,
            }
        )

        assert req.taskId == "task-1"
        assert req.context.turns[0].askedText == "인증 누수를 고쳐줘"
        assert req.deadlineMs == 180_000

    def test_런타임_정의를_요청으로_받지_않는다(self) -> None:
        with pytest.raises(ValidationError):
            TitleSuggestionRequest.model_validate(
                {
                    "model": "m",
                    "apiKey": "k",
                    "taskId": "task-1",
                    "context": _TITLE_CONTEXT,
                    "toolCallback": _CALLBACK,
                    "completionCallback": _COMPLETION,
                    "systemPrompt": "injected",
                    "tools": [],
                }
            )


class TestTaskCleanupRequest:
    def test_도메인_봉투와_한도를_보존한다(self) -> None:
        req = TaskCleanupRequest.model_validate(
            {
                "model": "m",
                "apiKey": "k",
                "scannedAt": "2026-07-13T00:00:00.000Z",
                "language": "ko",
                "maxSuggestions": 20,
                "toolCallback": _CALLBACK,
                "completionCallback": _COMPLETION,
            }
        )

        assert req.scannedAt == "2026-07-13T00:00:00.000Z"
        assert req.maxSuggestions == 20
        assert req.deadlineMs == 300_000

    def test_런타임_정의를_요청으로_받지_않는다(self) -> None:
        with pytest.raises(ValidationError):
            TaskCleanupRequest.model_validate(
                {
                    "model": "m",
                    "apiKey": "k",
                    "scannedAt": "2026-07-13T00:00:00.000Z",
                    "maxSuggestions": 20,
                    "toolCallback": _CALLBACK,
                    "completionCallback": _COMPLETION,
                    "outputSchema": {"type": "object"},
                }
            )


class TestRecipeScanRequest:
    def test_도메인_입력과_콜백_창구를_요구한다(self) -> None:
        with pytest.raises(ValidationError):
            RecipeScanRequest.model_validate({"model": "m", "apiKey": "k"})

    def test_런타임_정의를_요청으로_받지_않는다(self) -> None:
        with pytest.raises(ValidationError):
            RecipeScanRequest.model_validate(
                {
                    "model": "m",
                    "apiKey": "k",
                    "taskId": "t1",
                    "systemPrompt": "s",
                    "outputSchema": {"type": "object"},
                    "tools": [],
                    "toolCallback": _CALLBACK,
                    "completionCallback": _COMPLETION,
                }
            )

    def test_도메인_봉투를_보존한다(self) -> None:
        req = RecipeScanRequest.model_validate(
            {
                "model": "m",
                "apiKey": "k",
                "taskId": " t1 ",
                "language": "ko",
                "userPrompt": " 작업에서 레시피를 찾아줘 ",
                "toolCallback": _CALLBACK,
                "completionCallback": _COMPLETION,
            }
        )

        assert req.taskId == "t1"
        assert req.language == "ko"
        assert req.userPrompt == "작업에서 레시피를 찾아줘"
        assert req.deadlineMs == 720_000
