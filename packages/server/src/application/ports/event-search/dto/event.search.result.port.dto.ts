import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/common/type/event.kind.type.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";

export interface EventSearchTaskHitPortDto {
    readonly id: string;
    readonly taskId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly status: MonitoringTask["status"];
    readonly updatedAt: string;
}

export interface EventSearchEventHitPortDto {
    readonly id: string;
    readonly eventId: string;
    readonly taskId: string;
    readonly taskTitle: string;
    readonly title: string;
    readonly snippet?: string;
    readonly lane: TimelineLane;
    readonly kind: MonitoringEventKind;
    readonly createdAt: string;
}

export interface EventSearchResultsPortDto {
    readonly tasks: readonly EventSearchTaskHitPortDto[];
    readonly events: readonly EventSearchEventHitPortDto[];
}
