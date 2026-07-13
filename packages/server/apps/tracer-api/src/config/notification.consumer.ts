import os from "node:os";
import { createKafkaConsumer, type KafkaClient, type KafkaConsumer } from "@monitor/platform";
import { NOTIFICATION_TYPE, TOPIC, type NotificationEnvelope } from "@monitor/kernel";
import type { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";

const NOTIFICATION_TYPES = new Set<string>(Object.values(NOTIFICATION_TYPE));

/** 알림 토픽을 구독해 봉투의 userId로 접속 소켓에 전파하며 유실을 허용해 오프셋을 자동 커밋한다. */
export class NotificationConsumer {
    private readonly consumer: KafkaConsumer;

    constructor(kafka: KafkaClient, private readonly broadcaster: NotificationBroadcaster) {
        // 인스턴스마다 고유 컨슈머 그룹으로 붙어 모든 소켓 서버가 같은 알림을 받는다.
        this.consumer = createKafkaConsumer(kafka, {
            groupId: `ws-${os.hostname()}-${process.pid}`,
            fromBeginning: false,
        });
    }

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [TOPIC.notifications] });
        await this.consumer.run({
            eachMessage: ({ message }) => {
                const envelope = parseEnvelope(message.value);
                if (envelope !== null) {
                    this.broadcaster.fanout(envelope.userId, envelope.notification);
                }
                return Promise.resolve();
            },
        });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect().catch(() => undefined);
    }
}

function parseEnvelope(value: Buffer | null): NotificationEnvelope | null {
    if (value === null) return null;
    try {
        const parsed: unknown = JSON.parse(value.toString("utf8"));
        return isNotificationEnvelope(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotificationEnvelope(value: unknown): value is NotificationEnvelope {
    if (!isRecord(value)) return false;
    if (typeof value["userId"] !== "string" || value["userId"].trim() === "") return false;
    const notification = value["notification"];
    if (!isRecord(notification)) return false;
    const type = notification["type"];
    return typeof type === "string" && NOTIFICATION_TYPES.has(type);
}
