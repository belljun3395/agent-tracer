import type {
    INotificationPublisher,
    MonitorNotification,
} from "../notification.publisher.port.js";
import type { IBroadcastFanout } from "~adapters/realtime/ws/broadcast.fanout.port.js";
import type { IOsDesktopNotifier } from "../os.desktop.notifier.js";

/**
 * Single-instance notification publisher — module emits a notification, this
 * publisher forwards it to the local WS fanout, which pushes to every
 * connected client, and (when configured) also fires an OS-level desktop
 * banner via the OsDesktopNotifier.
 *
 * For multi-instance deployments swap this with `RedisNotificationPublisher`
 * (publishes to a shared channel) and have a `RedisFanoutSubscriber` on each
 * instance call `IBroadcastFanout.fanout()` upon receiving messages from the
 * channel. Module code stays untouched.
 */
export class LocalNotificationPublisher implements INotificationPublisher {
    constructor(
        private readonly fanout: IBroadcastFanout,
        private readonly osNotifier?: IOsDesktopNotifier,
    ) {}

    publish(notification: MonitorNotification): void {
        this.fanout.fanout(notification);
        this.osNotifier?.notify(notification);
    }
}
