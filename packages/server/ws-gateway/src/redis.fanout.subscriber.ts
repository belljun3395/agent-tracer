import type { EventBroadcasterService } from "./ws/event.broadcaster.service.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { NOTIFICATION_CHANNEL, type NotificationEnvelope } from "./redis.notification.publisher.js";

export interface RedisSubscriberClient {
    subscribe(channel: string, listener: (message: string) => void): Promise<void>;
}

export class RedisFanoutSubscriber {
    constructor(
        private readonly subscriber: RedisSubscriberClient,
        private readonly broadcaster: EventBroadcasterService,
    ) {}

    async start(): Promise<void> {
        await this.subscriber.subscribe(NOTIFICATION_CHANNEL, (message: string) => {
            const envelope = parseNotificationEnvelope(message);
            if (envelope === null) return;
            this.broadcaster.fanout(envelope.userId, envelope.notification);
        });
    }
}

const NOTIFICATION_TYPES = new Set<string>(Object.values(NOTIFICATION_TYPE));

function parseNotificationEnvelope(message: string): NotificationEnvelope | null {
    try {
        const parsed: unknown = JSON.parse(message);
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
