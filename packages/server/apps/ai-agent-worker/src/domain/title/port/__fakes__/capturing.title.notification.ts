import type { TitleNotificationPort } from "../title.notification.port.js";

/** 알림 포트의 대역이며 발행한 페이로드를 모은다. */
export class CapturingTitleNotification implements TitleNotificationPort {
    readonly published: { readonly userId: string; readonly payload: Record<string, unknown> }[] = [];

    jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        this.published.push({ userId, payload });
        return Promise.resolve();
    }
}
