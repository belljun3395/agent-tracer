import type { MonitoringTask } from "@monitor/run-api/task/domain/type/task.type.js";
import type { MonitoringTaskKind, TaskOrigin } from "@monitor/run-api/task/common/task.status.const.js";
import type { MonitoringEventKind } from "@monitor/timeline-api/event/public/types/event.types.js";

export interface StartTaskUseCaseIn {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly origin?: TaskOrigin;
    readonly metadata?: Record<string, unknown>;
}

export interface StartTaskUseCaseOut {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}
