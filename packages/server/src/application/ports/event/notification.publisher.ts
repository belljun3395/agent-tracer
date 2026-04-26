import type { MonitoringSession, MonitoringTask } from "~domain/index.js";
import type { TimelineEventRecord } from "~application/views/index.js";
export type MonitorNotification = {
    readonly type: "task.started";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.completed";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.updated";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.deleted";
    readonly payload: {
        taskId: string;
    };
} | {
    readonly type: "session.started";
    readonly payload: MonitoringSession;
} | {
    readonly type: "session.ended";
    readonly payload: MonitoringSession;
} | {
    readonly type: "event.logged";
    readonly payload: TimelineEventRecord;
} | {
    readonly type: "event.updated";
    readonly payload: TimelineEventRecord;
} | {
    readonly type: "tasks.purged";
    readonly payload: {
        count: number;
    };
};
export interface INotificationPublisher {
    publish(notification: MonitorNotification): void;
}
