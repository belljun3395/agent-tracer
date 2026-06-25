import type { MonitoringTask } from "~work/task/domain/task.model.js";
import type {
    MonitoringTaskKind,
    TaskOrigin,
} from "~work/task/common/task.status.const.js";
import { normalizeWorkspacePath } from "~work/task/domain/task.path.helpers.js";
import { createTaskSlug } from "../common/task.slug.js";

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
    readonly origin?: TaskOrigin;
}

export interface TaskUpsertDraftShape {
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
    readonly origin?: TaskOrigin;
}

/**
 * Domain model for "task is being upserted at the start of a runtime session".
 * Resolves defaults (existing task / runtime source / kind / hierarchy) and
 * normalises the workspace path. Use {@link TaskUpsertDraft.from} to build.
 */
export class TaskUpsertDraft {
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
    readonly origin?: TaskOrigin;

    private constructor(shape: TaskUpsertDraftShape) {
        this.id = shape.id;
        this.title = shape.title;
        this.slug = shape.slug;
        this.status = shape.status;
        this.taskKind = shape.taskKind;
        this.createdAt = shape.createdAt;
        this.updatedAt = shape.updatedAt;
        this.lastSessionStartedAt = shape.lastSessionStartedAt;
        if (shape.workspacePath !== undefined) this.workspacePath = shape.workspacePath;
        if (shape.parentTaskId !== undefined) this.parentTaskId = shape.parentTaskId;
        if (shape.parentSessionId !== undefined) this.parentSessionId = shape.parentSessionId;
        if (shape.backgroundTaskId !== undefined) this.backgroundTaskId = shape.backgroundTaskId;
        if (shape.runtimeSource !== undefined) this.runtimeSource = shape.runtimeSource;
        if (shape.origin !== undefined) this.origin = shape.origin;
    }

    static from(input: StartTaskDraftInput): TaskUpsertDraft {
        const existing = input.existingTask ?? null;
        const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;
        const runtimeSource = input.runtimeSource ?? existing?.runtimeSource;
        const taskKind = input.taskKind ?? existing?.taskKind ?? "primary";
        const parentTaskId = input.parentTaskId ?? existing?.parentTaskId;
        const parentSessionId = input.parentSessionId ?? existing?.parentSessionId;
        const backgroundTaskId = input.backgroundTaskId ?? existing?.backgroundTaskId;
        // Origin is sticky once a task is born; we never demote a server-sdk
        // task back to user on resume, even if the env var goes missing.
        const origin = existing?.origin ?? input.origin;

        return new TaskUpsertDraft({
            id: input.taskId,
            title: input.title,
            slug: createTaskSlug({ title: input.title }),
            status: "running",
            taskKind,
            createdAt: existing?.createdAt ?? input.startedAt,
            updatedAt: input.startedAt,
            lastSessionStartedAt: input.startedAt,
            ...(parentTaskId ? { parentTaskId } : {}),
            ...(parentSessionId ? { parentSessionId } : {}),
            ...(backgroundTaskId ? { backgroundTaskId } : {}),
            ...(workspacePath ? { workspacePath } : {}),
            ...(runtimeSource ? { runtimeSource } : {}),
            ...(origin ? { origin } : {}),
        });
    }

    /** Plain object representation for repository upsert calls. */
    toShape(): TaskUpsertDraftShape {
        return {
            id: this.id,
            title: this.title,
            slug: this.slug,
            status: this.status,
            taskKind: this.taskKind,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastSessionStartedAt: this.lastSessionStartedAt,
            ...(this.workspacePath !== undefined ? { workspacePath: this.workspacePath } : {}),
            ...(this.parentTaskId !== undefined ? { parentTaskId: this.parentTaskId } : {}),
            ...(this.parentSessionId !== undefined ? { parentSessionId: this.parentSessionId } : {}),
            ...(this.backgroundTaskId !== undefined ? { backgroundTaskId: this.backgroundTaskId } : {}),
            ...(this.runtimeSource !== undefined ? { runtimeSource: this.runtimeSource } : {}),
            ...(this.origin !== undefined ? { origin: this.origin } : {}),
        };
    }
}
