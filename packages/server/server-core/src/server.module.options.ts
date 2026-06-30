import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";

// HTTP 앱·워커 합성 루트가 공유하는 부팅 옵션.
export interface ServerModuleOptions {
    readonly notifier?: INotificationPublisher;
}
