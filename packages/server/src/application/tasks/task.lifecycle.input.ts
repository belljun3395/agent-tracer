import type {
    MonitoringTaskKind,
    TaskStatus,
} from "~domain/index.js";

export type TaskFinalizationOutcome = "completed" | "errored";

export interface TaskStartInput {
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

export interface TaskLinkInput {
    readonly taskId: string;
    readonly title?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface TaskPatchInput {
    readonly taskId: string;
    readonly title?: string;
    readonly status?: TaskStatus;
}

export interface TaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskErrorInput extends TaskCompletionInput {
    readonly errorMessage: string;
}

export interface TaskFinalizationInput extends TaskCompletionInput {
    readonly outcome: TaskFinalizationOutcome;
    readonly errorMessage?: string;
}
