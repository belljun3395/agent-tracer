"""recipe-scan의 내부 상태와 구조화 체인 계약."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared.models import AgentExecutionRequest, Language, ToolCallback, TrimmedStr

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


class EvidenceQuery(BaseModel):
    tool: RecipeToolName
    args: dict[str, Any]
    purpose: TrimmedStr = Field(min_length=1, max_length=300)


class EvidencePlan(BaseModel):
    rationale: TrimmedStr = Field(min_length=1, max_length=500)
    queries: list[EvidenceQuery] = Field(default_factory=list, max_length=4)


class EvidenceAssessment(BaseModel):
    sufficient: bool
    reason: TrimmedStr = Field(min_length=1, max_length=500)
    missingEvidence: list[TrimmedStr] = Field(default_factory=list, max_length=4)


class RecipeStep(BaseModel):
    order: int = Field(ge=1, le=50)
    action: TrimmedStr = Field(min_length=1, max_length=200)
    rationale: TrimmedStr | None = Field(default=None, max_length=300)


class RecipeTouchedFile(BaseModel):
    path: TrimmedStr = Field(min_length=1, max_length=500)
    role: Literal["read", "write", "both"]


class RecipeSlice(BaseModel):
    taskId: TrimmedStr = Field(min_length=1)
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
    recipe: RecipeCandidate


class EvidenceRecord(BaseModel):
    tool: RecipeToolName
    args: dict[str, Any]
    content: str
    parsed: Any = None
    purpose: str


class ProvenanceCatalog(BaseModel):
    taskIds: set[str] = Field(default_factory=set)
    eventIdsByTask: dict[str, set[str]] = Field(default_factory=dict)
    ruleIds: set[str] = Field(default_factory=set)
    recipeIds: set[str] = Field(default_factory=set)


class RecipeScanState(TypedDict):
    task_id: str
    language: Language
    user_prompt: str | None
    evidence: list[EvidenceRecord]
    provenance: ProvenanceCatalog
    plan: EvidencePlan | None
    assessment: EvidenceAssessment | None
    gather_rounds: int
    model_cost_usd: float
    candidate: RecipeCandidate | None
    validation_errors: list[str]
    repair_attempted: bool
    result: dict[str, object] | None
