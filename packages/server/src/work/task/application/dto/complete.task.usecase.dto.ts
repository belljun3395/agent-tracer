import type { MonitoringTask } from "~work/task/domain/task.model.js";
import type { MonitoringEventKind } from "@monitor/activity/event/public/types/event.types.js";

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
