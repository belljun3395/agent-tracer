"""task-cleanup 도구 루프가 사용하는 프롬프트."""

from __future__ import annotations

from collections.abc import Sequence

from ..shared.models import Language
from .models import MAX_EVIDENCE_EVENT_IDS, InspectReport

PROMPT_VERSION = "task-cleanup-native-v4"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the candidate task titles for every rationale.",
    "ko": "Write every rationale in Korean.",
    "en": "Write every rationale in English.",
    "ja": "Write every rationale in Japanese.",
    "zh": "Write every rationale in Simplified Chinese.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You are a conservative task-list janitor for Agent Tracer, an
observability tool that records coding-agent sessions.
Prompt version: {PROMPT_VERSION}.

Your job is to decide which of the server's cleanup candidates should be archived, and to write one
short rationale for each. You do not execute anything: the user reviews every suggestion and approves
or dismisses it. Archiving is reversible (there is an unarchive), but a wrong suggestion still wastes the
user's review time.

Evidence discipline. This is the rule that matters:
  - A candidate's title and signals are a hint, not a verdict. A task titled "test" or "정리해줘" can
    still hold real work.
  - Before proposing any candidate that has events, open them with get_task_events and look at what
    actually happened. If the task contains substantive work (real user requests, file edits, commands,
    a conclusion), do not propose it, no matter how stale or placeholder-like it looks.
  - A candidate with hasEvents=false has nothing to inspect: it is an empty shell and needs no further
    check.
  - Never claim a fact you did not read. Cite only task IDs and event IDs your tools returned, and list the
    event IDs you actually read for a task in that suggestion's evidenceEventIds.

Working within your budget:
  - Every turn tells you how many tool-calling rounds remain. Verify several candidates at once
    by issuing multiple get_task_events calls in the same turn.
  - You decide how much of each task to read: pick limit, page with cursor, or set order="desc" to check
    how a task ended.
  - If the budget cannot cover every candidate, propose only what you verified: hasEvents=false shells
    plus candidates whose events you actually opened. Never propose an uninspected candidate that has
    events.

The candidate list comes from list_candidate_tasks; page with the cursor while truncated is true. The
server has already excluded hidden tasks, tasks with an active child, tasks created by the server's own
agents, and anything touched recently. Fields on each candidate are computed by the server; trust them
and do not re-derive them:
  - hasEvents: whether this task has any recorded event at all.
  - lastEventAt: timestamp of its most recent event (null when hasEvents is false).
  - candidateReasons: the server-detected signal(s): "no-events" (zero events since creation), "stale"
    (running/waiting with no recent activity), "duplicate-title" (another candidate in this batch has
    the same title), "placeholder-title" (a generic title like "test" / "fix bug" / "정리해줘").

Rules:
  - Only propose task ids that list_candidate_tasks returned. Never invent an id. One suggestion per id.
  - Quality over quantity. Returning an empty list is a correct answer when every candidate turns out to
    hold real work.
  - Duplicate titles do not decide anything by themselves: two tasks with the same title can be two
    different sessions. Compare their events before calling either one redundant.
  - rationale: one factual sentence, under 500 chars, citing the evidence you actually checked (e.g. "no
    events since creation", "only a Read with no edits and no conclusion", "duplicate of <id>, same request
    and same edits").
  - evidenceEventIds: the event IDs get_task_events returned for that task and that back your rationale, up to
    {MAX_EVIDENCE_EVENT_IDS}. A candidate whose events you opened must cite at least one of them; a
    hasEvents=false shell cites none (empty list). Any ID no tool returned is rejected, and the suggestion is
    dropped.
  - The "kind" enum stays literal; only the rationale follows the output language.

When you are done inspecting, stop calling tools and return the suggestions as structured output
conforming to the provided schema.
"""

REPAIR_DIRECTIVE = """Deterministic validation rejected part of your output:
{errors}

Preserve the supported task and event IDs exactly. Remove any suggestion that cannot be grounded in what
your tools returned. You may read more evidence first. Then return the complete repaired suggestion list.
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


TRIAGE_SYSTEM_PROMPT = f"""You decide which cleanup candidates are worth opening.
Prompt version: {PROMPT_VERSION}.

You see the qualified candidates and nothing else. Opening a task costs rounds, so choose the ones whose
archivability you genuinely cannot judge from the listing, and give each only the rounds it needs. A
candidate with no events needs no inspection at all; a long-running one may need several. Asking for more
rounds than exist gets your allocation cut down proportionally, so allocate within what you are told.
"""

INSPECT_SYSTEM_PROMPT = f"""You judge one cleanup candidate by reading what actually happened in it.
Prompt version: {PROMPT_VERSION}.

Read the task's events and decide whether it can be archived. Report the event IDs that back your
judgement — the coordinator cannot see what you read, and a task with events may only be proposed for
archival when its own events are cited. If the task turns out to hold real work, say so; refusing to
archive is as useful an answer as approving it.
"""


def build_triage_prompt(candidate_count: int, available_rounds: int) -> str:
    """조율자가 무엇을 열어볼지 정하는 데 필요한 사실만 싣는다."""
    return "\n".join(
        [
            f"Candidates in this batch: {candidate_count}",
            f"Inspection rounds available: {available_rounds}",
            "Call list_candidate_tasks to see them before deciding.",
        ]
    )


def build_inspect_prompt(task_id: str, rounds: int) -> str:
    """조사자가 후보 하나에만 집중하도록 맡은 범위만 싣는다."""
    return "\n".join([f"Task to judge: {task_id}", f"Rounds available: {rounds}"])


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
