"""recipe-scan의 내부 상태와 구조화 체인 계약."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared.models import AgentExecutionRequest, Language, ToolCallback, TrimmedStr

# 한 태스크가 서로 다른 작업 turn을 담을 수 있어 스캔 한 번이 낼 수 있는 후보 수다.
MAX_RECIPE_CANDIDATES = 4

# 모델이 스스로 도구를 고르므로 라운드 수가 곧 조사 예산이며 커널의 골든 계약이 값을 소유한다.
MAX_TOOL_ROUNDS = 15

RecipeToolName = Literal[
    "get_task_summary",
    "get_task_events",
    "list_rules",
    "search_events",
    "find_similar_tasks",
    "search_recipes",
]


class RecipeScanRequest(AgentExecutionRequest):
    """Python-native recipe-scan의 도메인 실행 봉투."""

    model_config = ConfigDict(extra="forbid")

    deadlineMs: int = 720_000
    taskId: TrimmedStr = Field(min_length=1)
    language: Language = "auto"
    userPrompt: TrimmedStr | None = None
    toolCallback: ToolCallback


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
