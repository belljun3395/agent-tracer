import { currentUserId } from "@monitor/shared-kernel/user/user.context.js";
import type {
    INotificationPublisher,
    MonitorNotification,
} from "~adapters/notifications/notification.publisher.port.js";

/** 모든 인스턴스가 구독하는 알림 채널. 메시지는 대상 userId 를 함께 싣는다. */
export const NOTIFICATION_CHANNEL = "monitor:notifications";

export interface NotificationEnvelope {
    readonly userId: string;
    readonly notification: MonitorNotification;
}

/** publish 만 사용하는 최소 Redis 클라이언트 계약(버전별 제네릭 의존 회피). */
export interface RedisPublisherClient {
    publish(channel: string, message: string): Promise<number>;
}

/**
 * 알림을 Redis 채널로 publish 한다(대상 userId = 현재 요청 사용자). 어느 파드가
 * 그 사용자의 WS 소켓을 들고 있든 구독자가 받아 전달하므로 멀티파드에서 동작한다.
 */
export class RedisNotificationPublisher implements INotificationPublisher {
    constructor(private readonly publisher: RedisPublisherClient) {}

    publish(notification: MonitorNotification): void {
        const envelope: NotificationEnvelope = { userId: currentUserId(), notification };
        void this.publisher
            .publish(NOTIFICATION_CHANNEL, JSON.stringify(envelope))
            .catch(() => undefined);
    }
}
