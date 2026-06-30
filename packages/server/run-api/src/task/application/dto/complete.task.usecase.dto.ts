import type { MonitoringTask } from "@monitor/run-api/task/domain/type/task.type.js";
import type { MonitoringEventKind } from "@monitor/timeline-api/public/types/event.types.js";

export interface CompleteTaskUseCaseIn {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskFinalizationUseCaseIn extends CompleteTaskUseCaseIn {
    readonly outcome: "completed" | "errored";
    readonly errorMessage?: string;
}

export interface CompleteTaskUseCaseOut {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}
