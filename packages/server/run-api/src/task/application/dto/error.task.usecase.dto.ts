import type { MonitoringTask } from "@monitor/run-api/task/domain/type/task.type.js";
import type { MonitoringEventKind } from "@monitor/timeline-api/event/public/types/event.types.js";

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
