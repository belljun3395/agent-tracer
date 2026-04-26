import type { TimelineEventRecord } from "./monitoring.js";

export interface ReusableTaskSnapshot {
    readonly objective: string;
    readonly originalRequest: string | null;
    readonly outcomeSummary: string | null;
    readonly approachSummary: string | null;
    readonly reuseWhen: string | null;
    readonly watchItems: readonly string[];
    readonly keyDecisions: readonly string[];
    readonly nextSteps: readonly string[];
    readonly keyFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly verificationSummary: string | null;
    readonly activeInstructions: readonly string[];
    readonly searchText: string;
}

export interface BuildReusableTaskSnapshotInput {
    readonly objective: string;
    readonly events: readonly TimelineEventRecord[];
}

/**
 * Distills a raw event timeline into a lightweight snapshot used by inspector
 * and handoff/briefing surfaces. Pure event-driven; no evaluation inputs.
 */
export function buildReusableTaskSnapshot({ objective, events }: BuildReusableTaskSnapshotInput): ReusableTaskSnapshot {
    const modifiedFiles = collectModifiedFiles(events);
    const keyFiles = collectKeyFiles(events, modifiedFiles);
    const { summary: verificationSummary, failures } = collectVerificationState(events);
    const decisionLines = collectDecisionLines(events);
    const nextSteps = collectNextSteps(events);
    const activeInstructions = collectActiveInstructions(events);
    const watchItems = uniqueStrings(failures).slice(0, 4);
    const originalRequest = normalizeText(findFirstBody(events, "user.message"), 320);
    const outcomeSummary = inferOutcomeSummary(events, modifiedFiles, verificationSummary);
    const approachSummary = decisionLines.length > 0 ? normalizeText(decisionLines.slice(0, 2).join(" / "), 240) : null;
    const reuseWhen: string | null = null;
    const searchText = [
        objective,
        originalRequest ?? "",
        outcomeSummary ?? "",
        approachSummary ?? "",
        ...watchItems,
        ...decisionLines,
        ...keyFiles,
        ...activeInstructions,
    ].join(" ").replace(/\s+/g, " ").trim();
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
        searchText,
    };
}

function findFirstBody(events: readonly TimelineEventRecord[], kind: TimelineEventRecord["kind"]): string | null {
    const event = events.find((item) => item.kind === kind);
    return normalizeText(event?.body ?? event?.title, 320);
}

function inferOutcomeSummary(events: readonly TimelineEventRecord[], modifiedFiles: readonly string[], verificationSummary: string | null): string | null {
    const assistantResponse = [...events]
        .reverse()
        .find((event) => event.kind === "assistant.response");
    const assistantSummary = normalizeText(assistantResponse?.body ?? assistantResponse?.title, 240);
    if (assistantSummary) return assistantSummary;
    const parts: string[] = [];
    if (modifiedFiles.length > 0) {
        parts.push(`Updated ${modifiedFiles.length} file${modifiedFiles.length === 1 ? "" : "s"}.`);
    }
    if (verificationSummary) parts.push(verificationSummary);
    return parts.length > 0 ? parts.join(" ") : null;
}

function collectModifiedFiles(events: readonly TimelineEventRecord[]): readonly string[] {
    return uniqueStrings(events
        .filter((event) => event.kind === "file.changed" && numericMetadata(event, "writeCount") > 0)
        .map((event) => stringMetadata(event, "filePath") ?? normalizeText(event.title, 240))
        .filter((value): value is string => Boolean(value))).slice(0, 8);
}

function collectKeyFiles(events: readonly TimelineEventRecord[], modified: readonly string[]): readonly string[] {
    const referenced = new Map<string, number>();
    for (const event of events) {
        const paths = event.paths?.filePaths ?? [];
        for (const path of paths) {
            referenced.set(path, (referenced.get(path) ?? 0) + 1);
        }
    }
    const sorted = [...referenced.entries()].sort((a, b) => b[1] - a[1]).map(([path]) => path);
    return uniqueStrings([...modified, ...sorted]).slice(0, 8);
}

function collectVerificationState(events: readonly TimelineEventRecord[]): {
    readonly summary: string | null;
    readonly failures: readonly string[];
} {
    const checks = events.filter((event) => event.kind === "verification.logged" || event.kind === "rule.logged");
    if (checks.length === 0) return { summary: null, failures: [] };
    const failures = checks
        .filter((event) => event.metadata["verificationStatus"] === "fail" || event.metadata["ruleStatus"] === "violation")
        .map((event) => normalizeText(event.title, 200))
        .filter((value): value is string => Boolean(value));
    const summary = `${checks.length} check${checks.length === 1 ? "" : "s"} (${checks.length - failures.length} pass, ${failures.length} fail)`;
    return { summary, failures };
}

function collectDecisionLines(events: readonly TimelineEventRecord[]): readonly string[] {
    return uniqueStrings(events
        .filter((event) => event.kind === "plan.logged" || event.kind === "thought.logged")
        .map((event) => normalizeText(event.body ?? event.title, 240))
        .filter((value): value is string => Boolean(value))).slice(0, 5);
}

function collectNextSteps(events: readonly TimelineEventRecord[]): readonly string[] {
    return uniqueStrings(events
        .filter((event) => event.kind === "todo.logged")
        .filter((event) => {
            const state = event.metadata["todoState"] as string | undefined;
            return state !== "completed" && state !== "cancelled";
        })
        .map((event) => normalizeText(event.title, 200))
        .filter((value): value is string => Boolean(value))).slice(0, 5);
}

function collectActiveInstructions(events: readonly TimelineEventRecord[]): readonly string[] {
    return uniqueStrings(events
        .filter((event) => event.kind === "instructions.loaded")
        .map((event) => normalizeText(event.title, 200))
        .filter((value): value is string => Boolean(value))).slice(0, 5);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
    return [...new Set(values)];
}

function normalizeText(value: string | null | undefined, limit: number): string | null {
    if (!value) return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length > limit ? `${trimmed.slice(0, limit - 1).trimEnd()}…` : trimmed;
}

function stringMetadata(event: TimelineEventRecord, key: string): string | null {
    const value = event.metadata[key];
    return typeof value === "string" ? value : null;
}

function numericMetadata(event: TimelineEventRecord, key: string): number {
    const value = event.metadata[key];
    return typeof value === "number" ? value : 0;
}
