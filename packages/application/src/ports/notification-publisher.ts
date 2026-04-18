import type { BookmarkId, MonitoringSession, MonitoringTask, TaskId, TimelineEvent } from "@monitor/domain";
import type { BookmarkRecord } from "./bookmark-repository.js";
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
        taskId: TaskId;
    };
} | {
    readonly type: "session.started";
    readonly payload: MonitoringSession;
} | {
    readonly type: "session.ended";
    readonly payload: MonitoringSession;
} | {
    readonly type: "event.logged";
    readonly payload: TimelineEvent;
} | {
    readonly type: "event.updated";
    readonly payload: TimelineEvent;
} | {
    readonly type: "bookmark.saved";
    readonly payload: BookmarkRecord;
} | {
    readonly type: "bookmark.deleted";
    readonly payload: {
        bookmarkId: BookmarkId;
    };
} | {
    readonly type: "tasks.purged";
    readonly payload: {
        count: number;
    };
};
export interface INotificationPublisher {
    publish(notification: MonitorNotification): void;
}
