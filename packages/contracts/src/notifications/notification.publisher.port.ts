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

/** 알림 발행기 DI 토큰. 합성 루트(app.module)에서 실제 발행기로 바인딩한다. */
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
