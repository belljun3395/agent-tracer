"""task-cleanup의 HTTP 봉투, 그래프 상태, 구조화 체인 계약."""

from __future__ import annotations

from typing import Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

from ..shared.models import AgentExecutionRequest, Language, ToolCallback, TrimmedStr


class TaskCleanupRequest(AgentExecutionRequest):
    """Python-native task-cleanup이 받는 도메인 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 300_000
    scannedAt: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    maxSuggestions: int = Field(ge=1, le=50)
    toolCallback: ToolCallback


class CleanupCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: TrimmedStr = Field(min_length=1)
    visibleTitle: TrimmedStr = Field(min_length=1)
    status: TrimmedStr = Field(min_length=1)
    lastEventAt: str | None
    hasEvents: bool
    activeChildCount: int = Field(ge=0)
    candidateReasons: list[TrimmedStr]


class CandidatePage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidates: list[CleanupCandidate]
    truncated: bool
    nextCursor: str | None = None
    total: int = Field(ge=0)
    moreCandidatesOutsideBatch: bool


class CleanupEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: TrimmedStr = Field(min_length=1)
    seq: TrimmedStr = Field(min_length=1)
    kind: TrimmedStr = Field(min_length=1)
    title: str
    body: str | None = None
    toolName: str | None = None
    filePaths: list[str] = Field(default_factory=list)
    occurredAt: TrimmedStr = Field(min_length=1)


class EventPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[CleanupEvent]
    truncated: bool
    nextCursor: str | None = None
    total: int = Field(ge=0)


class InspectionTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    order: Literal["asc", "desc"] = "desc"
    limit: int = Field(default=50, ge=1, le=100)
    cursor: TrimmedStr | None = Field(default=None, min_length=1)
    purpose: TrimmedStr = Field(min_length=1, max_length=300)


class InspectionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rationale: TrimmedStr = Field(min_length=1, max_length=500)
    targets: list[InspectionTarget] = Field(default_factory=list, max_length=25)


class EventEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: str
    args: dict[str, object]
    content: str
    page: EventPage | None = None


class CleanupDraftSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    rationale: TrimmedStr = Field(min_length=1, max_length=500)
    evidenceEventIds: list[TrimmedStr] = Field(default_factory=list, max_length=100)


class CleanupAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rationale: TrimmedStr = Field(min_length=1, max_length=500)
    suggestions: list[CleanupDraftSuggestion] = Field(default_factory=list, max_length=50)
    needsMoreEvidence: bool = False
    missingEvidence: list[TrimmedStr] = Field(default_factory=list, max_length=10)


class CleanupDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggestions: list[CleanupDraftSuggestion] = Field(default_factory=list, max_length=50)


class TaskCleanupState(TypedDict):
    scanned_at: str
    language: Language
    max_suggestions: int
    candidates: list[CleanupCandidate]
    model_candidates: list[CleanupCandidate]
    candidate_offset: int
    evidence: list[EventEvidence]
    event_ids_by_task: dict[str, set[str]]
    plan: InspectionPlan | None
    assessment: CleanupAssessment | None
    gather_rounds: int
    event_reads: int
    model_cost_usd: float
    accepted_suggestions: list[CleanupDraftSuggestion]
    valid_suggestions: list[CleanupDraftSuggestion]
    invalid_suggestions: list[CleanupDraftSuggestion]
    validation_errors: list[str]
    repair_attempted: bool
    result: dict[str, object] | None
