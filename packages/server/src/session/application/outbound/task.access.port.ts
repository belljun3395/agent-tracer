/**
 * Outbound port. Self-contained — no imports from outside this file.
 * Adapter (session/adapter/task.access.adapter.ts) is the only place that
 * bridges external module types into these local definitions.
 */

export type TaskAccessStatus =
    | "running"
    | "waiting"
    | "completed"
    | "errored";

export type TaskAccessKind = "primary" | "background";

export interface TaskAccessRecord {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: TaskAccessStatus;
    readonly taskKind?: TaskAccessKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly runtimeSource?: string;
    readonly displayTitle?: string;
}

export interface TaskAccessUpsertInput {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: TaskAccessStatus;
    readonly taskKind: TaskAccessKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly runtimeSource?: string;
}

export interface ITaskAccess {
    findById(id: string): Promise<TaskAccessRecord | null>;
    findChildren(parentId: string): Promise<readonly TaskAccessRecord[]>;
    upsert(input: TaskAccessUpsertInput): Promise<TaskAccessRecord>;
    updateStatus(id: string, status: TaskAccessStatus, updatedAt: string): Promise<void>;
}
