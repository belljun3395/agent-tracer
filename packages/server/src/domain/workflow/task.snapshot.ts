import type { TimelineEvent } from "../monitoring/timeline.event.js";
import {
    isAssistantResponseEvent,
    isCoordinationLane,
    isFileChangedEvent,
    isImplementationLane,
    isInstructionsLoadedEvent,
    isPlanningLane,
    isQuestionLoggedEvent,
    isRuleOrVerificationEvent,
    isTaskLifecycleEvent,
    isTodoLoggedEvent,
} from "../monitoring/event.predicates.js";
import { KIND } from "../monitoring/event.kind.js";
import type { ReusableTaskSnapshot } from "./task.snapshot.model.js";
import type { WorkflowEvaluationData } from "./task.evaluation.js";
export type * from "./task.snapshot.model.js";
export interface BuildReusableTaskSnapshotInput {
    readonly objective: string;
    readonly events: readonly TimelineEvent[];
    readonly evaluation?: Partial<WorkflowEvaluationData> | null;
}

/**
 * Distills a raw event timeline into the reusable snapshot stored with evaluations and previews.
 */
export function buildReusableTaskSnapshot({ objective, events, evaluation }: BuildReusableTaskSnapshotInput): ReusableTaskSnapshot {
    const modifiedFiles = collectModifiedFiles(events);
    const keyFiles = collectKeyFiles(events, modifiedFiles);
    const { summary: verificationSummary, failures } = collectVerificationState(events);
    const decisionLines = collectDecisionLines(events);
    const nextSteps = collectNextSteps(events);
    const activeInstructions = collectActiveInstructions(events);
    const watchItems = uniqueStrings([
        ...splitListField(evaluation?.watchouts),
        ...failures
    ]).slice(0, 4);
    const originalRequest = normalizeText(findFirstBody(events, KIND.userMessage), 320);
    const outcomeSummary = normalizeText(evaluation?.outcomeNote, 240)
        ?? inferOutcomeSummary(events, modifiedFiles, verificationSummary);
    const approachSummary = normalizeText(evaluation?.approachNote, 240)
        ?? (decisionLines.length > 0 ? normalizeText(decisionLines.slice(0, 2).join(" / "), 240) : null);
    const reuseWhen = normalizeText(evaluation?.reuseWhen, 220);
    const searchText = buildSearchText({
        objective,
        originalRequest,
        outcomeSummary,
        approachSummary,
        reuseWhen,
        workflowTags: evaluation?.workflowTags ?? [],
        useCase: evaluation?.useCase ?? null,
        watchItems,
        keyDecisions: decisionLines,
        keyFiles,
        activeInstructions
    });
    return {
        objective: normalizeText(objective, 220) ?? "Reusable task",
        originalRequest,
        outcomeSummary,
        approachSummary,
        reuseWhen,
        watchItems,
        keyDecisions: decisionLines,
        nextSteps,
        keyFiles,
        modifiedFiles,
        verificationSummary,
        activeInstructions,
        searchText
    };
}

/**
 * Finds the earliest user-visible text for a particular event kind.
 */
function findFirstBody(events: readonly TimelineEvent[], kind: TimelineEvent["kind"]): string | null {
    const event = events.find((item) => item.kind === kind);
    return normalizeText(event?.body ?? event?.title, 320);
}

/**
 * Infers a fallback outcome summary when no explicit evaluation note exists.
 */
