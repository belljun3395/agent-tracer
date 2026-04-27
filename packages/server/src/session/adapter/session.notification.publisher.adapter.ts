import { Inject, Injectable } from "@nestjs/common";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    ISessionNotificationPublisher,
    SessionOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";

/**
 * Outbound adapter — forwards session-local notifications to the shared
 * transport-level NotificationPublisherPort. SessionOutboundNotification is
 * a structural subset of MonitorNotificationPortDto, so the cast is safe.
 */
@Injectable()
export class SessionNotificationPublisherAdapter implements ISessionNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly inner: NotificationPublisherPort,
    ) {}

    publish(notification: SessionOutboundNotification): void {
        this.inner.publish(notification);
    }
}
