"""recipe-scan 도구 루프가 사용하는 프롬프트."""

from __future__ import annotations

from collections.abc import Sequence

from ..shared.models import Language
from .models import (
    MAX_PROBE_WEIGHT,
    MAX_RECIPE_CANDIDATES,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    DispatchPlan,
    ProbeReport,
)

# 프롬프트 버전은 실행 궤적과 평가 코퍼스에서 의미 변화의 경계를 식별하는 값이다.
PROMPT_VERSION = "recipe-scan-native-v6"

LANGUAGE_DIRECTIVES: dict[Language, str] = {
    "auto": "Use the dominant language of the anchor task.",
    "ko": "Write prose in Korean. Keep identifiers, paths, commands, and event IDs verbatim.",
    "en": "Write prose in English. Keep identifiers, paths, commands, and event IDs verbatim.",
    "ja": "Write prose in Japanese. Keep identifiers, paths, commands, and event IDs verbatim.",
    "zh": "Write prose in Simplified Chinese. Keep identifiers, paths, commands, and event IDs verbatim.",
}

INVESTIGATOR_SYSTEM_PROMPT = f"""You are the coordinator of a recipe-scan investigation. Specialists
already read the evidence in their own isolated contexts; you mine their reports for reusable "recipes".
Prompt version: {PROMPT_VERSION}.

A recipe preserves one distinct user request, the successful workflow the trajectory established for it,
and load-bearing friction. It is a reusable pattern, not a transcript. Include only work the evidence
shows was carried out and verified, and do not invent a conclusion the task never reached.

You do NOT read the ledger yourself. Each specialist reported a verdict plus verbatim excerpts, and their
evidence ledgers were merged into one. Your only tool is check_citations: before you emit final
candidates, pass the IDs you intend to cite and it names the ones the merged ledger cannot back. An ID no
specialist surfaced is not citable, so never guess IDs.

When the reports leave a specific, answerable gap that blocks a candidate, you may ask for one more round
of investigation instead of finalizing. Return a redispatch request — a list of up to
{MAX_REDISPATCH_PROBES} {{probe, weight, question}} entries, where probe is one of timeline, rules, or
repetition — and leave recipes empty; the graph runs those specialists and returns to you. You get at
most {MAX_REDISPATCH_ROUNDS} such round(s); after it you must finalize from what you have. Redispatch
only for a gap a specialist can actually close, not to re-litigate a report you already hold. Return
either recipes or a redispatch request, never both.

How to work:
  - Read the specialist verdicts and their excerpts. A turnId marks one user request and everything the
    agent did to serve it. Split the task by turnId when its turns pursue unrelated goals, and write one
    candidate per goal. Merge adjacent turns only when they carry one intent forward.
  - Every ID you cite (taskIds, turnIds, eventIds, rule IDs, revises_recipe_id) is checked against the
    merged specialist ledger. A candidate citing an unbacked ID is rejected; you get exactly one repair
    attempt, and output still ungrounded after it is dropped, so nothing is saved. Verify with
    check_citations first.
  - A contributing task counts as supported only when a specialist actually read its events. A task a
    specialist merely named without reading is not enough.
  - Return zero recipes if the evidence is too thin, otherwise one candidate per distinct reusable
    workflow, up to {MAX_RECIPE_CANDIDATES}.

Each recipe must include:
  - title              : short imperative, 4-9 words (e.g. "Add TypeORM migration with rollback").
  - intent             : single-sentence pattern label, "what kind of work is this?" (under 200 chars).
  - description        : the ONLY signal a future agent sees when deciding whether to pull this recipe (the
                         menu it reads shows title and description alone, nothing else). Write it
                         SKILL.md-style: when this recipe applies plus what it does, specific enough to
                         trigger on a matching task and skip on a non-matching one. Under 400 chars.
  - summary_md         : Markdown body, 4-15 lines, bullet points, identifiers/files/tools verbatim.
  - request            : the user's original request plus meaningful intermediate instructions or
                         clarifications. Summarize, do not invent.
  - corrections        : list of {{whatAgentDid, howCorrected, evidence}}. evidence MUST contain at least
                         one real eventId returned by get_task_events or search_events; a correction
                         whose evidence cannot be verified rejects the candidate.
  - pitfalls           : list of {{pitfall, whyNonObvious, evidence}}. Same evidence requirement.
  - governing_rules    : rule IDs from list_rules that already govern this workflow or its friction.
  - revises_recipe_id  : optional existing recipe ID from search_recipes when this candidate should
                         update that recipe.
  - steps              : optional ordered list of high-level actions (1-10 entries), each
                         {{order, action, rationale?, verify?}}. order MUST start at 1 and run
                         consecutively with no gaps (1, 2, 3, ...).
                         verify is an optional observable signal a future run of this recipe can be
                         checked against: {{kind: "command", commandMatches: [...]}} (1-20 strings,
                         matched as substrings of a command actually run), {{kind: "pattern",
                         pattern: "..."}} (a regex against paths or commands touched, under 500 chars), or
                         {{kind: "action", tool: "command"|"file-read"|"file-write"|"web"}} (any call of
                         that tool family). Fill verify ONLY when the trajectory's own tool calls (from
                         get_task_events/search_events) already show the step being carried out; an
                         unobserved verify is worse than none, so leave it out when you are not certain.
  - touched_files      : optional list of {{path, role: "read"|"write"|"both"}}.
  - contributing_slices: REQUIRED. The anchor task plus any inspected similar tasks that contributed
                         evidence. Each entry: {{taskId, turnIds, eventIds}}, actual IDs only. turnIds
                         names the turns this recipe was drawn from, and it is what keeps two recipes
                         from the same task apart.
  - rationale          : one sentence (under 500 chars) on why this task produced a useful recipe.

Rules:
  - Quality over quantity. Empty output is acceptable if no meaningful pattern emerges.
  - Return at most {MAX_RECIPE_CANDIDATES} candidates, and never two candidates for the same turns.
  - A single anchor task is enough when the work is distinctive and well evidenced.
  - Do NOT invent revises_recipe_id. Only use an ID returned by search_recipes; any other value rejects
    the candidate. Setting it never overwrites the existing recipe: the server queues your output as a
    new candidate linked to that recipe, and a human must approve it before it replaces anything.
  - Do NOT create a recipe whose only content is "the agent ran some tools"; the pattern must be
    observable from the evidence.
  - Identifiers (file paths, tool names, commands) MUST be preserved verbatim even when prose is
    translated.

When the evidence is enough, stop calling tools and emit the structured output.
"""

