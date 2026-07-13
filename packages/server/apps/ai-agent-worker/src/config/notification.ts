import { NOTIFICATION_TYPE } from "@monitor/kernel";
import { publishNotification, type KafkaProducer } from "@monitor/platform";

/** 잡 상태 변화를 알림 토픽으로 발행하며 유실을 허용한다. */
export type NotificationPublisher = (userId: string, payload: Record<string, unknown>) => Promise<void>;

export function createNotificationPublisher(producer: KafkaProducer): NotificationPublisher {
    return (userId, payload) =>
        publishNotification(producer, {
            userId,
            notification: { type: NOTIFICATION_TYPE.sdkJobUpdated, payload },
        });
}
