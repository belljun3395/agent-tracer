import { Inject, Injectable } from "@nestjs/common";
import type { NotificationPublisherPort } from "~adapters/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    EventOutboundNotification,
    IEventNotificationPublisher,
} from "../application/outbound/notification.publisher.port.js";

@Injectable()
export class EventNotificationPublisherAdapter implements IEventNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly inner: NotificationPublisherPort,
    ) {}

    publish(notification: EventOutboundNotification): void {
        this.inner.publish(notification as never);
    }
}
