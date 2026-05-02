import type { MonitorNotification } from "~adapters/notifications/notification.publisher.port.js";

/**
 * Local WS broadcast fan-out — pushes a notification to all connected clients
 * on **this** server instance. In a multi-instance deployment, a Redis (or
 * other) subscriber would call this to deliver messages received from other
 * instances; the local NotificationPublisher publish path also calls this for
 * messages originating on this instance.
 */
export interface IBroadcastFanout {
    fanout(notification: MonitorNotification): void;
}

const BROADCAST_FANOUT_TOKEN = "BROADCAST_FANOUT";
