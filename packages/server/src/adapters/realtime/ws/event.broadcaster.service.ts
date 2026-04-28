import type WebSocket from "ws";
import type { MonitorNotification } from "~adapters/notifications/notification.publisher.port.js";
import type { IBroadcastFanout } from "./broadcast.fanout.port.js";

/**
 * Local WS connection registry + fan-out. Implements only IBroadcastFanout;
 * does NOT decide *whether* a notification should be broadcast — that lives
 * with whichever NotificationPublisher impl wires up to call fanout().
 *
 * Single-instance deployment: LocalNotificationPublisher.publish() calls
 *   fanout() directly.
 * Multi-instance deployment: a Redis-backed publisher publishes to a shared
 *   channel; a Redis subscriber on each instance receives messages and calls
 *   fanout() locally.
 */
export class EventBroadcasterService implements IBroadcastFanout {
    private readonly clients = new Set<WebSocket>();

    addClient(ws: WebSocket): void {
        this.clients.add(ws);
    }

    removeClient(ws: WebSocket): void {
        this.clients.delete(ws);
    }

    fanout(notification: MonitorNotification): void {
        const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
        for (const client of this.clients) {
            if (client.readyState === 1) {
                client.send(msg);
            }
        }
    }
}
