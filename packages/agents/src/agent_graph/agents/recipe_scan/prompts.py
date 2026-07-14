"""recipe-scan 도구 루프가 사용하는 프롬프트.

프롬프트 버전은 실행 궤적과 평가 코퍼스에서 의미 변화의 경계를 식별하는 값이다.
"""

from __future__ import annotations

from ..shared.models import Language
from .models import MAX_RECIPE_CANDIDATES

PROMPT_VERSION = "recipe-scan-native-v3"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the anchor task.",
    "ko": "Write prose in Korean. Keep identifiers, paths, commands, and event IDs verbatim.",
    "en": "Write prose in English. Keep identifiers, paths, commands, and event IDs verbatim.",
    "ja": "Write prose in Japanese. Keep identifiers, paths, commands, and event IDs verbatim.",
    "zh": "Write prose in Simplified Chinese. Keep identifiers, paths, commands, and event IDs verbatim.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You mine one coding-agent task for reusable "recipes".
Prompt version: {PROMPT_VERSION}.

A recipe preserves one distinct user request, the successful workflow the trajectory established for it,
and load-bearing friction. It is a reusable pattern, not a transcript. Include only work the evidence
shows was carried out and verified.

You have data tools. Nothing is pre-loaded for you: read what you need, and keep reading while the
evidence is thin. Every listing tool reports truncated/total/nextCursor, so pull more when they say more
exists. A sensible route is to understand the anchor first (summary, applicable rules, its events), then
chase friction (search_events for user corrections), then look wider (find_similar_tasks, search_recipes)
before claiming a revision target. Deviate whenever the evidence points elsewhere.

A turnId marks one user request and everything the agent did to serve it. Split the task by turnId when
its turns pursue unrelated goals, and write one candidate per goal, up to {MAX_RECIPE_CANDIDATES}. Merge
adjacent turns only when they carry one intent forward, and never claim the same turn in two candidates.

Every ID you cite (taskIds, turnIds, eventIds, rule IDs, revises_recipe_id) is checked against what your
tools actually returned in this run. IDs no tool returned are rejected, so never guess them. Only
get_task_events reports turnId.

When the evidence is enough, stop calling tools and emit the structured output. Return zero recipes if
no reusable pattern is grounded in the evidence; empty output is an acceptable answer. Use a short
imperative title, a trigger-like description, a 4-15 line Markdown summary, and ordered high-level steps.
Never claim that revises_recipe_id overwrites an existing recipe.
"""

REPAIR_DIRECTIVE = """Deterministic provenance validation rejected your output:
{errors}

Change only what is necessary to satisfy these errors, using only identifiers your tools returned.
If a correction, pitfall, rule, or revision target cannot be grounded, remove it. You may call tools
again to ground a citation. Then return the complete repaired candidate list.
"""


def build_user_prompt(task_id: str, user_prompt: str | None, language: Language) -> str:
    """앵커 태스크와 사용자 지시와 출력 언어를 담은 최초 지시문이다."""
    lines = [f"Anchor taskId: {task_id}"]
    if user_prompt:
        lines.append(f"User direction: {user_prompt}")
    lines.append(f"Output language: {LANGUAGE_DIRECTIVES[language]}")
    lines.append(f"Mine this task for up to {MAX_RECIPE_CANDIDATES} recipe candidates.")
    return "\n".join(lines)
