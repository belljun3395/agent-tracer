import type { EventBroadcasterService } from "./ws/event.broadcaster.service.js";
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
            let envelope: NotificationEnvelope;
            try {
                envelope = JSON.parse(message) as NotificationEnvelope;
            } catch {
                return;
            }
            if (envelope.userId) {
                this.broadcaster.fanout(envelope.userId, envelope.notification);
            }
        });
    }
}
