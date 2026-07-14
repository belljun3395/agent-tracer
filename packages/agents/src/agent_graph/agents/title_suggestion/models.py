"""title-suggestion의 실행 봉투와 내부 구조화 체인 계약."""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ConfigDict, Field

from ..shared.models import AgentExecutionRequest, Language, ToolCallback, TrimmedStr


class TitleSuggestionTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # 컨텍스트가 첫 턴과 최근 창만 싣고 가운데를 잘라내므로 번호로 빠진 구간을 드러낸다.
    turnIndex: int = Field(ge=0)
    askedText: str
    assistantText: str | None = None


class TitleSuggestionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    status: str
    workspacePath: str | None = None
    totalEventCount: int = Field(ge=0)
    totalTurnCount: int = Field(ge=0)
    truncated: bool
    turns: list[TitleSuggestionTurn] = Field(max_length=21)


class TitleSuggestionRequest(AgentExecutionRequest):
    """Python-native title-suggestion의 도메인 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 180_000
    taskId: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    context: TitleSuggestionContext
    toolCallback: ToolCallback


class TitleSuggestion(BaseModel):
    title: TrimmedStr = Field(min_length=1, max_length=80)
    rationale: TrimmedStr = Field(min_length=1, max_length=200)


class TitleSuggestionDraft(BaseModel):
    suggestions: list[TitleSuggestion] = Field(default_factory=list, max_length=3)


class TitleSuggestionState(TypedDict):
    task_id: str
    language: Language
    context: TitleSuggestionContext
    # 근거는 프롬프트에 다시 붙이지 않고 대화 이력에 남아 캐시된다.
    messages: list[BaseMessage]
    model_cost_usd: float
    candidate: TitleSuggestionDraft | None
    validation_errors: list[str]
    repair_attempted: bool
    result: dict[str, object] | None
