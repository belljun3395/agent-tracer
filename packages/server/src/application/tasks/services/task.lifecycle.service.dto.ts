import type { MonitoringEventKind, MonitoringTask, MonitoringTaskKind } from "~domain/index.js";

export interface StartTaskServiceInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface FinalizeTaskServiceInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
    readonly outcome: "completed" | "errored";
    readonly errorMessage?: string;
}

export interface TaskLifecycleServiceEventRef {
    readonly id: string;
    readonly kind: MonitoringEventKind;
}

export interface TaskLifecycleServiceResult {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly TaskLifecycleServiceEventRef[];
}
