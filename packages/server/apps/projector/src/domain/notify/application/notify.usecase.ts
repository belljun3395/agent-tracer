import { Inject, Injectable } from "@nestjs/common";
import type { NotificationEnvelope } from "@monitor/kernel";
import {
    NOTIFICATION_PUBLISHER,
    type NotificationPublisherPort,
} from "~projector/domain/notify/port/notification.publisher.port.js";

/** 알림 봉투 묶음을 받은 순서대로 발행한다. */
@Injectable()
export class NotifyUseCase {
    constructor(@Inject(NOTIFICATION_PUBLISHER) private readonly publisher: NotificationPublisherPort) {}

    async execute(envelopes: readonly NotificationEnvelope[]): Promise<void> {
        for (const envelope of envelopes) {
            await this.publisher.publish(envelope);
        }
    }
}
