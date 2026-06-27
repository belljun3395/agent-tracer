import type { MonitoringTask } from "@monitor/work/task/domain/task.model.js";
import type { MonitoringTaskKind, TaskOrigin } from "@monitor/work/task/common/task.status.const.js";
import type { MonitoringEventKind } from "@monitor/activity/event/public/types/event.types.js";

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
