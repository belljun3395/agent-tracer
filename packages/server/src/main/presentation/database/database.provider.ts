import { type Provider } from "@nestjs/common";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";

export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export function DatabaseProviders(options: {
    databasePath: string;
    notifier?: INotificationPublisher;
}): Provider[] {
    void options;
    const noopNotifier: INotificationPublisher = { publish: () => { } };

    return [
        {
            provide: NOTIFICATION_PUBLISHER_TOKEN,
            useValue: options.notifier ?? noopNotifier,
        },
    ];
}
