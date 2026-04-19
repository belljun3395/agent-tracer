import type { TimelineEventRecord } from "../../types.js";
import {
    extractMetadataString,
    uniqueStrings
} from "./helpers.js";
import { describeProcessEvent } from "./extraction.js";

export interface QuestionGroup {
    readonly questionId: string;
    readonly phases: readonly {
        readonly phase: string;
        readonly event: TimelineEventRecord;
    }[];
    /** True once the asker replied or closed the thread — treat as "resolved". */
    readonly isAnswered: boolean;
    /** True only when a final `concluded` phase was emitted. */
    readonly isConcluded: boolean;
    /**
     * Back-compat flag — equal to {@link isAnswered}. Prefer `isAnswered` /
     * `isConcluded` directly for new code.
     */
    readonly isComplete: boolean;
}
export interface TodoGroup {
    readonly todoId: string;
    readonly title: string;
    readonly transitions: readonly {
        readonly state: string;
        readonly event: TimelineEventRecord;
    }[];
    readonly currentState: string;
    readonly isTerminal: boolean;
}
export interface ModelSummary {
    readonly defaultModelName?: string;
    readonly defaultModelProvider?: string;
    readonly modelCounts: Readonly<Record<string, number>>;
}

function sortByChronology<T extends { event: TimelineEventRecord }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => {
        const aSeq = typeof a.event.metadata["sequence"] === "number" ? a.event.metadata["sequence"] : Infinity;
        const bSeq = typeof b.event.metadata["sequence"] === "number" ? b.event.metadata["sequence"] : Infinity;
        if (aSeq !== bSeq)
            return aSeq - bSeq;
        return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
    });
}

export function buildQuestionGroups(timeline: readonly TimelineEventRecord[]): readonly QuestionGroup[] {
    const groups = new Map<string, {
        phases: Array<{
            phase: string;
            event: TimelineEventRecord;
        }>;
    }>();
    for (const event of timeline) {
        if (event.kind !== "question.logged")
            continue;
        const questionId = extractMetadataString(event.metadata, "questionId");
        if (!questionId)
            continue;
        const phase = extractMetadataString(event.metadata, "questionPhase") ?? "asked";
        const existing = groups.get(questionId) ?? { phases: [] };
        existing.phases.push({ phase, event });
        groups.set(questionId, existing);
    }
    return [...groups.entries()].map(([questionId, group]) => {
        const sorted = sortByChronology(group.phases);
        const isAnswered = sorted.some(p => p.phase === "answered" || p.phase === "concluded");
        const isConcluded = sorted.some(p => p.phase === "concluded");
        return {
            questionId,
            phases: sorted,
            isAnswered,
            isConcluded,
            isComplete: isAnswered
        };
    });
}
const TODO_TERMINAL_STATES = new Set(["completed", "cancelled"]);
export function buildTodoGroups(timeline: readonly TimelineEventRecord[]): readonly TodoGroup[] {
    const groups = new Map<string, {
        title: string;
        transitions: Array<{
            state: string;
            event: TimelineEventRecord;
        }>;
    }>();
    for (const event of timeline) {
        if (event.kind !== "todo.logged")
            continue;
        const todoId = extractMetadataString(event.metadata, "todoId");
        if (!todoId)
            continue;
        const state = extractMetadataString(event.metadata, "todoState") ?? "added";
        const existing = groups.get(todoId) ?? { title: event.title, transitions: [] };
        existing.transitions.push({ state, event });
        groups.set(todoId, existing);
    }
    return [...groups.entries()].map(([todoId, group]) => {
        const sorted = sortByChronology(group.transitions);
        const last = sorted[sorted.length - 1];
        const currentState = last?.state ?? "added";
        return {
            todoId,
            title: group.title,
            transitions: sorted,
            currentState,
            isTerminal: TODO_TERMINAL_STATES.has(currentState)
        };
    });
}
export function buildModelSummary(timeline: readonly TimelineEventRecord[]): ModelSummary {
    const modelCounts: Record<string, number> = {};
    for (const event of timeline) {
        const modelName = extractMetadataString(event.metadata, "modelName");
        if (modelName) {
            modelCounts[modelName] = (modelCounts[modelName] ?? 0) + 1;
        }
    }
    const entries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
    const defaultModelName = entries[0]?.[0];
    const defaultModelProvider = defaultModelName
        ? extractMetadataString(timeline.find(e => extractMetadataString(e.metadata, "modelName") === defaultModelName)?.metadata ?? {}, "modelProvider")
        : undefined;
    return {
        ...(defaultModelName ? { defaultModelName } : {}),
        ...(defaultModelProvider ? { defaultModelProvider } : {}),
        modelCounts
    };
}
export function collectViolationDescriptions(timeline: readonly TimelineEventRecord[]): readonly string[] {
    return timeline
        .filter(e => (e.kind === "verification.logged" && e.metadata["verificationStatus"] === "fail") ||
        (e.kind === "rule.logged" && e.metadata["ruleStatus"] === "violation"))
        .map(e => e.title);
}
export interface VerificationCycleItem {
    readonly id: string;
    readonly title: string;
    readonly status: "pass" | "issue";
    readonly kind: "verification" | "rule";
    readonly ruleId?: string | undefined;
    readonly createdAt: string;
}
export function buildVerificationCycles(timeline: readonly TimelineEventRecord[]): readonly VerificationCycleItem[] {
    return timeline
        .filter(e => e.kind === "verification.logged" || e.kind === "rule.logged")
        .map((e): VerificationCycleItem => {
        const isVerification = e.kind === "verification.logged";
        const verificationStatus = extractMetadataString(e.metadata, "verificationStatus");
        const ruleStatus = extractMetadataString(e.metadata, "ruleStatus");
        const ruleId = isVerification ? undefined : (extractMetadataString(e.metadata, "ruleId") ?? undefined);
        const status: "pass" | "issue" = isVerification
            ? (verificationStatus === "pass" ? "pass" : "issue")
            : (ruleStatus === "pass" || ruleStatus === "fix-applied" ? "pass" : "issue");
        const title = e.title
            || (isVerification ? "Verification" : (ruleId ?? "Rule check"));
        return {
            id: e.id,
            title,
            status,
            kind: isVerification ? "verification" : "rule",
            ...(ruleId ? { ruleId } : {}),
            createdAt: e.createdAt
        };
    })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function collectPlanSteps(timeline: readonly TimelineEventRecord[]): readonly string[] {
    const planningEvents = timeline.filter(e => e.lane === "planning");
    const describedTerminals = timeline.filter(e => e.kind === "terminal.command"
        && Boolean(extractMetadataString(e.metadata, "description")));
    return uniqueStrings([...planningEvents, ...describedTerminals]
        .map(describeProcessEvent)
        .filter((v): v is string => Boolean(v)));
}
