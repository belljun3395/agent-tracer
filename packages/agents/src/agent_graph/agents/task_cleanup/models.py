"""task-cleanup의 HTTP 봉투, 그래프 상태, 구조화 체인 계약."""

from __future__ import annotations

import operator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ConfigDict, Field

from ..shared.models import AgentExecutionRequest, Language, TrimmedStr

# 저장 계약의 판별자와 같은 값이어야 하는 정리 제안의 종류다.
CleanupSuggestionKind = Literal["archive"]

MAX_SUGGESTIONS = 50
MAX_EVIDENCE_EVENT_IDS = 100

# 워커의 도구 응답을 그대로 받으므로 워커가 필드를 늘려도 실행이 깨지지 않게 모르는 필드는 버린다.
_TOOL_RESPONSE = ConfigDict(extra="ignore")


class CleanupCandidate(BaseModel):
    model_config = _TOOL_RESPONSE

    id: TrimmedStr = Field(min_length=1)
    # 워커는 태스크 제목을 가공하지 않고 내주므로 제목이 빈 문자열일 수 있다.
    visibleTitle: str
    status: TrimmedStr = Field(min_length=1)
    lastEventAt: str | None
    hasEvents: bool
    activeChildCount: int = Field(ge=0)
    candidateReasons: list[TrimmedStr]


class CleanupBatch(BaseModel):
    """서버가 이번 스캔 대상으로 미리 자격 심사한 후보 배치다."""

    model_config = _TOOL_RESPONSE

    candidates: list[CleanupCandidate] = Field(default_factory=list)
    # 서버 조회 상한에 걸려 이 배치가 후보 전체를 담지 못했는지 여부다.
    batchTruncated: bool = False


class TaskCleanupRequest(AgentExecutionRequest):
    """Python-native task-cleanup이 받는 도메인 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 300_000
    scannedAt: TrimmedStr = Field(min_length=1)
    # 조회 범위를 정하는 값이라 도메인 입력이며 멱등 해시에 함께 든다.
    userId: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    maxSuggestions: int = Field(ge=1, le=MAX_SUGGESTIONS)
    batch: CleanupBatch


class CandidatePage(BaseModel):
    model_config = _TOOL_RESPONSE

    candidates: list[CleanupCandidate]
    truncated: bool
    nextCursor: str | None = None
    total: int = Field(ge=0)
    moreCandidatesOutsideBatch: bool


class CleanupEvent(BaseModel):
    model_config = _TOOL_RESPONSE

    id: TrimmedStr = Field(min_length=1)
    seq: TrimmedStr = Field(min_length=1)
    kind: TrimmedStr = Field(min_length=1)
    title: str
    body: str | None = None
    toolName: str | None = None
    filePaths: list[str] = Field(default_factory=list)
    occurredAt: TrimmedStr = Field(min_length=1)


class EventPage(BaseModel):
    model_config = _TOOL_RESPONSE

    events: list[CleanupEvent]
    truncated: bool
    nextCursor: str | None = None
    total: int = Field(ge=0)


# 한 후보를 열어보는 데 쓰는 최대 라운드이며 조율자의 배분을 이 안으로 가둔다.
MAX_INSPECT_ROUNDS = 4
MAX_INSPECT_EXCERPTS = 6
MAX_INSPECT_REASON_CHARS = 400
CLEANUP_REVIEWER_ROLE = "cleanup-candidate-reviewer"


class InspectAssignment(BaseModel):
    """조율자가 열어보기로 고른 후보 하나와 배분한 라운드다."""

    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    rounds: int = Field(ge=1, le=MAX_INSPECT_ROUNDS)


class TriagePlan(BaseModel):
    """조율자가 후보 배치를 보고 무엇을 열어볼지 정한 결과다."""

    model_config = ConfigDict(extra="forbid")

    inspect: list[InspectAssignment] = Field(default_factory=list, max_length=MAX_SUGGESTIONS)

    def total_rounds(self) -> int:
        """계획이 요구하는 조사 라운드 합이다."""
        return sum(item.rounds for item in self.inspect)


class InspectDispatch(BaseModel):
    """조율자가 후보 조사 분기 하나에 실어 보내는 조사 지시와 비용 몫이다."""

    model_config = ConfigDict(extra="forbid")

    assignment: InspectAssignment
    cost_share: float = Field(gt=0.0, le=1.0)


class InspectReport(BaseModel):
    """한 후보를 열어본 결과이며 조율자는 이것만 보고 제안을 쓴다."""

    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    archivable: bool
    reason: TrimmedStr = Field(min_length=1, max_length=MAX_INSPECT_REASON_CHARS)
    citedEventIds: list[TrimmedStr] = Field(default_factory=list, max_length=MAX_INSPECT_EXCERPTS)


def merged_candidates(
    left: dict[str, CleanupCandidate], right: dict[str, CleanupCandidate]
) -> dict[str, CleanupCandidate]:
    """병렬 조사가 노출한 후보를 하나의 목록으로 합친다."""
    return {**left, **right}


def merged_event_ids(
    left: dict[str, set[str]], right: dict[str, set[str]]
) -> dict[str, set[str]]:
    """태스크마다 실제로 열어본 이벤트를 합집합으로 합친다."""
    combined = {task_id: set(ids) for task_id, ids in left.items()}
    for task_id, ids in right.items():
        combined.setdefault(task_id, set()).update(ids)
    return combined


class CleanupDraftSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: CleanupSuggestionKind = Field(description='The suggestion kind, always "archive"')
    taskId: TrimmedStr = Field(min_length=1)
    rationale: TrimmedStr = Field(min_length=1, max_length=500)
    evidenceEventIds: list[TrimmedStr] = Field(
        default_factory=list,
        max_length=MAX_EVIDENCE_EVENT_IDS,
        description="Event IDs get_task_events returned for this task and that back the rationale",
    )


class CleanupDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggestions: list[CleanupDraftSuggestion] = Field(
        default_factory=list, max_length=MAX_SUGGESTIONS
    )


class TaskCleanupState(TypedDict):
    scanned_at: str
    language: Language
    max_suggestions: int
    # 근거는 프롬프트에 다시 붙이지 않고 대화 이력에 남아 캐시된다.
    messages: list[BaseMessage]
    plan: TriagePlan | None
    # 후보마다 병렬로 열어보므로 노출·인용·지출이 모두 누적으로 합쳐져야 한다.
    reports: Annotated[list[InspectReport], operator.add]
    exposed_candidates: Annotated[dict[str, CleanupCandidate], merged_candidates]
    event_ids_by_task: Annotated[dict[str, set[str]], merged_event_ids]
    model_cost_usd: Annotated[float, operator.add]
    suggestions: list[CleanupDraftSuggestion]
    validation_errors: list[str]
    repair_attempted: bool
    result: dict[str, object] | None
