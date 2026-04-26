import {
    isAgentActivityLoggedEvent,
    isBackgroundLane,
    isCoordinationLane,
    isFileChangedEvent,
    isQuestionLoggedEvent,
    isRuleLoggedEvent,
    isTerminalCommandEvent,
    isThoughtLoggedEvent,
    isTodoLoggedEvent,
    isToolUsedEvent,
    isUserMessageEvent,
    isVerificationLoggedEvent,
    readString,
    readStringArray,
    type TimelineEvent,
} from "~domain/monitoring/index.js";
import type { ObservabilityFileCount, ObservabilityTagCount, ObservabilityTaskSignals } from "./observability.metrics.type.js";

export function collectSignalsAndFocus(input: {
    readonly event: TimelineEvent;
    readonly signals: ObservabilityTaskSignals;
    readonly questionGroups: Map<string, { readonly concluded: boolean }>;
    readonly todoGroups: Map<string, { readonly completed: boolean }>;
    readonly topFiles: Map<string, number>;
    readonly topTags: Map<string, number>;
}): void {
    const { event } = input;
    const metadata = event.metadata;
    if (isUserMessageEvent(event) && readString(metadata, "captureMode") === "raw") {
        input.signals.rawUserMessages += 1;
        if (readString(metadata, "phase") === "follow_up") {
            input.signals.followUpMessages += 1;
        }
    }
    if (isQuestionLoggedEvent(event)) {
        if (readString(metadata, "questionPhase") === "asked") {
            input.signals.questionsAsked += 1;
        }
        const questionId = readString(metadata, "questionId");
        if (questionId) {
            const existing = input.questionGroups.get(questionId) ?? { concluded: false };
            const concluded = existing.concluded || readString(metadata, "questionPhase") === "concluded";
            input.questionGroups.set(questionId, { concluded });
        }
    }
    if (isTodoLoggedEvent(event)) {
        if (readString(metadata, "todoState") === "added") {
            input.signals.todosAdded += 1;
        }
        const todoId = readString(metadata, "todoId");
        if (todoId) {
            const existing = input.todoGroups.get(todoId) ?? { completed: false };
            const completed = existing.completed || readString(metadata, "todoState") === "completed";
            input.todoGroups.set(todoId, { completed });
        }
    }
    if (isThoughtLoggedEvent(event)) input.signals.thoughts += 1;
    if (isToolUsedEvent(event)) input.signals.toolCalls += 1;
    if (isTerminalCommandEvent(event)) input.signals.terminalCommands += 1;
    if (isVerificationLoggedEvent(event)) input.signals.verifications += 1;
    if (isAgentActivityLoggedEvent(event) || isCoordinationLane(event.lane)) {
        input.signals.coordinationActivities += 1;
    }
    if (isBackgroundLane(event.lane) || readString(metadata, "asyncTaskId")) {
        input.signals.backgroundTransitions += 1;
    }
    const filePaths = readStringArray(metadata, "filePaths");
    if (filePaths.length > 0) {
        for (const filePath of filePaths) {
            incrementCount(input.topFiles, filePath);
        }
    } else if (isFileChangedEvent(event) && event.body) {
        incrementCount(input.topFiles, event.body);
    }
    for (const tag of event.classification.tags) {
        incrementCount(input.topTags, tag);
    }
}

export function collectRuleAudit(event: TimelineEvent, summary: {
    total: number;
    checks: number;
    passes: number;
    violations: number;
    other: number;
}): void {
    if (!isRuleLoggedEvent(event)) return;
    summary.total += 1;
    const status = readString(event.metadata, "ruleStatus");
    if (status === "check") { summary.checks += 1; return; }
    if (status === "pass" || status === "fix-applied") { summary.passes += 1; return; }
    if (status === "violation") { summary.violations += 1; return; }
    summary.other += 1;
}

export function collectRuleEnforcement(event: TimelineEvent, summary: {
    warnings: number;
    blocked: number;
    approvalRequested: number;
    approved: number;
    rejected: number;
    bypassed: number;
    activeState: "clear" | "warning" | "blocked" | "approval_required";
    activeRuleId: string | undefined;
    activeLabel: string | undefined;
}): void {
    if (!isRuleLoggedEvent(event)) return;
    const outcome = readString(event.metadata, "ruleOutcome");
    const policy = readString(event.metadata, "rulePolicy");
    const status = readString(event.metadata, "ruleStatus");
    const ruleIdRaw = readString(event.metadata, "ruleId");
    const ruleId = ruleIdRaw ? (ruleIdRaw).trim() : undefined;
    const ruleLabel = normalizeRuleActiveLabel(ruleId, event.title);
    const setActive = (state: typeof summary.activeState): void => {
        summary.activeState = state;
        if (ruleId !== undefined) summary.activeRuleId = ruleId;
        if (ruleLabel !== undefined) summary.activeLabel = ruleLabel;
    };
    switch (outcome) {
        case "warned":        summary.warnings += 1;          setActive("warning");          return;
        case "blocked":       summary.blocked += 1;           setActive("blocked");          return;
        case "approval_requested": summary.approvalRequested += 1; setActive("approval_required"); return;
        case "approved":      summary.approved += 1;          setActive("clear");            return;
        case "rejected":      summary.rejected += 1;          setActive("blocked");          return;
        case "bypassed":      summary.bypassed += 1;          setActive("clear");            return;
    }
    switch (policy) {
        case "warn": {
            summary.warnings += 1;
            if (status === "violation" || status === "check") setActive("warning");
            return;
        }
        case "block": {
            summary.blocked += 1;
            if (status === "violation" || status === "check") setActive("blocked");
            return;
        }
        case "approval_required": {
            summary.approvalRequested += 1;
            if (status === "violation" || status === "check") setActive("approval_required");
            return;
        }
    }
}

export function incrementCount(map: Map<string, number>, value: string): void {
    map.set(value, (map.get(value) ?? 0) + 1);
}

export function topFileCounts(map: Map<string, number>, limit: number): readonly ObservabilityFileCount[] {
    return [...map.entries()]
        .sort((left, right) => right[1] !== left[1] ? right[1] - left[1] : left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([path, count]) => ({ path, count }));
}

export function topTagCounts(map: Map<string, number>, limit: number): readonly ObservabilityTagCount[] {
    return [...map.entries()]
        .sort((left, right) => right[1] !== left[1] ? right[1] - left[1] : left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));
}

function normalizeRuleActiveLabel(ruleId?: string, title?: string): string | undefined {
    const normalizedRuleId = ruleId?.trim();
    if (normalizedRuleId) return normalizedRuleId;
    const normalizedTitle = title?.trim();
    return normalizedTitle ? normalizedTitle : undefined;
}
