import type { MonitoringEventKind, MonitoringTask, TimelineLane } from "~domain/monitoring/index.js";

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
