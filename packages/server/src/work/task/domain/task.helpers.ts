import type { EventRecordingInput } from "~activity/event/public/types/event.types.js";
import type { MonitoringTaskInput } from "./task.model.js";
import type {
    FinalizeTaskEventDraftInput,
    StartTaskDraftInput,
    StartTaskEventDraftInput,
    TaskUpsertDraft,
} from "./task.lifecycle.model.js";

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "task";
}

export function normalizeWorkspacePath(path: string): string {
    return path.replace(/\/+/g, "/").replace(/\/$/, "").trim();
}

export function createTaskSlug(input: MonitoringTaskInput): string {
    return slugify(input.title);
}

export function createTaskUpsertDraft(input: StartTaskDraftInput): TaskUpsertDraft {
    const existing = input.existingTask ?? null;
    const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;
    const runtimeSource = input.runtimeSource ?? existing?.runtimeSource;
    const taskKind = input.taskKind ?? existing?.taskKind ?? "primary";
    const parentTaskId = input.parentTaskId ?? existing?.parentTaskId;
    const parentSessionId = input.parentSessionId ?? existing?.parentSessionId;
    const backgroundTaskId = input.backgroundTaskId ?? existing?.backgroundTaskId;

    return {
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
    };
}

export function toTaskStartEventRecordingInput(input: StartTaskEventDraftInput): EventRecordingInput {
    const metadata = {
        ...(input.metadata ?? {}),
        taskKind: input.task.taskKind,
        ...(input.task.parentTaskId ? { parentTaskId: input.task.parentTaskId } : {}),
        ...(input.task.parentSessionId ? { parentSessionId: input.task.parentSessionId } : {}),
        ...(input.task.backgroundTaskId ? { backgroundTaskId: input.task.backgroundTaskId } : {}),
        ...(input.task.workspacePath ? { workspacePath: input.task.workspacePath } : {}),
        ...(input.runtimeSource ? { runtimeSource: input.runtimeSource } : {}),
    };

    return {
        taskId: input.task.id,
        sessionId: input.sessionId,
        kind: "task.start",
        lane: "user",
        title: input.title,
        metadata,
        ...(input.summary ? { body: input.summary } : {}),
    };
}

export function toTaskFinalizationEventRecordingInput(input: FinalizeTaskEventDraftInput): EventRecordingInput {
    const body = input.outcome === "errored" ? input.errorMessage : input.summary;
    return {
        taskId: input.taskId,
        kind: input.outcome === "completed" ? "task.complete" : "task.error",
        lane: "user",
        title: input.outcome === "completed" ? "Task completed" : "Task errored",
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(body ? { body } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
    };
}
