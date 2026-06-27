import type { TimelineEventProjection } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";
import type { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";

/**
 * 이벤트 모듈이 발행하는 알림. timeline은 자신의 이벤트 알림만 발행한다 —
 * taskUpdated는 event.recorded를 구독하는 work이 발행하므로 여기 없다(leaf).
 */
export type EventOutboundNotification =
    | { readonly type: typeof NOTIFICATION_TYPE.eventLogged; readonly payload: TimelineEventProjection }
    | { readonly type: typeof NOTIFICATION_TYPE.eventUpdated; readonly payload: TimelineEventProjection };

export interface IEventNotificationPublisher {
    publish(notification: EventOutboundNotification): void;
}