function inferOutcomeSummary(events: readonly TimelineEvent[], modifiedFiles: readonly string[], verificationSummary: string | null): string | null {
    const assistantResponse = [...events]
        .reverse()
        .find(isAssistantResponseEvent);
    const assistantSummary = normalizeText(assistantResponse?.body ?? assistantResponse?.title, 240);
    if (assistantSummary) {
        return assistantSummary;
    }
    const parts: string[] = [];
    if (modifiedFiles.length > 0) {
        parts.push(`Updated ${modifiedFiles.length} file${modifiedFiles.length === 1 ? "" : "s"}.`);
    }
    if (verificationSummary) {
        parts.push(verificationSummary);
    }
    return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Collects the written file paths that best represent the workflow's output.
 */
function collectModifiedFiles(events: readonly TimelineEvent[]): readonly string[] {
    return uniqueStrings(events
        .filter((event) => isFileChangedEvent(event) && numericMetadata(event, "writeCount") > 0)
        .map((event) => stringMetadata(event, "filePath") ?? normalizeText(event.title, 240))
        .filter((value): value is string => Boolean(value))).slice(0, 8);
}

/**
 * Merges changed files and referenced files into the key-file shortlist,
 * sorted by read frequency (most-referenced first).
 */
function collectKeyFiles(events: readonly TimelineEvent[], modifiedFiles: readonly string[]): readonly string[] {
    const frequency = new Map<string, number>();
    for (const event of events) {
        for (const fp of stringArrayMetadata(event, "filePaths")) {
            frequency.set(fp, (frequency.get(fp) ?? 0) + 1);
        }
    }

    const discovered = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([fp]) => fp);

    return uniqueStrings([
        ...modifiedFiles,
        ...discovered,
    ]).slice(0, 8);
}

/**
 * Computes verification summary text plus the failure lines that deserve watchout status.
 */
function collectVerificationState(events: readonly TimelineEvent[]): {
    readonly summary: string | null;
    readonly failures: readonly string[];
} {
    const verifications = events.filter(isRuleOrVerificationEvent);
    if (verifications.length === 0) {
        return { summary: null, failures: [] };
    }
    const failingVerifications = verifications.filter((event) => stringMetadata(event, "verificationStatus") === "fail"
        || stringMetadata(event, "ruleStatus") === "violation");
    const failures = uniqueStrings(failingVerifications
        .map((event) => normalizeText(event.title, 180))
        .filter((value): value is string => Boolean(value))).slice(0, 4);
    const failureCount = failingVerifications.length;
    const passCount = verifications.length - failureCount;
    return {
        summary: `Checks: ${verifications.length} (${passCount} pass, ${failureCount} fail)`,
        failures
    };
}

/**
 * Extracts a small set of planning and implementation decisions worth preserving.
 */
function collectDecisionLines(events: readonly TimelineEvent[]): readonly string[] {
    const candidates = events
        .filter((event) => isPlanningLane(event.lane)
        || isImplementationLane(event.lane)
        || isCoordinationLane(event.lane))
        .map((event) => describeDecisionEvent(event))
        .filter((value): value is string => Boolean(value));
    return uniqueStrings(candidates).slice(0, 4);
}

/**
 * Converts a single event into a compact decision-oriented summary line.
 */
function describeDecisionEvent(event: TimelineEvent): string | null {
    if (isFileChangedEvent(event) || isTaskLifecycleEvent(event)) {
        return null;
    }
    const detail = normalizeText(stringMetadata(event, "description")
        ?? stringMetadata(event, "action")
        ?? stringMetadata(event, "command")
        ?? event.body
        ?? event.title, 180);
    if (!detail) {
        return null;
    }
    if (detail === normalizeText(event.title, 180)) {
        return detail;
    }
    const title = normalizeText(event.title, 120);
    return title ? `${title}: ${detail}` : detail;
}

/**
 * Collects relative paths of instruction files loaded during the session.
 * Skips compact re-loads (loadReason === "compact") to avoid duplicates.
 */
function collectActiveInstructions(events: readonly TimelineEvent[]): readonly string[] {
    return uniqueStrings(
        events
            .filter((e) => isInstructionsLoadedEvent(e) && stringMetadata(e, "loadReason") !== "compact")
            .map((e) => stringMetadata(e, "relPath"))
            .filter((v): v is string => Boolean(v))
    );
}

/**
 * Builds the actionable follow-up list from open todos and unresolved questions.
 */
function collectNextSteps(events: readonly TimelineEvent[]): readonly string[] {
    const openTodos = collectOpenTodoTitles(events);
    const openQuestions = collectOpenQuestionTitles(events);
    return uniqueStrings([
        ...openTodos,
        ...openQuestions
    ]).slice(0, 4);
}

/**
 * Returns todo titles whose latest known state is still open.
 */
