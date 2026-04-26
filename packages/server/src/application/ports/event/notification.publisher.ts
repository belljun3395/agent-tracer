import type {
    EventNotificationPayloadPortDto,
    MonitorNotificationPortDto,
    NotificationPublisherPort,
    RuleEnforcementNotificationPayloadPortDto,
    RulesChangedNotificationPayloadPortDto,
    VerdictUpdatedNotificationPayloadPortDto,
} from "../notifications/index.js";

export type EventNotificationPayload = EventNotificationPayloadPortDto;
export type MonitorNotification = MonitorNotificationPortDto;
export type RuleEnforcementNotificationPayload = RuleEnforcementNotificationPayloadPortDto;
export type VerdictUpdatedNotificationPayload = VerdictUpdatedNotificationPayloadPortDto;
export type RulesChangedNotificationPayload = RulesChangedNotificationPayloadPortDto;

export type INotificationPublisher = NotificationPublisherPort;
