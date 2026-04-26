import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";

export interface BookmarkDraftInput {
    readonly id: string;
    readonly task: MonitoringTask;
    readonly event?: TimelineEvent;
    readonly title?: string;
    readonly note?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface BookmarkDraft {
    readonly id: string;
    readonly taskId: string;
    readonly eventId?: string;
    readonly kind: "task" | "event";
    readonly title: string;
    readonly note?: string;
    readonly metadata: Record<string, unknown>;
}
