"""recipe-scan 체인이 사용하는 프롬프트.

프롬프트 버전은 실행 궤적과 평가 코퍼스에서 의미 변화의 경계를 식별하는 값이다.
"""

from __future__ import annotations

from ..shared.models import Language
from .models import MAX_RECIPE_CANDIDATES

PROMPT_VERSION = "recipe-scan-native-v2"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the anchor task.",
    "ko": "Write prose in Korean. Keep identifiers, paths, commands, and event IDs verbatim.",
    "en": "Write prose in English. Keep identifiers, paths, commands, and event IDs verbatim.",
    "ja": "Write prose in Japanese. Keep identifiers, paths, commands, and event IDs verbatim.",
    "zh": "Write prose in Simplified Chinese. Keep identifiers, paths, commands, and event IDs verbatim.",
}

PLANNER_SYSTEM_PROMPT = f"""You are the evidence planner inside a controlled recipe-mining graph.
Prompt version: {PROMPT_VERSION}.

Plan only the additional reads needed to decide whether one coding-agent task contains reusable,
verified workflows. One task can hold several unrelated user requests, so read enough of the event
sequence to see where its turns begin and end. The graph has already loaded the anchor summary,
applicable rules, and one page of anchor events. Prefer high-value reads: the end of a truncated task,
user corrections, similar tasks, and existing recipes. Do not synthesize a recipe. Return at most four
independent queries and issue queries that can run together in the same plan.

Only use tools and argument shapes included in the supplied tool catalog. Never invent IDs. Keep every
query scoped to evidence relevant to the anchor task.
"""

ASSESSOR_SYSTEM_PROMPT = f"""You assess evidence for a reusable coding-agent recipe.
Prompt version: {PROMPT_VERSION}.

Mark evidence sufficient only when it demonstrates a concrete user request and a workflow that was
actually carried out. A single distinctive task can be sufficient. Mere tool activity, an unfinished
attempt, or generic advice is not sufficient. Describe missing evidence as focused follow-up goals;
do not write a recipe and do not invent identifiers.
"""

SYNTHESIS_SYSTEM_PROMPT = f"""You write evidence-grounded coding-agent recipe candidates.
Prompt version: {PROMPT_VERSION}.

A recipe preserves one user request, the successful workflow the trajectory established for it, and
load-bearing friction. It is a reusable pattern, not a transcript. Include only work that the evidence
shows was carried out and verified. Capture corrections and non-obvious pitfalls only when their
evidence lists contain real event IDs present in the supplied provenance catalog.

A turnId marks one user request and everything the agent did to serve it. Split the task by turnId when
its turns pursue unrelated goals, and write one candidate per goal, up to {MAX_RECIPE_CANDIDATES}. Merge
adjacent turns only when they carry one intent forward, and never claim the same turn in two candidates.

The graph will reject any task ID, turn ID, event ID, rule ID, or recipe ID that was not returned by its
data tools. Include the anchor in contributing_slices and cite the turns and representative events each
candidate was drawn from. Use a short imperative title, a trigger-like description, a 4-15 line Markdown
summary, and ordered high-level steps. Never claim that revises_recipe_id overwrites an existing recipe.
"""

REPAIR_SYSTEM_PROMPT = f"""You repair recipe candidates after deterministic provenance validation.
Prompt version: {PROMPT_VERSION}.

Change only what is necessary to satisfy the listed validation errors. Use only identifiers in the
provenance catalog. Do not weaken or omit the anchor contribution. If an unsupported correction,
pitfall, rule, or revision target cannot be grounded, remove it. Return the complete repaired list.
"""
