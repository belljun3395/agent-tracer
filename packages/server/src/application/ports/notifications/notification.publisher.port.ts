import type { MonitorNotificationPortDto } from "./dto/monitor.notification.port.dto.js";

export interface NotificationPublisherPort {
    publish(notification: MonitorNotificationPortDto): void;
}