function collectOpenTodoTitles(events: readonly TimelineEvent[]): readonly string[] {
    const states = new Map<string, string>();
    for (const event of events) {
        if (!isTodoLoggedEvent(event)) {
            continue;
        }
        const title = normalizeText(event.title, 180);
        if (!title) {
            continue;
        }
        states.set(title, stringMetadata(event, "todoState") ?? "added");
    }
    return [...states.entries()]
        .filter(([, state]) => state !== "completed" && state !== "cancelled")
        .map(([title]) => title);
}

/**
 * Returns question prompts that were asked but never concluded.
 */
function collectOpenQuestionTitles(events: readonly TimelineEvent[]): readonly string[] {
    const groups = new Map<string, {
        latestPrompt: string | null;
        concluded: boolean;
    }>();
    for (const event of events) {
        if (!isQuestionLoggedEvent(event)) {
            continue;
        }
        const questionId = stringMetadata(event, "questionId");
        if (!questionId) {
            continue;
        }
        const current = groups.get(questionId) ?? { latestPrompt: null, concluded: false };
        const phase = stringMetadata(event, "questionPhase") ?? "asked";
        if (phase === "asked" || phase === "answered") {
            current.latestPrompt = normalizeText(event.body ?? event.title, 180);
        }
        if (phase === "concluded") {
            current.concluded = true;
        }
        groups.set(questionId, current);
    }
    return [...groups.values()]
        .filter((group) => !group.concluded && group.latestPrompt)
        .map((group) => group.latestPrompt as string);
}

/**
 * Builds the plain-text search corpus used for workflow library indexing.
 */
function buildSearchText(input: {
    readonly objective: string;
    readonly originalRequest: string | null;
    readonly outcomeSummary: string | null;
    readonly approachSummary: string | null;
    readonly reuseWhen: string | null;
    readonly workflowTags: readonly string[];
    readonly useCase: string | null;
    readonly watchItems: readonly string[];
    readonly keyDecisions: readonly string[];
    readonly keyFiles: readonly string[];
    readonly activeInstructions: readonly string[];
}): string {
    return [
        input.objective,
        input.originalRequest,
        input.useCase,
        input.outcomeSummary,
        input.approachSummary,
        input.reuseWhen,
        input.workflowTags.join(" "),
        input.watchItems.join(" "),
        input.keyDecisions.join(" "),
        input.keyFiles.join(" "),
        input.activeInstructions.join(" ")
    ]
        .map((value) => {
        const normalized = normalizeText(value);
        return normalized ? truncateText(normalized, 240) : null;
    })
        .filter((value): value is string => Boolean(value))
        .join(" ");
}

/**
 * Splits semi-structured list fields from evaluations into normalized items.
 */
function splitListField(value?: string | null): readonly string[] {
    if (!value) {
        return [];
    }
    return uniqueStrings(value
        .split(/\r?\n|[;•]+/)
        .map((entry) => normalizeText(entry, 160))
        .filter((entry): entry is string => Boolean(entry)));
}

/**
 * Normalizes free-form text while preserving the caller's chosen truncation strategy.
 */
function normalizeText(value?: string | null, limit = 160): string | null {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return null;
    }
    void limit;
    return normalized;
}

/**
 * Truncates long strings without returning an empty prefix.
 */
function truncateText(value: string, limit: number): string {
    if (value.length <= limit) {
        return value;
    }
    return `${value.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

/**
 * Deduplicates strings case-insensitively while preserving first-seen ordering.
 */
function uniqueStrings(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const key = value.trim().toLowerCase();
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(value);
    }
    return result;
}

/**
 * Reads string metadata fields for snapshot helper functions.
 */
function stringMetadata(event: TimelineEvent, key: string): string | null {
    const value = event.metadata[key];
    return typeof value === "string" ? value : null;
}

/**
 * Reads numeric metadata fields while defaulting missing values to zero.
 */
function numericMetadata(event: TimelineEvent, key: string): number {
    const value = event.metadata[key];
    return typeof value === "number" ? value : 0;
}

/**
 * Reads string-array metadata fields without leaking non-string entries.
 */
function stringArrayMetadata(event: TimelineEvent, key: string): readonly string[] {
    const value = event.metadata[key];
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
}
