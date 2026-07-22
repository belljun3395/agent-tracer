"""chat 대화 에이전트의 실행 봉투와 그래프 상태와 결과 계약."""

from __future__ import annotations

from typing import Literal, TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ConfigDict, Field

from ..shared.models import AgentExecutionRequest, Language, TrimmedStr

ChatMessageRole = Literal["user", "assistant", "tool"]


class ChatHistoryToolCall(BaseModel):
    """저장된 어시스턴트 도구 호출을 LangChain 메시지로 되살리는 최소 계약이다."""

    model_config = ConfigDict(extra="ignore")

    id: TrimmedStr = Field(min_length=1)
    name: TrimmedStr = Field(min_length=1)
    args: dict[str, object] = Field(default_factory=dict)


class ChatHistoryMessage(BaseModel):
    """워커가 실어 보내는 대화 이력 한 줄이며 그래프가 모델 메시지로 되살린다."""

    model_config = ConfigDict(extra="ignore")

    role: ChatMessageRole
    content: str = ""
    toolCalls: list[ChatHistoryToolCall] = Field(default_factory=list)
    toolCallId: str | None = None


class ChatFact(BaseModel):
    """사용자에 대해 기억해 둔 지속 사실 하나다."""

    model_config = ConfigDict(extra="ignore")

    key: TrimmedStr = Field(min_length=1)
    content: str


class ChatTurnFields(BaseModel):
    """두 실행 방식(내구성 접수·라이브 스트림)이 함께 받는 대화 턴 도메인 입력이다."""

    threadId: TrimmedStr = Field(min_length=1)
    # 조회 범위를 정하는 값이라 도메인 입력이며 멱등 해시에 함께 든다.
    userId: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    # 워커가 접은 이력의 최근 창과 요약이며, 요약이 없으면 None이다.
    summary: str | None = None
    messages: list[ChatHistoryMessage] = Field(default_factory=list)
    facts: list[ChatFact] = Field(default_factory=list)
    # 읽기 도구가 tracer-api 읽기 API를 사용자 범위로 되읽는 진입점이다.
    readApiBaseUrl: str = ""
    # 모델에게 보일 도구 설명이며 두 백엔드가 같은 문장을 쓰도록 계약 픽스처에서 워커가 실어 보낸다.
    toolDescriptions: dict[str, str] = Field(default_factory=dict)


class ChatRequest(ChatTurnFields, AgentExecutionRequest):
    """Python-native 대화 에이전트가 완료 창구로 결과를 되돌리는 내구성 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 120_000


class ChatStreamRequest(ChatTurnFields):
    """대화 턴을 열린 HTTP 연결로 토큰 스트림 배달하는 실행 봉투이며 완료 창구를 쓰지 않는다."""

    model_config = ConfigDict(extra="forbid")

    model: str
    apiKey: str = Field(min_length=1)
    deadlineMs: int = 120_000
    fallbackModel: str | None = Field(
        default=None,
        description="primary 모델 호출이 공급자 오류로 실패했을 때 한 번만 대체할 모델이다.",
    )

    def effective_fallback_model(self) -> str | None:
        """폴백 모델이 없거나 primary와 같으면 생략 대상임을 알린다."""
        if self.fallbackModel is None or self.fallbackModel == self.model:
            return None
        return self.fallbackModel


class ProposedWrite(BaseModel):
    """모델이 제안한 쓰기 하나이며 워커가 확인 대기 행으로 바꾼다."""

    model_config = ConfigDict(extra="forbid")

    toolName: TrimmedStr = Field(min_length=1)
    args: dict[str, object] = Field(default_factory=dict)


class MemoryWrite(BaseModel):
    """모델이 기억한 사실 하나이며 워커가 즉시 저장한다."""

    model_config = ConfigDict(extra="forbid")

    key: TrimmedStr = Field(min_length=1)
    content: str


class ChatResult(BaseModel):
    """대화 턴 하나의 구조화 결과이며 어시스턴트 답변과 제안·기억 쓰기를 담는다."""

    model_config = ConfigDict(extra="forbid")

    assistantText: str = ""
    proposedWrites: list[ProposedWrite] = Field(default_factory=list)
    memoryWrites: list[MemoryWrite] = Field(default_factory=list)


class StreamDelta(TypedDict):
    """토큰 스트림의 한 조각이며 어시스턴트 답변 일부를 담는다."""

    type: Literal["delta"]
    text: str


class StreamResult(TypedDict):
    """스트림 종료 시 한 번 나오는 최종 구조화 결과이며 blocking 경로와 동일한 페이로드다."""

    type: Literal["result"]
    data: dict[str, object]


ChatStreamChunk = StreamDelta | StreamResult


class ConverseUpdate(TypedDict):
    """대화 노드가 갱신하는 상태 부분집합이다."""

    messages: list[BaseMessage]
    model_cost_usd: float
    result: dict[str, object]


class ChatState(TypedDict):
    language: Language
    summary: str | None
    facts: list[ChatFact]
    # 근거는 프롬프트에 다시 붙이지 않고 대화 이력에 남아 캐시된다.
    messages: list[BaseMessage]
    model_cost_usd: float
    result: dict[str, object] | None