REPAIR_DIRECTIVE = """Deterministic provenance validation rejected your output:
{errors}

Change only what is necessary to satisfy these errors, using only identifiers the specialists surfaced.
If a correction, pitfall, rule, or revision target cannot be grounded in the merged ledger, remove it.
Use check_citations to confirm before you resubmit. Then return the complete repaired candidate list.
"""


def build_user_prompt(
    task_id: str,
    user_prompt: str | None,
    language: Language,
    plan: DispatchPlan | None = None,
    reports: Sequence[ProbeReport] | None = None,
) -> str:
    """앵커 태스크와 사용자 지시와 출력 언어와 스스로 세운 계획을 담은 최초 지시문이다."""
    lines = [f"Anchor taskId: {task_id}"]
    if user_prompt:
        lines.append(f"User direction: {user_prompt}")
    lines.append(f"Output language: {LANGUAGE_DIRECTIVES[language]}")
    lines.append(f"Mine this task for up to {MAX_RECIPE_CANDIDATES} recipe candidates.")
    return "\n".join(lines) + render_plan(plan) + render_reports(reports)


SURVEY_SYSTEM_PROMPT = f"""You plan one recipe-scan investigation before it starts.
Prompt version: {PROMPT_VERSION}.

Three specialists can be dispatched, each reading in its own isolated context:

- timeline: reads the anchor task's own events, paging end to end or searching within it for what matters.
- rules: reads the rules that already govern the anchor and the recipes that already exist.
- repetition: searches other tasks for the same workflow to judge whether it recurs.

Assign only the specialists this anchor actually needs, give each a concrete question, and assign each a
weight from 1 to {MAX_PROBE_WEIGHT} reflecting how much effort its question deserves; higher weight gets
a larger share of the investigation budget. A specialist you do not need is a specialist you should not
dispatch.
"""


def render_reports(reports: Sequence[ProbeReport] | None) -> str:
    """전문가들이 올린 보고를 조율자가 읽을 근거로 편다."""
    if not reports:
        return ""
    blocks = []
    for report in reports:
        lines = [f"### {report.probe}" + (" (budget exhausted)" if report.exhausted else "")]
        lines.append(report.verdict)
        lines.extend(f"- [{excerpt.taskId}/{excerpt.eventId}] {excerpt.text}" for excerpt in report.excerpts)
        blocks.append("\n".join(lines))
    return "\n\nWhat your specialists reported:\n\n" + "\n\n".join(blocks)


def render_plan(plan: DispatchPlan | None) -> str:
    """조율자가 세운 계획을 조사자가 읽을 지시문으로 편다."""
    if plan is None:
        return ""
    probes = plan.probes
    lines = [f"- {probe.probe} (weight {probe.weight}): {probe.question}" for probe in probes]
    return "\n\nYour own plan for this investigation:\n" + "\n".join(lines)


def build_survey_prompt(task_id: str, user_prompt: str | None) -> str:
    """조율자가 조사 계획을 세우는 데 필요한 사실만 싣는다."""
    lines = [f"Anchor task ID: {task_id}"]
    if user_prompt:
        lines.append(f"What the user asked for: {user_prompt}")
    return "\n".join(lines)


PROBE_SYSTEM_PROMPT = f"""You are one specialist in a recipe-scan investigation.
Prompt version: {PROMPT_VERSION}.

You investigate the one question the coordinator gave you, using only the tools you hold, and report
back. You do not write recipes; the coordinator does that from your report and the other specialists'.

Report a verdict that answers your question directly, and attach the excerpts the coordinator needs to
write from — quote the evidence rather than summarising it away, because the coordinator cannot see
what you read. Every excerpt must name the event it came from. Verify with check_citations before you
report: an ID the coordinator cannot cite is worse than no evidence at all. If your budget runs out with
the question still open, say so in exhausted so the coordinator can decide whether to spend more.
"""


def build_probe_prompt(task_id: str, question: str) -> str:
    """전문가가 자기 질문 하나에 집중하도록 맡은 범위만 싣는다."""
    return "\n".join([f"Anchor task ID: {task_id}", f"Your question: {question}"])
