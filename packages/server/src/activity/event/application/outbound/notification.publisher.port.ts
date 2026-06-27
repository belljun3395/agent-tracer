import type { TimelineEventProjection } from "~activity/event/public/dto/timeline.event.dto.js";
import type { MonitoringTask } from "~work/task/public/types/task.types.js";

/**
 * 이벤트 모듈이 발행하는 알림. 페이로드는 캐노니컬 타입(프로젝션/태스크)을 그대로
 * 사용해 공유 알림 타입과 캐스트 없이 정렬된다.
 */
export type EventOutboundNotification =
    | { readonly type: "event.logged"; readonly payload: TimelineEventProjection }
    | { readonly type: "event.updated"; readonly payload: TimelineEventProjection }
    | { readonly type: "task.updated"; readonly payload: MonitoringTask };

export interface IEventNotificationPublisher {
    publish(notification: EventOutboundNotification): void;
}
