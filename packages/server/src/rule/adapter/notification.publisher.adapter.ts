import { Inject, Injectable } from "@nestjs/common";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    IRuleNotificationPublisher,
    RuleOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";

@Injectable()
export class RuleNotificationPublisherAdapter implements IRuleNotificationPublisher {
    constructor(
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly inner: INotificationPublisher,
    ) {}

    publish(notification: RuleOutboundNotification): void {
        this.inner.publish(notification as never);
    }
}
