import type { NotificationEnvelope } from "@monitor/kernel";

export const NOTIFICATION_PUBLISHER = Symbol("NotificationPublisher");

/** 회수 결과 알림을 구독자에게 발행하는 포트이며, 발행 메커니즘은 notify 슬라이스가 구현한다. */
export interface NotificationPublisherPort {
    publish(envelope: NotificationEnvelope): Promise<void>;
}
