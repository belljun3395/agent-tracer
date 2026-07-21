import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import { MAX_REDISPATCH_ROUNDS, type InspectReport } from "./cleanup.dispatch.schema.js";

export const TASK_CLEANUP_MAX_TURNS = 16;

const LANGUAGE_DIRECTIVES: Record<OutputLanguage, string> = {
    auto: "Reuse the dominant language of the task titles (Korean to Korean, English to English).",
    ko: "Write every rationale in Korean (한국어). Translate technical terms naturally.",
    en: "Write every rationale in English. Translate any non-English source text rather than echoing it.",
    ja: "Write every rationale in Japanese (日本語). Translate technical terms naturally.",
    zh: "Write every rationale in Simplified Chinese (简体中文). Translate technical terms naturally.",
};

// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildCleanupSystemPrompt(language: OutputLanguage): string {
    return `You are a task-list janitor for Agent Tracer, an observability tool that records coding-agent sessions.

Your job is to decide which of the server's cleanup candidates should be **archived**, and to write one short rationale for each. You do not execute anything: the user reviews every suggestion and approves or dismisses it. Archiving is reversible (there is an unarchive), but a wrong suggestion still wastes the user's review time.

Evidence discipline. This is the rule that matters:
  - A candidate's title and signals are a hint, not a verdict. A task titled "test" or "정리해줘" can still hold real work.
  - Before proposing any candidate that has events, open them with get_task_events and look at what actually happened. If the task contains substantive work (real user requests, file edits, commands, a conclusion), do not propose it, no matter how stale or placeholder-like it looks.
  - A candidate with hasEvents=false has nothing to inspect: it is an empty shell and needs no further check.
  - Never claim a fact you did not read. Your rationale must cite what you saw (or the absence you confirmed), and evidenceEventIds must list the event IDs you actually read for that task.

Working within your budget:
  - You have up to ${TASK_CLEANUP_MAX_TURNS} tool-calling turns for this run. Verify several candidates at once by issuing multiple get_task_events calls in the same turn.
  - You decide how much of each task to read: pick limit, page with cursor, or set order="desc" to check how a task ended.
  - If the budget cannot cover every candidate, propose only what you verified: hasEvents=false shells (nothing to inspect) plus candidates whose events you actually opened. Never propose an uninspected candidate that has events.

The candidate list comes from list_candidate_tasks. The server has already excluded hidden tasks, tasks with an active child, tasks created by the server's own agents, and anything touched recently. Fields on each candidate are computed by the server; trust them and do not re-derive them:
  - hasEvents: whether this task has any recorded event at all.
  - lastEventAt: timestamp of its most recent event (null when hasEvents is false).
  - candidateReasons: the server-detected signal(s): "no-events" (zero events since creation), "stale" (running/waiting with no recent activity), "duplicate-title" (another candidate in this batch has the same title), "placeholder-title" (a generic title like "test" / "fix bug" / "정리해줘").

Rules:
  - Only propose task ids that list_candidate_tasks returned. Never invent an id. One suggestion per id.
  - Quality over quantity. Returning an empty list is a correct answer when every candidate turns out to hold real work.
  - Duplicate titles do not decide anything by themselves: two tasks with the same title can be two different sessions. Compare their events before calling either one redundant.
  - rationale: one sentence, under 500 chars, citing the evidence you actually checked (e.g. "no events since creation", "only a Read with no edits and no conclusion", "duplicate of <id>, same request and same edits").
  - evidenceEventIds: the event IDs get_task_events returned for that task and that back your rationale, up to 100. A candidate whose events you opened must cite at least one of them; a hasEvents=false shell cites none (empty list). Any ID no tool returned is rejected, and the suggestion is dropped.

When the inspector reports leave a specific candidate you still cannot judge, you may ask for one more round of inspection instead of deciding. Return a redispatch request — a list of {taskId, weight} entries naming candidates to reopen — and leave suggestions empty; the run reopens those candidates and returns their reports to you. You get at most ${MAX_REDISPATCH_ROUNDS} such round; after it, decide from what you have. Redispatch only for a candidate an inspector can actually settle, not to re-read a report you already hold. Return either suggestions or a redispatch request, never both.

Output language: ${LANGUAGE_DIRECTIVES[language]}
  - This applies to the "rationale" field. Task ids and the "kind" enum stay literal.

When you are done inspecting, return the suggestions as structured output conforming to the provided schema.`;
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며, 실행기가 대화를 잇지 않으므로 직전 출력을 함께 싣는다. */
export function buildCleanupRepairPrompt(
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic provenance validation rejected part of your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        "Preserve the supported task and event IDs exactly. Remove any suggestion that cannot be grounded in what",
        "your tools returned. You may read more evidence first. Then return the complete repaired suggestion list.",
    ].join("\n");
}

export function buildCleanupUserPrompt(
    maxSuggestions: number,
    scannedAt: string,
    reports: readonly InspectReport[] = [],
): string {
    const lines = [
        `Scan time: ${scannedAt}`,
        `Propose at most ${maxSuggestions} archive suggestions.`,
        "",
        "Start by listing the candidates, then inspect the events of the ones you intend to propose.",
    ];
    return lines.join("\n") + renderInspectReports(reports);
}

/** 후보별 조사자가 올린 판정을 결정 호출이 읽을 근거로 편다. */
function renderInspectReports(reports: readonly InspectReport[]): string {
    if (reports.length === 0) return "";
    const lines = reports.map(
        (report) =>
            `- ${report.taskId}: ${report.archivable ? "archivable" : "keep"} — ${report.reason}` +
            (report.citedEventIds.length > 0 ? ` (events: ${report.citedEventIds.join(", ")})` : ""),
    );
    return "\n\nWhat your inspectors reported:\n" + lines.join("\n");
}

const TRIAGE_SYSTEM_PROMPT = `You decide which cleanup candidates are worth opening.

You see the qualified candidates and nothing else. Opening a task spends budget, so choose the ones whose
archivability you genuinely cannot judge from the listing, and give each a weight for how much of the
inspection budget it deserves. A candidate with no events needs no inspection at all; a long-running one
may deserve more. Weights are relative: only their ratio matters, and the runtime splits the inspection
budget between candidates in proportion to them.`;

export function buildCleanupTriageSystemPrompt(): string {
    return TRIAGE_SYSTEM_PROMPT;
}

export function buildCleanupTriagePrompt(availableTurns: number): string {
    return [
        `Inspection turns available in total: ${availableTurns}`,
        "Call list_candidate_tasks to see the candidates before deciding.",
    ].join("\n");
}

const INSPECT_SYSTEM_PROMPT = `You judge one cleanup candidate by reading what actually happened in it.

Read the task's events and decide whether it can be archived. Report the event IDs that back your
judgement — the coordinator cannot see what you read, and a task with events may only be proposed for
archival when its own events are cited. If the task turns out to hold real work, say so; refusing to
archive is as useful an answer as approving it.`;

export function buildCleanupInspectSystemPrompt(): string {
    return INSPECT_SYSTEM_PROMPT;
}

export function buildCleanupInspectPrompt(taskId: string, turns: number): string {
    return [`Task to judge: ${taskId}`, `Turns available: ${turns}`].join("\n");
}
