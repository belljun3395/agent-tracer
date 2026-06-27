import type { TimelineEventProjection } from "~activity/event/public/dto/timeline.event.dto.js";
import type { SessionSnapshot } from "~activity/session/public/dto/session.snapshot.dto.js";
import type { MonitoringTask } from "~work/task/domain/task.model.js";

/**
 * 태스크 모듈이 발행하는 알림. 페이로드는 캐노니컬 타입(태스크/세션/프로젝션)을
 * 그대로 사용해 공유 알림 타입과 캐스트 없이 정렬된다.
 */
export type TaskOutboundNotification =
    | { readonly type: "task.started"; readonly payload: MonitoringTask }
    | { readonly type: "task.completed"; readonly payload: MonitoringTask }
    | { readonly type: "task.updated"; readonly payload: MonitoringTask }
    | { readonly type: "task.deleted"; readonly payload: { readonly taskId: string } }
    | { readonly type: "tasks.purged"; readonly payload: { readonly count: number } }
    | { readonly type: "session.started"; readonly payload: SessionSnapshot }
    | { readonly type: "session.ended"; readonly payload: SessionSnapshot }
    | { readonly type: "event.logged"; readonly payload: TimelineEventProjection };

export interface ITaskNotificationPublisher {
    publish(notification: TaskOutboundNotification): void;
}
