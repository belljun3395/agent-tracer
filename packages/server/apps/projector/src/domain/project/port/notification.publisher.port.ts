import type { NotificationEnvelope } from "@monitor/kernel";

export const NOTIFICATION_PUBLISHER = Symbol("NotificationPublisher");

/** 배치 커밋 뒤 알림 봉투를 구독자에게 발행하는 포트이며, 발행 메커니즘은 notify 슬라이스가 구현한다. */
export interface NotificationPublisherPort {
    publish(envelope: NotificationEnvelope): Promise<void>;
}
