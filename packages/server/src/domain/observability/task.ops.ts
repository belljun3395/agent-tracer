import type { EvidenceLevel, MonitoringSession, MonitoringTask, TimelineEvent } from "~domain/index.js";
import type { ObservabilityPhaseBucket, ObservabilityTaskSignals, TaskObservabilitySummary } from "./observability.metrics.type.js";
import {
    addDuration,
    buildSessionWindows,
    collectSessionEvents,
    PHASE_ORDER,
    phaseForEvent,
    resolveTaskEndMs,
    resolveTaskStartMs,
} from "./phase.ops.js";
import {
    collectRuleAudit,
    collectRuleEnforcement,
    collectSignalsAndFocus,
    resolveEvidenceLevel,
    topFileCounts,
    topTagCounts,
} from "./signal.ops.js";
import { collectExplicitRelations, isTraceLinkEligible } from "./trace.link.ops.js";

export interface TaskObservabilityInput {
    readonly task: MonitoringTask;
    readonly sessions: readonly MonitoringSession[];
    readonly timeline: readonly TimelineEvent[];
    readonly now?: Date;
}

export const STALE_RUNNING_TASK_THRESHOLD_MS = 30 * 60000;

const TOP_LIST_LIMIT = 5;

export function analyzeTaskObservability(input: TaskObservabilityInput): TaskObservabilitySummary {
    const now = input.now ?? new Date();
    const sessions = [...input.sessions].sort((left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt));
    const timeline = [...input.timeline].sort((left, right) => {
        const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
    });
    const taskStartMs = resolveTaskStartMs(input.task, sessions, timeline);
    const taskEndMs = resolveTaskEndMs(input.task, sessions, timeline, now);
    const sessionWindows = buildSessionWindows(input.task, sessions, timeline, now, taskEndMs);
    const phaseDurations: Record<ObservabilityPhaseBucket, number> = {
        planning: 0, exploration: 0, implementation: 0, verification: 0, coordination: 0, waiting: 0,
    };
    const signals: ObservabilityTaskSignals = {
        rawUserMessages: 0, followUpMessages: 0, questionsAsked: 0, questionsClosed: 0,
        questionClosureRate: 0, todosAdded: 0, todosCompleted: 0, todoCompletionRate: 0,
        thoughts: 0, toolCalls: 0, terminalCommands: 0, verifications: 0,
        backgroundTransitions: 0, coordinationActivities: 0, exploredFiles: 0,
    };
    const topFiles = new Map<string, number>();
    const topTags = new Map<string, number>();
    const questionGroups = new Map<string, { readonly concluded: boolean }>();
    const todoGroups = new Map<string, { readonly completed: boolean }>();
    const ruleAudit = { total: 0, checks: 0, passes: 0, violations: 0, other: 0 };
    const ruleEnforcement: {
        warnings: number; blocked: number; approvalRequested: number; approved: number;
        rejected: number; bypassed: number;
        activeState: "clear" | "warning" | "blocked" | "approval_required";
        activeRuleId: string | undefined; activeLabel: string | undefined;
    } = {
        warnings: 0, blocked: 0, approvalRequested: 0, approved: 0, rejected: 0, bypassed: 0,
        activeState: "clear", activeRuleId: undefined, activeLabel: undefined,
    };
    const evidenceCounts = new Map<EvidenceLevel, number>([
        ["proven", 0], ["self_reported", 0], ["inferred", 0], ["unavailable", 0],
    ]);
    const relationEdges = collectExplicitRelations(timeline);
    const traceLinkEligibleEventIds = new Set<string>(
        timeline.filter(isTraceLinkEligible).map((event) => event.id));
    const traceLinkedEventIds = new Set<string>();
    for (const edge of relationEdges) {
        if (traceLinkEligibleEventIds.has(edge.sourceEventId)) traceLinkedEventIds.add(edge.sourceEventId);
        if (traceLinkEligibleEventIds.has(edge.targetEventId)) traceLinkedEventIds.add(edge.targetEventId);
    }
    for (const event of timeline) {
        collectSignalsAndFocus({ event, signals, questionGroups, todoGroups, topFiles, topTags });
        const evidenceLevel = resolveEvidenceLevel(event);
        evidenceCounts.set(evidenceLevel, (evidenceCounts.get(evidenceLevel) ?? 0) + 1);
        collectRuleAudit(event, ruleAudit);
        collectRuleEnforcement(event, ruleEnforcement);
    }
    let cursorMs = taskStartMs;
    for (const window of sessionWindows) {
        if (window.startMs > cursorMs) {
            addDuration(phaseDurations, "waiting", window.startMs - cursorMs);
        }
        const sessionEvents = collectSessionEvents({
            timeline, session: window.session, startMs: window.startMs, endMs: window.endMs,
        });
        let previousMs = window.startMs;
        let previousPhase: ObservabilityPhaseBucket = "waiting";
        for (const event of sessionEvents) {
            const eventMs = Date.parse(event.createdAt);
            if (eventMs > previousMs) addDuration(phaseDurations, previousPhase, eventMs - previousMs);
            previousMs = eventMs;
            previousPhase = phaseForEvent(event);
        }
        if (window.endMs > previousMs) addDuration(phaseDurations, previousPhase, window.endMs - previousMs);
        cursorMs = window.endMs;
    }
    if (taskEndMs > cursorMs) addDuration(phaseDurations, "waiting", taskEndMs - cursorMs);
    const totalDurationMs = Math.max(0, taskEndMs - taskStartMs);
    const activeDurationMs = Math.max(0, totalDurationMs - phaseDurations.waiting);
    const traceLinkEligibleEventCount = traceLinkEligibleEventIds.size;
    const traceLinkedEventCount = traceLinkedEventIds.size;
    signals.questionsClosed = [...questionGroups.values()].filter((g) => g.concluded).length;
    signals.todosCompleted = [...todoGroups.values()].filter((g) => g.completed).length;
    signals.questionClosureRate = questionGroups.size > 0 ? signals.questionsClosed / questionGroups.size : 0;
    signals.todoCompletionRate = todoGroups.size > 0 ? signals.todosCompleted / todoGroups.size : 0;
    signals.exploredFiles = topFiles.size;
    return {
        taskId: input.task.id,
        ...(input.task.runtimeSource ? { runtimeSource: input.task.runtimeSource } : {}),
        totalDurationMs,
        activeDurationMs,
        totalEvents: timeline.length,
        traceLinkCount: relationEdges.length,
        traceLinkedEventCount,
        traceLinkEligibleEventCount,
        traceLinkCoverageRate: traceLinkEligibleEventCount > 0 ? traceLinkedEventCount / traceLinkEligibleEventCount : 0,
        phaseBreakdown: PHASE_ORDER.map((phase) => ({
            phase,
            durationMs: phaseDurations[phase],
            share: totalDurationMs > 0 ? phaseDurations[phase] / totalDurationMs : 0,
        })),
        sessions: {
            total: sessions.length,
            resumed: Math.max(0, sessions.length - 1),
            open: sessions.filter((s) => s.status === "running" || !s.endedAt).length,
        },
        signals,
        focus: {
            topFiles: topFileCounts(topFiles, TOP_LIST_LIMIT),
            topTags: topTagCounts(topTags, TOP_LIST_LIMIT),
        },
        evidence: {
            breakdown: [
                { level: "proven",        count: evidenceCounts.get("proven") ?? 0 },
                { level: "self_reported", count: evidenceCounts.get("self_reported") ?? 0 },
                { level: "inferred",      count: evidenceCounts.get("inferred") ?? 0 },
                { level: "unavailable",   count: evidenceCounts.get("unavailable") ?? 0 },
            ],
        },
        rules: ruleAudit,
        ruleEnforcement,
    };
}

export function isStaleRunningTask(
    task: MonitoringTask,
    sessions: readonly MonitoringSession[],
    timeline: readonly TimelineEvent[],
    now: Date,
): boolean {
    const candidates = [
        Date.parse(task.updatedAt),
        Date.parse(task.createdAt),
        ...sessions.flatMap((session) => [
            Date.parse(session.startedAt),
            session.endedAt ? Date.parse(session.endedAt) : 0,
        ]),
        ...timeline.map((event) => Date.parse(event.createdAt)),
    ].filter(Number.isFinite);
    const lastActivityMs = candidates.length > 0 ? Math.max(...candidates) : Date.parse(task.createdAt);
    return now.getTime() - lastActivityMs >= STALE_RUNNING_TASK_THRESHOLD_MS;
}
