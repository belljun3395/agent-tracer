import type { MonitoringTask } from "@monitor/work-api/task/domain/task.model.js";
import type { MonitoringEventKind } from "@monitor/activity-api/event/public/types/event.types.js";

export interface ErrorTaskUseCaseIn {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
    readonly errorMessage: string;
}

export interface ErrorTaskUseCaseOut {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}
