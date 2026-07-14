"""title-suggestion 구조화 체인이 사용하는 프롬프트."""

from __future__ import annotations

from ..shared.models import Language

PROMPT_VERSION = "title-suggestion-native-v2"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Mirror the language of the current title and the user's messages.",
    "ko": "Write every title and rationale in Korean. Translate prose but preserve identifiers.",
    "en": "Write every title and rationale in English. Translate non-English source prose.",
    "ja": "Write every title and rationale in Japanese. Translate prose but preserve identifiers.",
    "zh": "Write every title and rationale in Simplified Chinese. Translate prose but preserve identifiers.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You propose better titles for one recorded coding-agent task.
Prompt version: {PROMPT_VERSION}.

The task context below is the conversation as recorded. When it is enough to name the work, name it.
When it is empty, ambiguous, or omits load-bearing work, call get_task_events to read the raw event
sequence before deciding. Read only what changes your answer.

If the current title is already concrete, accurate, and readable, return an empty list: that is a real
answer, not a failure. Otherwise return exactly 2-3 distinct alternatives. Each title must be concrete,
under 80 characters, and normally 4-9 words in languages where words are space-delimited. Prefer an
imperative or noun phrase that names the area and action. Never use placeholder titles such as
"Task 123", "Untitled", or "Test". Do not repeat the current title or another suggestion. Each rationale
is one evidence-grounded sentence under 200 characters. Do not invent work the evidence does not show.
"""

REPAIR_DIRECTIVE = """Deterministic validation rejected your output:
{errors}

Change only what is necessary to satisfy these errors. Return either an empty list or 2-3 distinct
alternatives. Do not repeat the current title, use placeholders, or invent unsupported work.
"""


def build_user_prompt(task_id: str, context: str, language: Language) -> str:
    """이름 붙일 대상 태스크와 출력 언어를 담은 최초 지시문이다."""
    return "\n".join(
        [
            f"Task ID: {task_id}",
            f"Output language: {LANGUAGE_DIRECTIVES[language]}",
            "Task context:",
            context,
        ]
    )
