export type TaskStatus = "running" | "waiting" | "completed" | "errored";
export type TaskKind = "primary" | "background";

export interface TaskSnapshot {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: TaskStatus;
    readonly taskKind?: TaskKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly displayTitle?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface TaskUpsertInput {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: TaskStatus;
    readonly taskKind: TaskKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly runtimeSource?: string;
}

export interface TaskStartLifecycleInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: TaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskFinalizeLifecycleInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
    readonly outcome: "completed" | "errored";
    readonly errorMessage?: string;
}

export interface TaskLifecycleResultRef {
    readonly id: string;
    readonly kind: string;
}

export interface TaskLifecycleResultSnapshot {
    readonly task: TaskSnapshot;
    readonly sessionId?: string;
    readonly events: readonly TaskLifecycleResultRef[];
}
