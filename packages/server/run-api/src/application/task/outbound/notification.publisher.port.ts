import type { TimelineEventProjection } from "@monitor/timeline-api/public/event/dto/timeline.event.dto.js";
import type { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { SessionSnapshot } from "@monitor/run-api/domain/session/dto/session.snapshot.dto.js";
import type { MonitoringTask } from "@monitor/run-api/domain/task/type/task.type.js";

export type TaskOutboundNotification =
    | { readonly type: typeof NOTIFICATION_TYPE.taskStarted; readonly payload: MonitoringTask }
    | { readonly type: typeof NOTIFICATION_TYPE.taskCompleted; readonly payload: MonitoringTask }
    | { readonly type: typeof NOTIFICATION_TYPE.taskUpdated; readonly payload: MonitoringTask }
    | { readonly type: typeof NOTIFICATION_TYPE.taskDeleted; readonly payload: { readonly taskId: string } }
    | { readonly type: typeof NOTIFICATION_TYPE.tasksPurged; readonly payload: { readonly count: number } }
    | { readonly type: typeof NOTIFICATION_TYPE.sessionStarted; readonly payload: SessionSnapshot }
    | { readonly type: typeof NOTIFICATION_TYPE.sessionEnded; readonly payload: SessionSnapshot }
    | { readonly type: typeof NOTIFICATION_TYPE.eventLogged; readonly payload: TimelineEventProjection };

export interface ITaskNotificationPublisher {
    publish(notification: TaskOutboundNotification): void;
}
