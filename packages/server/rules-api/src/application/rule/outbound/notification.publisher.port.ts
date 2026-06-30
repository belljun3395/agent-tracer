import type { MonitorNotification } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";

export type RuleOutboundNotification = Extract<MonitorNotification, { type: typeof NOTIFICATION_TYPE.rulesChanged }>;

export interface IRuleNotificationPublisher {
    publish(notification: RuleOutboundNotification): void;
}
