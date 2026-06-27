import type { TimelineEventProjection } from "@monitor/activity/event/public/dto/timeline.event.dto.js";
import type { NOTIFICATION_TYPE } from "@monitor/contracts/notifications/notification.type.const.js";
import type { SessionSnapshot } from "@monitor/activity/session/public/dto/session.snapshot.dto.js";
import type { MonitoringTask } from "@monitor/work/task/domain/task.model.js";

/**
 * 태스크 모듈이 발행하는 알림. 페이로드는 캐노니컬 타입(태스크/세션/프로젝션)을
 * 그대로 사용해 공유 알림 타입과 캐스트 없이 정렬된다.
 */
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
