import type {
    EventNotificationPayloadPortDto,
    MonitorNotificationPortDto,
    RuleEnforcementNotificationPayloadPortDto,
    RulesChangedNotificationPayloadPortDto,
    SdkJobKind,
    SdkJobStatus,
    SdkJobUpdatedNotificationPayloadPortDto,
    VerdictUpdatedNotificationPayloadPortDto,
} from "./monitor.notification.port.dto.js";

export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export interface INotificationPublisher {
    publish(notification: MonitorNotificationPortDto): void;
}

export type MonitorNotification = MonitorNotificationPortDto;
export type EventNotificationPayload = EventNotificationPayloadPortDto;
export type RuleEnforcementNotificationPayload = RuleEnforcementNotificationPayloadPortDto;
export type VerdictUpdatedNotificationPayload = VerdictUpdatedNotificationPayloadPortDto;
export type RulesChangedNotificationPayload = RulesChangedNotificationPayloadPortDto;
export type SdkJobUpdatedNotificationPayload = SdkJobUpdatedNotificationPayloadPortDto;
export type { SdkJobKind, SdkJobStatus };
