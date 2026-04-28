import type { EventRecordingInput } from "~event/public/types/event.types.js";
import type { MonitoringTask } from "~task/domain/task.model.js";

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

/** Domain model for the timeline-event recording payload of a task.start event. */
export class TaskStartRecording {
    constructor(private readonly input: StartTaskEventDraftInput) {}

    toEventRecordingInput(): EventRecordingInput {
        const metadata = {
            ...(this.input.metadata ?? {}),
            taskKind: this.input.task.taskKind,
            ...(this.input.task.parentTaskId ? { parentTaskId: this.input.task.parentTaskId } : {}),
            ...(this.input.task.parentSessionId ? { parentSessionId: this.input.task.parentSessionId } : {}),
            ...(this.input.task.backgroundTaskId ? { backgroundTaskId: this.input.task.backgroundTaskId } : {}),
            ...(this.input.task.workspacePath ? { workspacePath: this.input.task.workspacePath } : {}),
            ...(this.input.runtimeSource ? { runtimeSource: this.input.runtimeSource } : {}),
        };

        return {
            taskId: this.input.task.id,
            sessionId: this.input.sessionId,
            kind: "task.start",
            lane: "user",
            title: this.input.title,
            metadata,
            ...(this.input.summary ? { body: this.input.summary } : {}),
        };
    }
}

/** Domain model for the timeline-event recording payload of a task finalization (complete / error). */
export class TaskFinalizationRecording {
    constructor(private readonly input: FinalizeTaskEventDraftInput) {}

    toEventRecordingInput(): EventRecordingInput {
        const body = this.input.outcome === "errored" ? this.input.errorMessage : this.input.summary;
        return {
            taskId: this.input.taskId,
            kind: this.input.outcome === "completed" ? "task.complete" : "task.error",
            lane: "user",
            title: this.input.outcome === "completed" ? "Task completed" : "Task errored",
            ...(this.input.sessionId ? { sessionId: this.input.sessionId } : {}),
            ...(body ? { body } : {}),
            ...(this.input.metadata ? { metadata: this.input.metadata } : {}),
        };
    }
}
