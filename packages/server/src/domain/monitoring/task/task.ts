import { isTimelineLane } from "../common/event.kind.js";
import type { TimelineLane } from "../common/type/event.kind.type.js";
import type { EventRecordingInput } from "../event/model/event.recording.model.js";
import type { MonitoringTaskInput } from "./model/task.model.js";
import type {
    FinalizeTaskEventDraftInput,
    StartTaskDraftInput,
    StartTaskEventDraftInput,
    TaskUpsertDraft,
} from "./model/task.lifecycle.model.js";

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

export function normalizeLane(raw: string): TimelineLane {
    switch (raw) {
        case "file":
            return "exploration";
        case "terminal":
        case "tool":
            return "implementation";
        case "thought":
        case "thoughts":
            return "planning";
        case "message":
            return "user";
        case "rules":
            return "implementation";
        default:
            return isTimelineLane(raw) ? raw : "user";
    }
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
