import type {
    EventNotificationPayloadPortDto,
    MonitorNotificationPortDto,
    RuleEnforcementNotificationPayloadPortDto,
    RulesChangedNotificationPayloadPortDto,
    SdkJobKind,
    SdkJobStatus,
    SdkJobUpdatedNotificationPayloadPortDto,
    VerdictUpdatedNotificationPayloadPortDto,
} from "./dto/monitor.notification.port.dto.js";

export interface NotificationPublisherPort {
    publish(notification: MonitorNotificationPortDto): void;
}

/** Canonical alias — same shape, used pervasively across modules. */
export type INotificationPublisher = NotificationPublisherPort;

export type MonitorNotification = MonitorNotificationPortDto;
export type EventNotificationPayload = EventNotificationPayloadPortDto;
export type RuleEnforcementNotificationPayload = RuleEnforcementNotificationPayloadPortDto;
export type VerdictUpdatedNotificationPayload = VerdictUpdatedNotificationPayloadPortDto;
export type RulesChangedNotificationPayload = RulesChangedNotificationPayloadPortDto;
export type SdkJobUpdatedNotificationPayload = SdkJobUpdatedNotificationPayloadPortDto;
export type { SdkJobKind, SdkJobStatus };
