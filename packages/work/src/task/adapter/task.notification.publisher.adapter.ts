import { Inject, Injectable } from "@nestjs/common";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
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
        private readonly inner: INotificationPublisher,
    ) {}

    publish(notification: TaskOutboundNotification): void {
        this.inner.publish(notification);
    }
}
