import { TOPIC, type NotificationEnvelope } from "@monitor/kernel";
import type {KafkaProducer} from "./kafka.types.js";

/** 알림은 상태 정합성과 무관한 유실 허용 신호다. */
export async function publishNotification(producer: KafkaProducer, envelope: NotificationEnvelope): Promise<void> {
    try {
        await producer.send({
            topic: TOPIC.notifications,
            messages: [{ key: envelope.userId, value: JSON.stringify(envelope) }],
        });
    } catch {
        // 무시.
    }
}
