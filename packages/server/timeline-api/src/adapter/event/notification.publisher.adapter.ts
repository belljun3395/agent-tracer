import { Inject, Injectable } from "@nestjs/common";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type {
    EventOutboundNotification,
    IEventNotificationPublisher,
} from "@monitor/timeline-api/application/event/outbound/notification.publisher.port.js";

@Injectable()
export class EventNotificationPublisherAdapter implements IEventNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly inner: INotificationPublisher,
    ) {}

    publish(notification: EventOutboundNotification): void {
        this.inner.publish(notification);
    }
}
