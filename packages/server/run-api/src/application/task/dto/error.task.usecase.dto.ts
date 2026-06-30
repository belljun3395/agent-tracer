import type { MonitoringTask } from "@monitor/run-api/domain/task/type/task.type.js";
import type { MonitoringEventKind } from "@monitor/timeline-api/public/event/types/event.types.js";

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
