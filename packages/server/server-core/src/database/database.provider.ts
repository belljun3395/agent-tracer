import { type Provider } from "@nestjs/common";
import {
    NOTIFICATION_PUBLISHER_TOKEN,
    type INotificationPublisher,
} from "@monitor/shared/contracts/notifications/notification.publisher.port.js";

export { NOTIFICATION_PUBLISHER_TOKEN };

export function DatabaseProviders(options: {
    notifier?: INotificationPublisher;
}): Provider[] {
    const noopNotifier: INotificationPublisher = { publish: () => { } };

    return [
        {
            provide: NOTIFICATION_PUBLISHER_TOKEN,
            useValue: options.notifier ?? noopNotifier,
        },
    ];
}
