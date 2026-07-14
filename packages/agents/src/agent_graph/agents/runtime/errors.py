"""에이전트 실행 오류를 ai-agent-worker가 재시도 분류에 쓰는 errorSubtype으로 정규화한다.

비재시도 서브타입은 ai-agent-worker의 오류 상수와 같은 어휘를 쓴다. 그 외 오류는
Temporal 기본 재시도에 맡긴다.
"""

from __future__ import annotations

from anthropic import APIConnectionError, APIError, APIStatusError

from ..shared.models import AgentErrorDTO


class DeadlineExceeded(Exception):
    """벽시계 데드라인 초과. Temporal의 startToCloseTimeout보다 안쪽에서 먼저 끊는다."""


class BudgetExceeded(Exception):
    """쿼리당 USD 상한 초과. 재시도해도 예산만 더 태우므로 비재시도."""


class OutputTruncated(Exception):
    """max_tokens에서 잘려 구조화 출력을 완성하지 못함. 같은 입력이면 재시도해도 다시 잘린다."""


class MaxTurnsExceeded(Exception):
    """도구 예산 소진 후 truncate로 tool_use/tool_result 불변식을 복구해도 최종 구조화
    응답을 완성하지 못함. 같은 예산 안에서는 재시도해도 해소되지 않는다."""


def _anthropic_subtype(err: APIStatusError) -> str:
    body = getattr(err, "body", None)
    if isinstance(body, dict):
        inner = body.get("error")
        if isinstance(inner, dict):
            kind = inner.get("type")
            if isinstance(kind, str) and kind:
                return kind
    status = getattr(err, "status_code", None)
    return f"http_{status}" if status is not None else "api_error"


def classify_exception(err: BaseException) -> AgentErrorDTO:
    if isinstance(err, DeadlineExceeded):
        return AgentErrorDTO(subtype="deadline_exceeded", summary=str(err) or "agent deadline exceeded")
    if isinstance(err, BudgetExceeded):
        return AgentErrorDTO(subtype="budget_exceeded", summary=str(err))
    if isinstance(err, OutputTruncated):
        return AgentErrorDTO(subtype="max_tokens", summary=str(err))
    if isinstance(err, MaxTurnsExceeded):
        return AgentErrorDTO(subtype="max_turns_exceeded", summary=str(err))
    # Anthropic SDK에서 APIConnectionError는 APIError의 서브클래스다.
    if isinstance(err, APIConnectionError):
        return AgentErrorDTO(subtype="connection_error", summary=str(err))
    if isinstance(err, APIStatusError):
        return AgentErrorDTO(subtype=_anthropic_subtype(err), summary=str(err))
    if isinstance(err, APIError):
        return AgentErrorDTO(subtype="api_error", summary=str(err))
    return AgentErrorDTO(subtype="agent_error", summary=str(err) or type(err).__name__)
