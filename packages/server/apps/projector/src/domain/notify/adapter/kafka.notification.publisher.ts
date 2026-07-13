import { Inject, Injectable } from "@nestjs/common";
import { publishNotification, type KafkaProducer } from "@monitor/platform";
import type { NotificationEnvelope } from "@monitor/kernel";
import type { NotificationPublisherPort } from "~projector/domain/notify/port/notification.publisher.port.js";
import { NOTIFICATION_PRODUCER } from "~projector/support/projector.tokens.js";

/** 알림 봉투를 Kafka 알림 토픽으로 실어 나르는 발행 메커니즘이며, 다른 슬라이스도 이 인스턴스를 재사용한다. */
@Injectable()
export class KafkaNotificationPublisher implements NotificationPublisherPort {
    constructor(@Inject(NOTIFICATION_PRODUCER) private readonly producer: KafkaProducer) {}

    publish(envelope: NotificationEnvelope): Promise<void> {
        return publishNotification(this.producer, envelope);
    }
}
