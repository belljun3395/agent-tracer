import type { EventNotificationPayloadPortDto, MonitorNotificationPortDto, RuleEnforcementNotificationPayloadPortDto, RulesChangedNotificationPayloadPortDto, VerdictUpdatedNotificationPayloadPortDto } from "~application/ports/notifications/dto/monitor.notification.port.dto.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";

export type EventNotificationPayload = EventNotificationPayloadPortDto;
export type MonitorNotification = MonitorNotificationPortDto;
export type RuleEnforcementNotificationPayload = RuleEnforcementNotificationPayloadPortDto;
export type VerdictUpdatedNotificationPayload = VerdictUpdatedNotificationPayloadPortDto;
export type RulesChangedNotificationPayload = RulesChangedNotificationPayloadPortDto;

export type INotificationPublisher = NotificationPublisherPort;
