

export type TaskLifecycleAccessKind = "primary" | "background";
export type TaskLifecycleAccessOutcome = "completed" | "errored";
export type TaskLifecycleAccessOrigin = "user" | "server-sdk";

export interface StartTaskAccessInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: TaskLifecycleAccessKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly origin?: TaskLifecycleAccessOrigin;
}

export interface FinalizeTaskAccessInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly outcome: TaskLifecycleAccessOutcome;
}

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
