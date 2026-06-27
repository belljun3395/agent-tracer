import type { EventBroadcasterService } from "./ws/event.broadcaster.service.js";
import { NOTIFICATION_CHANNEL, type NotificationEnvelope } from "./redis.notification.publisher.js";

/** subscribe 만 사용하는 최소 Redis 클라이언트 계약. */
export interface RedisSubscriberClient {
    subscribe(channel: string, listener: (message: string) => void): Promise<void>;
}

/**
 * Redis 알림 채널을 구독해, 이 파드가 들고 있는 해당 사용자 소켓으로 fan-out 한다.
 * 다른 파드에서 발행된 알림도 여기서 받아 전달하므로 멀티파드 라우팅이 성립한다.
 */
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
