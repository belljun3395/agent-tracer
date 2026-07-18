"""title-suggestion 구조화 체인이 사용하는 프롬프트."""

from __future__ import annotations

from ..shared.models import Language
from .models import TitleSuggestionContext

PROMPT_VERSION = "title-suggestion-native-v4"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Mirror the language of the current title and the user's messages.",
    "ko": "Write every title and rationale in Korean. Translate names and keywords as needed.",
    "en": "Write every title and rationale in English. Translate non-English source prose, never echo it.",
    "ja": "Write every title and rationale in Japanese. Translate names and keywords as needed.",
    "zh": "Write every title and rationale in Simplified Chinese. Translate names and keywords as needed.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You propose better titles for one recorded coding-agent task.
Prompt version: {PROMPT_VERSION}.

The user message carries the task's current title and an excerpt of its conversation turns (what the user
asked, what the agent reported back): the oldest user turn plus the most recent turns. Turns in the middle
are dropped when the task is long, and the excerpt says so when that happened.

When the excerpt is enough to name the work, name it without calling any tool. When it is empty, ambiguous,
truncated, or omits load-bearing work, call get_task_events to read the raw event sequence: you choose limit
and cursor, and order="desc" reads the ending of a long task first. Every turn tells you how many tool
rounds remain; stop pulling as soon as you can name the work.

If the current title is already concrete, accurate, and readable, return an empty list: that is a real
answer, not a failure. Otherwise return exactly 2-3 distinct alternatives. Each title must be concrete,
under 80 characters, and normally 4-9 words in languages where words are space-delimited. Prefer an
imperative or noun phrase that names the area and action, as in "Fix auth middleware token leak" or
"Migrate billing schema to v2". Never use placeholder titles such as "Task 123", "Untitled", or "Test".
Do not repeat the current title or another suggestion. Each rationale is one evidence-grounded sentence
under 200 characters. Do not invent work the evidence does not show.
"""

REPAIR_DIRECTIVE = """Deterministic validation rejected your output:
{errors}

Change only what is necessary to satisfy these errors. Return either an empty list or 2-3 distinct
alternatives. Do not repeat the current title, use placeholders, or invent unsupported work.
"""


def build_user_prompt(task_id: str, context: TitleSuggestionContext, language: Language) -> str:
    """이름 붙일 대상 태스크와 대화 발췌와 출력 언어를 담은 최초 지시문이다."""
    lines = [
        f"Task ID: {task_id}",
        f"Current title: {context.title}",
        f"Status: {context.status}",
    ]
    if context.workspacePath is not None:
        lines.append(f"Workspace: {context.workspacePath}")
    lines.append(f"Output language: {LANGUAGE_DIRECTIVES[language]}")
    lines.append("")
    lines.append(
        f"Activity: {context.totalEventCount} events across {context.totalTurnCount} conversation turns."
    )
    if context.truncated:
        lines.append(
            f"Showing the first turn and the most recent {len(context.turns) - 1} turns "
            "(older turns omitted)."
        )
    lines.append("")
    if not context.turns:
        lines.append("(no conversation turns recorded)")
    else:
        for turn in context.turns:
            lines.append(f"User: {turn.askedText}")
            if turn.assistantText is not None:
                lines.append(f"Assistant: {turn.assistantText}")
            lines.append("")
    lines.append(
        "If the current title already reads cleanly, return an empty suggestions list. "
        "Otherwise propose 2-3 alternative titles."
    )
    return "\n".join(lines)
