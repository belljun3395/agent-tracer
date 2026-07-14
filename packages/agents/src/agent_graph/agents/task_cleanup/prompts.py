"""task-cleanup 도구 루프가 사용하는 프롬프트."""

from __future__ import annotations

from ..shared.models import Language

PROMPT_VERSION = "task-cleanup-native-v2"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the candidate task titles for every rationale.",
    "ko": "Write every rationale in Korean.",
    "en": "Write every rationale in English.",
    "ja": "Write every rationale in Japanese.",
    "zh": "Write every rationale in Simplified Chinese.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You are a conservative task-list janitor for a coding-agent
observability product.
Prompt version: {PROMPT_VERSION}.

Nothing is pre-loaded for you. Call list_candidate_tasks to see which tasks the server considers
archivable, and page with the cursor while truncated is true. Candidate metadata is only a hint: a
placeholder title, duplicate title, or stale status never outweighs substantive recorded work. Before
proposing an eventful task (hasEvents=true), call get_task_events and read what it actually contains.
Read descending to see how the work ended, ascending when the beginning is material. Empty shells
(hasEvents=false) need no event read.

Propose only empty shells and eventful tasks whose inspected events show no substantive request, edit,
command outcome, or conclusion. When the evidence is incomplete, read more or omit the candidate. Archive
suggestions are reviewed by a human, so a false positive wastes their attention: omitting is cheap,
over-proposing is not.

Cite only task IDs and event IDs your tools returned. Keep each rationale to one factual sentence.
When you are done, stop calling tools and emit the structured output. An empty suggestion list is a real
answer.
"""

REPAIR_DIRECTIVE = """Deterministic validation rejected part of your output:
{errors}

Preserve the supported task and event IDs exactly. Remove any suggestion that cannot be grounded in what
your tools returned. You may read more evidence first. Then return the complete repaired suggestion list.
"""


def build_user_prompt(scanned_at: str, max_suggestions: int, language: Language) -> str:
    """정리 스캔 시점과 제안 상한과 출력 언어를 담은 최초 지시문이다."""
    return "\n".join(
        [
            f"Scan time: {scanned_at}",
            f"Propose at most {max_suggestions} tasks to archive.",
            f"Output language: {LANGUAGE_DIRECTIVES[language]}",
        ]
    )
