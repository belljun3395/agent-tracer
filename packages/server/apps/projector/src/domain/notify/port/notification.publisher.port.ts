import type { NotificationEnvelope } from "@monitor/kernel";

/** 투영 결과 알림을 구독자에게 발행하는 포트다. */
export interface NotificationPublisherPort {
    publish(envelope: NotificationEnvelope): Promise<void>;
}
