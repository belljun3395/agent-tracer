import type { MonitorNotification } from "~adapters/notifications/notification.publisher.port.js";

/**
 * 아웃바운드 포트 — 룰 변경(created/updated/deleted/promoted) 브로드캐스트.
 * 공유 알림 타입의 rules.changed 변형을 그대로 사용해 캐스트 없이 정렬된다.
 */
export type RuleOutboundNotification = Extract<MonitorNotification, { type: "rules.changed" }>;

export interface IRuleNotificationPublisher {
    publish(notification: RuleOutboundNotification): void;
}
