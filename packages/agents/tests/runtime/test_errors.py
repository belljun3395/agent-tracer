from __future__ import annotations

import httpx
from anthropic import APIConnectionError, AuthenticationError
from langchain.agents.middleware.model_call_limit import ModelCallLimitExceededError

from agent_graph.agents.runtime.errors import (
    BudgetExceeded,
    DeadlineExceeded,
    OutputTruncated,
    classify_exception,
)


class TestClassifyException:
    def test_데드라인은_deadline_exceeded로_비재시도(self) -> None:
        assert classify_exception(DeadlineExceeded("초과")).subtype == "deadline_exceeded"

    def test_예산초과는_budget_exceeded(self) -> None:
        assert classify_exception(BudgetExceeded("예산")).subtype == "budget_exceeded"

    def test_출력절단은_max_tokens(self) -> None:
        assert classify_exception(OutputTruncated("절단")).subtype == "max_tokens"

    def test_도구_예산_소진은_max_turns_exceeded로_비재시도(self) -> None:
        err = ModelCallLimitExceededError(thread_count=0, run_count=18, thread_limit=None, run_limit=18)

        classified = classify_exception(err)

        assert classified.subtype == "max_turns_exceeded"
        assert "18" in classified.summary

    def test_인증오류는_API가_준_type을_그대로_쓴다(self) -> None:
        request = httpx.Request("POST", "https://api.anthropic.com")
        response = httpx.Response(401, request=request)
        err = AuthenticationError(
            "unauthorized",
            response=response,
            body={"error": {"type": "authentication_error", "message": "bad key"}},
        )
        assert classify_exception(err).subtype == "authentication_error"

    def test_연결오류는_connection_error(self) -> None:
        request = httpx.Request("POST", "https://api.anthropic.com")
        err = APIConnectionError(message="down", request=request)
        assert classify_exception(err).subtype == "connection_error"

    def test_알수없는_예외는_agent_error(self) -> None:
        assert classify_exception(RuntimeError("boom")).subtype == "agent_error"
