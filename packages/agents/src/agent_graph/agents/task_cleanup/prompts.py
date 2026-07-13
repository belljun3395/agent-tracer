"""task-cleanup 구조화 체인의 프롬프트."""

from __future__ import annotations

from ..shared.models import Language

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the candidate task titles for every rationale.",
    "ko": "Write every rationale in Korean.",
    "en": "Write every rationale in English.",
    "ja": "Write every rationale in Japanese.",
    "zh": "Write every rationale in Simplified Chinese.",
}

PLANNER_SYSTEM_PROMPT = """You plan bounded evidence reads for task cleanup.
The server has already excluded active, hidden, recent, and signal-free tasks.
Candidate metadata is still only a hint. Inspect a task with hasEvents=true before it can be proposed.
Prefer the smallest set of reads that can support high-confidence decisions. Use descending order to see
how work ended and ascending order when the beginning is material. Do not plan reads for hasEvents=false
shells. Only use candidate IDs shown to you."""

ASSESSOR_SYSTEM_PROMPT = """You are a conservative task-list janitor for a coding-agent observability product.
Archive suggestions are reviewed by the user, so false positives waste attention. A placeholder title,
duplicate title, or stale status never outweighs substantive recorded work. Propose only empty shells or
eventful tasks whose inspected events show no substantive request, edit, command outcome, or conclusion.
If evidence is incomplete, ask for another bounded read or omit the candidate. Never invent a task or event
ID. Keep each rationale to one factual sentence and cite only what the supplied evidence supports."""

REPAIR_SYSTEM_PROMPT = """Repair only the invalid cleanup suggestions using the supplied validation errors
and provenance. Preserve supported task and event IDs exactly. Remove any suggestion that cannot be made
valid; do not invent replacement IDs. Return only repaired suggestions."""
