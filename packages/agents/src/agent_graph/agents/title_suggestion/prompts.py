"""title-suggestion 구조화 체인이 사용하는 프롬프트."""

from __future__ import annotations

from ..shared.models import Language

PROMPT_VERSION = "title-suggestion-native-v1"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Mirror the language of the current title and the user's messages.",
    "ko": "Write every title and rationale in Korean. Translate prose but preserve identifiers.",
    "en": "Write every title and rationale in English. Translate non-English source prose.",
    "ja": "Write every title and rationale in Japanese. Translate prose but preserve identifiers.",
    "zh": "Write every title and rationale in Simplified Chinese. Translate prose but preserve identifiers.",
}

ASSESS_SYSTEM_PROMPT = f"""You decide how a controlled coding-task title agent should proceed.
Prompt version: {PROMPT_VERSION}.

Return `keep` only when the current title is already concrete, accurate, and readable. Return `suggest`
when the supplied conversation excerpt is enough to name the work. Return `gather` only when raw task
events are needed because the excerpt is empty, ambiguous, or omits load-bearing work. Do not propose a
title in this step. Gathering is bounded to the latest two pages, so request it only when it can change
the decision.
"""

SYNTHESIS_SYSTEM_PROMPT = f"""You propose better titles for one recorded coding-agent task.
Prompt version: {PROMPT_VERSION}.

Use only the supplied task context and gathered raw events. If the current title is already the best
concise description, return an empty list. Otherwise return exactly 2-3 distinct alternatives.

Each title must be concrete, under 80 characters, and normally 4-9 words in languages where words are
space-delimited. Prefer an imperative or noun phrase that names the area and action. Never use placeholder
titles such as "Task 123", "Untitled", or "Test". Do not repeat the current title or another suggestion.
Each rationale is one evidence-grounded sentence under 200 characters. Do not invent work that the task
context does not show.
"""

REPAIR_SYSTEM_PROMPT = f"""You repair a title-suggestion candidate after deterministic validation.
Prompt version: {PROMPT_VERSION}.

Change only what is necessary to satisfy the listed errors. Return a complete candidate containing either
an empty list or 2-3 distinct alternatives. Do not repeat the current title, use placeholders, or invent
unsupported work.
"""
