import { Inject, Injectable } from "@nestjs/common";
import type { NotificationPublisherPort } from "~adapters/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    ITaskNotificationPublisher,
    TaskOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";

/**
 * Outbound adapter — forwards task notifications to the shared transport.
 */
@Injectable()
export class TaskNotificationPublisherAdapter implements ITaskNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly inner: NotificationPublisherPort,
    ) {}

    publish(notification: TaskOutboundNotification): void {
        this.inner.publish(notification as never);
    }
}
