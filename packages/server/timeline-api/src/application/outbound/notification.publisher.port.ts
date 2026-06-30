import type { TimelineEventProjection } from "@monitor/timeline-api/public/dto/timeline.event.dto.js";
import type { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";

export type EventOutboundNotification =
    | { readonly type: typeof NOTIFICATION_TYPE.eventLogged; readonly payload: TimelineEventProjection }
    | { readonly type: typeof NOTIFICATION_TYPE.eventUpdated; readonly payload: TimelineEventProjection };

export interface IEventNotificationPublisher {
    publish(notification: EventOutboundNotification): void;
}
