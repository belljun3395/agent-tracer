import type { MonitoringTaskKind } from "~work/task/common/task.status.type.js";
import type { MonitoringTask } from "./task.model.js";

export interface StartTaskDraftInput {
    readonly taskId: string;
    readonly title: string;
    readonly startedAt: string;
    readonly existingTask?: MonitoringTask | null;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface TaskUpsertDraft {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: "running";
    readonly taskKind: MonitoringTaskKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly runtimeSource?: string;
}

export interface StartTaskEventDraftInput {
    readonly task: MonitoringTask;
    readonly sessionId: string;
    readonly title: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface FinalizeTaskEventDraftInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly outcome: "completed" | "errored";
    readonly summary?: string;
    readonly errorMessage?: string;
    readonly metadata?: Record<string, unknown>;
}
