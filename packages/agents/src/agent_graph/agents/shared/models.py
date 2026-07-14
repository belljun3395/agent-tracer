"""세 에이전트가 공유하는 HTTP 실행 봉투와 응답 계약."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


TrimmedStr = Annotated[str, BeforeValidator(_strip)]
Language = Literal["auto", "ko", "en", "ja", "zh"]


class ToolCallback(BaseModel):
    """도구 실행 창구. 토큰이 곧 소유 스코프라 실행 백엔드는 userId를 알 필요가 없다."""

    url: TrimmedStr = Field(min_length=1)
    token: TrimmedStr = Field(min_length=1)


class CompletionCallback(BaseModel):
    """실행 결과를 돌려줄 창구. 요청한 HTTP 연결이 아니라 이 창구가 결과를 받는다."""

    url: TrimmedStr = Field(min_length=1)
    token: TrimmedStr = Field(min_length=1)


class AgentExecutionRequest(BaseModel):
    """모든 에이전트 요청의 실행 봉투."""

    model: str
    apiKey: str = Field(min_length=1)
    jobId: str | None = None
    deadlineMs: int = 120_000
    idempotencyKey: str | None = Field(
        default=None,
        description="같은 키의 성공한 실행 결과를 단일 프로세스의 제한된 시간 동안 재사용한다.",
    )
    completionCallback: CompletionCallback


class AgentAccepted(BaseModel):
    """실행 접수 응답. 결과 본문은 완료 창구로 따로 전달된다."""

    status: Literal["accepted"] = "accepted"
    runId: str


class UsageDTO(BaseModel):
    inputTokens: int
    outputTokens: int
    cacheReadTokens: int
    cacheCreationTokens: int


AgentStepRole = Literal["system", "user", "assistant", "tool", "graph"]
GraphEventKind = Literal[
    "node.started",
    "node.completed",
    "node.failed",
    "route.selected",
    "validation.failed",
]


class AgentStepToolCall(BaseModel):
    id: str
    name: str
    args: dict[str, object]


class AgentStepDTO(BaseModel):
    """궤적 한 스텝. TS `AiJobStepPayload`(contracts)와 필드가 1:1 대응한다."""

    seq: int
    role: AgentStepRole
    content: str
    truncated: bool = False
    toolCalls: list[AgentStepToolCall] = Field(default_factory=list)
    toolName: str | None = None
    toolCallId: str | None = None
    inputTokens: int | None = None
    outputTokens: int | None = None
    cacheReadTokens: int | None = None
    cacheCreationTokens: int | None = None
    stopReason: str | None = None
    nodeName: str | None = None
    eventKind: GraphEventKind | None = None
    durationMs: int | None = None


class AgentErrorDTO(BaseModel):
    subtype: str | None = Field(description="값이 없으면 호출부의 기본 재시도 정책을 적용한다.")
    summary: str


class AgentResponse(BaseModel):
    """세 에이전트 공통 응답. data는 성공 시 구조화 출력, 실패 시 None."""

    data: dict[str, object] | None = None
    modelUsed: str
    durationMs: int
    numTurns: int | None = None
    usage: UsageDTO | None = None
    error: AgentErrorDTO | None = None
    steps: list[AgentStepDTO] = Field(
        default_factory=list,
        description="에이전트 실행의 모델 메시지와 도구 호출과 그래프 이벤트 궤적이다.",
    )
    actualModel: str | None = Field(
        default=None,
        description="프로바이더가 실제 응답에 사용한 모델이다.",
    )
    providerRequestId: str | None = Field(
        default=None,
        description="프로바이더가 실제 응답에 부여한 요청 식별자다.",
    )
