"""recipe-scan의 내부 상태와 구조화 체인 계약."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared.models import AgentExecutionRequest, Language, TrimmedStr

# 한 태스크가 서로 다른 작업 turn을 담을 수 있어 스캔 한 번이 낼 수 있는 후보 수다.
MAX_RECIPE_CANDIDATES = 4

# 모델이 스스로 도구를 고르므로 라운드 수가 곧 조사 예산이며 커널의 골든 계약이 값을 소유한다.
MAX_TOOL_ROUNDS = 15

# 라운드 예산은 agent의 호출 한도가 집행한다. 한 라운드가 before_model·model·after_model·tools
# 네 슈퍼스텝을 도는 데다 미들웨어를 더하면 더 늘어나므로, 재귀 한도는 예산을 세는 자리가 아니라
# 폭주만 끊는 그물이다.
AGENT_RECURSION_LIMIT = 10 * MAX_TOOL_ROUNDS

RecipeToolName = Literal[
    "get_task_summary",
    "get_task_events",
    "list_rules",
    "search_events",
    "find_similar_tasks",
    "search_recipes",
    "check_citations",
]


class RecipeScanRequest(AgentExecutionRequest):
    """Python-native recipe-scan의 도메인 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 720_000
    taskId: TrimmedStr = Field(min_length=1)
    # 조회 범위를 정하는 값이라 도메인 입력이며 멱등 해시에 함께 든다.
    userId: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    userPrompt: TrimmedStr | None = None


ProbeName = Literal["timeline", "rules", "repetition"]

# 한 전문가에게 몰아줄 수 있는 최대 라운드이며 조율자의 배분을 이 안으로 가둔다.
MAX_PROBE_ROUNDS = 10


class ProbeAssignment(BaseModel):
    """조율자가 한 전문가에게 맡긴 질문과 배분한 조사 라운드다."""

    model_config = ConfigDict(extra="forbid")

    probe: ProbeName
    rounds: int = Field(ge=1, le=MAX_PROBE_ROUNDS)
    question: TrimmedStr = Field(min_length=1, max_length=300)


class DispatchPlan(BaseModel):
    """조율자가 세운 조사 계획이며 어디를 얼마나 팔지 스스로 정한 결과다."""

    model_config = ConfigDict(extra="forbid")

    probes: list[ProbeAssignment] = Field(min_length=1, max_length=3)

    def total_rounds(self) -> int:
        """계획이 요구하는 조사 라운드 합이다."""
        return sum(probe.rounds for probe in self.probes)


# 발췌 상한이 곧 맥락 격리의 강도다. 넉넉히 열면 전문가의 맥락이 조율자에게 그대로 옮겨온다.
MAX_EXCERPTS_PER_PROBE = 12
MAX_EXCERPT_CHARS = 600
MAX_VERDICT_CHARS = 1_200


class Excerpt(BaseModel):
    """전문가가 조율자에게 올리는 근거 한 조각이다."""

    model_config = ConfigDict(extra="forbid")

    taskId: TrimmedStr = Field(min_length=1)
    eventId: TrimmedStr = Field(min_length=1)
    text: TrimmedStr = Field(min_length=1, max_length=MAX_EXCERPT_CHARS)


class ProbeReport(BaseModel):
    """한 전문가의 조사 결과이며 조율자는 이것만 보고 후보를 쓴다."""

    model_config = ConfigDict(extra="forbid")

    probe: ProbeName
    verdict: TrimmedStr = Field(min_length=1, max_length=MAX_VERDICT_CHARS)
    excerpts: list[Excerpt] = Field(default_factory=list, max_length=MAX_EXCERPTS_PER_PROBE)
    # 예산이 끊겨 못 본 것이 있으면 조율자가 남은 예산을 다시 줄지 판단한다.
    exhausted: bool = False


class RecipeStep(BaseModel):
    order: int = Field(ge=1, le=50)
    action: TrimmedStr = Field(min_length=1, max_length=200)
    rationale: TrimmedStr | None = Field(default=None, max_length=300)


class RecipeTouchedFile(BaseModel):
    path: TrimmedStr = Field(min_length=1, max_length=500)
    role: Literal["read", "write", "both"]


class RecipeSlice(BaseModel):
    taskId: TrimmedStr = Field(min_length=1)
    turnIds: list[TrimmedStr] = Field(default_factory=list, max_length=50)
    eventIds: list[TrimmedStr] = Field(default_factory=list, max_length=200)


class RecipeCorrection(BaseModel):
    whatAgentDid: TrimmedStr = Field(min_length=1, max_length=500)
    howCorrected: TrimmedStr = Field(min_length=1, max_length=500)
    evidence: list[TrimmedStr] = Field(min_length=1, max_length=50)


class RecipePitfall(BaseModel):
    pitfall: TrimmedStr = Field(min_length=1, max_length=500)
    whyNonObvious: TrimmedStr = Field(min_length=1, max_length=500)
    evidence: list[TrimmedStr] = Field(min_length=1, max_length=50)


class RecipeCandidate(BaseModel):
    title: TrimmedStr = Field(min_length=1, max_length=120)
    intent: TrimmedStr = Field(min_length=1, max_length=200)
    description: TrimmedStr = Field(min_length=1, max_length=400)
    summary_md: TrimmedStr = Field(min_length=1, max_length=4000)
    request: TrimmedStr = Field(min_length=1, max_length=2000)
    corrections: list[RecipeCorrection] = Field(default_factory=list, max_length=20)
    pitfalls: list[RecipePitfall] = Field(default_factory=list, max_length=20)
    governing_rules: list[TrimmedStr] = Field(default_factory=list, max_length=50)
    revises_recipe_id: TrimmedStr | None = Field(default=None, max_length=200)
    steps: list[RecipeStep] = Field(default_factory=list, max_length=20)
    touched_files: list[RecipeTouchedFile] = Field(default_factory=list, max_length=30)
    contributing_slices: list[RecipeSlice] = Field(min_length=1, max_length=20)
    rationale: TrimmedStr = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def ordered_steps(self) -> RecipeCandidate:
        orders = [step.order for step in self.steps]
        if orders != list(range(1, len(orders) + 1)):
            raise ValueError("steps must use consecutive order values starting at 1")
        return self


class RecipeDraft(BaseModel):
    recipes: list[RecipeCandidate] = Field(default_factory=list, max_length=MAX_RECIPE_CANDIDATES)


class EvidenceRecord(BaseModel):
    """도구가 실제로 돌려준 결과이며 근거 장부는 이것만 인용을 허가한다."""

    tool: RecipeToolName
    args: dict[str, Any]
    content: str
    parsed: Any = None


class ProvenanceCatalog(BaseModel):
    eventIdsByTask: dict[str, set[str]] = Field(default_factory=dict)
    turnIdsByTask: dict[str, set[str]] = Field(default_factory=dict)
    ruleIds: set[str] = Field(default_factory=set)
    recipeIds: set[str] = Field(default_factory=set)


class RecipeScanState(TypedDict):
    plan: DispatchPlan | None
    reports: list[ProbeReport]
    task_id: str
    language: Language
    user_prompt: str | None
    # 근거는 프롬프트에 다시 붙이지 않고 대화 이력에 그대로 남아 캐시된다.
    messages: list[BaseMessage]
    provenance: ProvenanceCatalog
    model_cost_usd: float
    candidates: list[RecipeCandidate]
    validation_errors: list[str]
    repair_attempted: bool
    result: dict[str, object] | None
