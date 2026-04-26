import type { MonitoringSession, MonitoringTask, TimelineEvent } from "~domain/monitoring/index.js";
import { analyzeTaskObservability, isStaleRunningTask } from "./task.ops.js";
import type { ObservabilityOverviewSummary } from "./observability.metrics.type.js";
const UNKNOWN_RUNTIME_SOURCE = "unknown" as const;

export interface ObservabilityOverviewInput {
    readonly tasks: readonly MonitoringTask[];
    readonly sessionsByTaskId: ReadonlyMap<string, readonly MonitoringSession[]>;
    readonly timelinesByTaskId: ReadonlyMap<string, readonly TimelineEvent[]>;
    readonly now?: Date;
}
export function analyzeObservabilityOverview(input: ObservabilityOverviewInput): ObservabilityOverviewSummary {
    const now = input.now ?? new Date();
    const analyses = input.tasks.map((task) => analyzeTaskObservability({
        task,
        sessions: input.sessionsByTaskId.get(task.id) ?? [],
        timeline: input.timelinesByTaskId.get(task.id) ?? [],
        now
    }));
    let runningTasks = 0;
    let staleRunningTasks = 0;
    let totalDurationMs = 0;
    let totalEvents = 0;
    let tasksWithRawPrompt = 0;
    let tasksWithTraceLinks = 0;
    let tasksWithQuestions = 0;
    let tasksWithTodos = 0;
    let tasksWithCoordination = 0;
    let tasksWithBackground = 0;
    let tasksAwaitingApproval = 0;
    let tasksBlockedByRule = 0;
    const runtimeSources = new Map<string, {
        taskCount: number;
        runningTaskCount: number;
        promptCaptureCount: number;
        traceLinkedTaskCount: number;
    }>();
    for (const analysis of analyses) {
        const task = input.tasks.find((candidate) => candidate.id === analysis.taskId);
        if (!task)
            continue;
        if (task.status === "running") {
            runningTasks += 1;
            if (isStaleRunningTask(task, input.sessionsByTaskId.get(task.id) ?? [], input.timelinesByTaskId.get(task.id) ?? [], now)) {
                staleRunningTasks += 1;
            }
        }
        totalDurationMs += analysis.totalDurationMs;
        totalEvents += analysis.totalEvents;
        if (analysis.signals.rawUserMessages > 0) {
            tasksWithRawPrompt += 1;
        }
        if (analysis.traceLinkCount > 0) {
            tasksWithTraceLinks += 1;
        }
        if (analysis.signals.questionsAsked > 0 || analysis.signals.questionsClosed > 0) {
            tasksWithQuestions += 1;
        }
        if (analysis.signals.todosAdded > 0 || analysis.signals.todosCompleted > 0) {
            tasksWithTodos += 1;
        }
        if (analysis.signals.coordinationActivities > 0) {
            tasksWithCoordination += 1;
        }
        if (analysis.signals.backgroundTransitions > 0) {
            tasksWithBackground += 1;
        }
        if (analysis.ruleEnforcement.activeState === "approval_required") {
            tasksAwaitingApproval += 1;
        }
        if (analysis.ruleEnforcement.activeState === "blocked") {
            tasksBlockedByRule += 1;
        }
        const runtimeSource = task.runtimeSource ?? UNKNOWN_RUNTIME_SOURCE;
        const bucket = runtimeSources.get(runtimeSource) ?? {
            taskCount: 0,
            runningTaskCount: 0,
            promptCaptureCount: 0,
            traceLinkedTaskCount: 0
        };
        bucket.taskCount += 1;
        if (task.status === "running") {
            bucket.runningTaskCount += 1;
        }
        if (analysis.signals.rawUserMessages > 0) {
            bucket.promptCaptureCount += 1;
        }
        if (analysis.traceLinkCount > 0) {
            bucket.traceLinkedTaskCount += 1;
        }
        runtimeSources.set(runtimeSource, bucket);
    }
    const totalTasks = input.tasks.length;
    const runtimeSourceSummaries = [...runtimeSources.entries()]
        .map(([runtimeSource, stats]) => ({
        runtimeSource,
        taskCount: stats.taskCount,
        runningTaskCount: stats.runningTaskCount,
        promptCaptureRate: stats.taskCount > 0 ? stats.promptCaptureCount / stats.taskCount : 0,
        traceLinkedTaskRate: stats.taskCount > 0 ? stats.traceLinkedTaskCount / stats.taskCount : 0
    }))
        .sort((left, right) => {
        if (right.taskCount !== left.taskCount) {
            return right.taskCount - left.taskCount;
        }
        return left.runtimeSource.localeCompare(right.runtimeSource);
    });
    return {
        generatedAt: now.toISOString(),
        totalTasks,
        runningTasks,
        staleRunningTasks,
        avgDurationMs: totalTasks > 0 ? totalDurationMs / totalTasks : 0,
        avgEventsPerTask: totalTasks > 0 ? totalEvents / totalTasks : 0,
        promptCaptureRate: totalTasks > 0 ? tasksWithRawPrompt / totalTasks : 0,
        traceLinkedTaskRate: totalTasks > 0 ? tasksWithTraceLinks / totalTasks : 0,
        tasksWithQuestions,
        tasksWithTodos,
        tasksWithCoordination,
        tasksWithBackground,
        tasksAwaitingApproval,
        tasksBlockedByRule,
        runtimeSources: runtimeSourceSummaries
    };
}
