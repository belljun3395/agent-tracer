import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import type {
    INotificationPublisher,
    MonitorNotification,
} from "./notification.publisher.port.js";

export const NOTIFICATION_CHANNEL = "monitor:notifications";

export interface NotificationEnvelope {
    readonly userId: string;
    readonly notification: MonitorNotification;
}

export interface RedisPublisherClient {
    publish(channel: string, message: string): Promise<number>;
}

export class RedisNotificationPublisher implements INotificationPublisher {
    constructor(private readonly publisher: RedisPublisherClient) {}

    publish(notification: MonitorNotification): void {
        const envelope: NotificationEnvelope = { userId: currentUserId(), notification };
        void this.publisher
            .publish(NOTIFICATION_CHANNEL, JSON.stringify(envelope))
            .catch(() => undefined);
    }
}
