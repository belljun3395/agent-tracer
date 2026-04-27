/**
 * Outbound port. Self-contained — no imports from outside this file.
 * Adapter (session/adapter/task.lifecycle.access.adapter.ts) bridges
 * external module types into these local definitions.
 */

export type TaskLifecycleAccessKind = "primary" | "background";
export type TaskLifecycleAccessOutcome = "completed" | "errored";

export interface StartTaskAccessInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: TaskLifecycleAccessKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
}

export interface FinalizeTaskAccessInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly outcome: TaskLifecycleAccessOutcome;
}

/** Narrow projection — session reads only what it needs from the result. */
export interface TaskLifecycleAccessTaskRef {
    readonly id: string;
}

export interface TaskLifecycleAccessResult {
    readonly task: TaskLifecycleAccessTaskRef;
    readonly sessionId?: string;
}

export interface ITaskLifecycleAccess {
    startTask(input: StartTaskAccessInput): Promise<TaskLifecycleAccessResult>;
    finalizeTask(input: FinalizeTaskAccessInput): Promise<TaskLifecycleAccessResult>;
}
