"""task-cleanup 도구 루프가 사용하는 프롬프트."""

from __future__ import annotations

from collections.abc import Sequence

from ..shared.models import Language
from .models import MAX_EVIDENCE_EVENT_IDS, MAX_INSPECT_WEIGHT, MAX_REDISPATCH_ROUNDS, InspectReport

PROMPT_VERSION = "task-cleanup-native-v4"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the candidate task titles for every rationale.",
    "ko": "Write every rationale in Korean.",
    "en": "Write every rationale in English.",
    "ja": "Write every rationale in Japanese.",
    "zh": "Write every rationale in Simplified Chinese.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You are the coordinator of a task-cleanup scan for Agent Tracer, an
observability tool that records coding-agent sessions.
Prompt version: {PROMPT_VERSION}.

Your job is to decide which cleanup candidates should be archived, and to write one short rationale for
each. You do not execute anything: the user reviews every suggestion and approves or dismisses it.
Archiving is reversible, but a wrong suggestion still wastes the user's review time.

You do NOT open tasks yourself. Reviewers already read each assigned candidate's events in their own
isolated contexts and reported a verdict (archivable or keep), a reason, and the event IDs that back it.
You write suggestions only from those reports; a candidate no reviewer reported on is not yours to
propose.

Evidence discipline:
  - Propose a candidate only when a reviewer reported it archivable. A reviewer that found substantive
    work (real user requests, file edits, commands, a conclusion) means keep the task, no matter how
    stale or placeholder-like the title looked.
  - A reviewer that opened a task and found no events reports it archivable with no cited events; that is
    an empty shell and needs no citation.
  - evidenceEventIds must be exactly the event IDs the reviewer cited for that task. Never invent an ID.

When a reviewer report is missing or too thin to judge a candidate you believe matters, you may ask for
one more round of review instead of finalizing. Return a redispatch request — a list of {{taskId, weight}}
entries naming candidates to (re)inspect — and leave suggestions empty; the graph runs those reviewers
and returns to you. You get at most {MAX_REDISPATCH_ROUNDS} such round(s); after it you must finalize
from what you have. Return either suggestions or a redispatch request, never both.

Rules:
  - One suggestion per task id, and only tasks a reviewer reported on. Never invent an id.
  - Quality over quantity. Returning an empty list is a correct answer when every reviewed candidate
    holds real work.
  - rationale: one factual sentence, under 500 chars, restating what the reviewer found (e.g. "no events
    since creation", "only a Read with no edits and no conclusion"). Up to {MAX_EVIDENCE_EVENT_IDS}
    evidenceEventIds.
  - The "kind" enum stays literal; only the rationale follows the output language.

Return the suggestions as structured output conforming to the provided schema.
"""

REPAIR_DIRECTIVE = """Deterministic validation rejected part of your output:
{errors}

Preserve the task and event IDs the reviewers cited. Remove any suggestion that cannot be grounded in a
reviewer report. Then return the complete repaired suggestion list.
"""


def build_user_prompt(
    scanned_at: str,
    max_suggestions: int,
    language: Language,
    reports: Sequence[InspectReport] | None = None,
) -> str:
    """정리 스캔 시점과 제안 상한과 출력 언어와 조사 결과를 담은 최초 지시문이다."""
    return "\n".join(
        [
            f"Scan time: {scanned_at}",
            f"Propose at most {max_suggestions} tasks to archive.",
            f"Output language: {LANGUAGE_DIRECTIVES[language]}",
        ]
    ) + render_reports(reports)


TRIAGE_SYSTEM_PROMPT = f"""You open the cleanup scan by choosing which candidates to hand to reviewers.
Prompt version: {PROMPT_VERSION}.

You see the qualified candidates and nothing else. A candidate is proposed for archival only if a
reviewer reports on it, so assign every candidate you believe may be archivable — a reviewer confirms or
rejects each one. For each candidate, assign a weight from 1 to {MAX_INSPECT_WEIGHT} reflecting how much
scrutiny it deserves: give a long-running one a higher weight and a no-events shell just 1, since its
reviewer only has to confirm the shell is empty. Weight sets each reviewer's share of the review budget;
weights are relative to each other, not a count you can run out of or ask more of than exists. Do not
assign candidates that clearly hold real work; assigning nothing ends the scan with no suggestions.
Candidates you leave unassigned are picked up by a future scan.
"""

INSPECT_SYSTEM_PROMPT = f"""You judge one cleanup candidate by reading what actually happened in it.
Prompt version: {PROMPT_VERSION}.

Read the task's events and decide whether it can be archived. Report the event IDs that back your
judgement — the coordinator cannot see what you read, and a task with events may only be proposed for
archival when its own events are cited. If the task turns out to hold real work, say so; refusing to
archive is as useful an answer as approving it.
"""


def build_triage_prompt(candidate_count: int) -> str:
    """조율자가 무엇을 열어볼지 정하는 데 필요한 사실만 싣는다."""
    return "\n".join(
        [
            f"Candidates in this batch: {candidate_count}",
            "Call list_candidate_tasks to see them before deciding.",
        ]
    )


def build_inspect_prompt(task_id: str) -> str:
    """조사자가 후보 하나에만 집중하도록 맡은 범위만 싣는다."""
    return f"Task to judge: {task_id}"


def render_reports(reports: Sequence[InspectReport] | None) -> str:
    """후보별 조사 결과를 조율자가 읽을 근거로 편다."""
    if not reports:
        return ""
    lines = [
        f"- {report.taskId}: {'archivable' if report.archivable else 'keep'} — {report.reason}"
        + (f" (events: {', '.join(report.citedEventIds)})" if report.citedEventIds else "")
        for report in reports
    ]
    return "\n\nWhat the cleanup candidate reviewers reported:\n" + "\n".join(lines)
