import { Inject, Injectable } from "@nestjs/common";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type {
    ISessionNotificationPublisher,
    SessionOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";

@Injectable()
export class SessionNotificationPublisherAdapter implements ISessionNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly inner: INotificationPublisher,
    ) {}

    publish(notification: SessionOutboundNotification): void {
        this.inner.publish(notification);
    }
}
