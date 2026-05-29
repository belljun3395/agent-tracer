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
 * Multi-instance deployment: NOT supported today — the registry below is an
 *   in-process Set, so a second instance never sees this instance's clients.
 *   Going multi-instance requires a shared channel (e.g. a Redis publisher +
 *   per-instance subscriber that calls fanout()) AND moving off the local
 *   SQLite file. See docs/runtime-server-technical-review.
 *
 * Fault isolation: a single misbehaving client must never abort delivery to
 * the rest or bubble an exception into the ingest/transaction path that called
 * publish(). Every send is therefore guarded, and slow clients that let their
 * send buffer grow past MAX_BUFFERED_BYTES are dropped (terminated) rather than
 * accumulating unbounded memory server-side.
 */
const WS_OPEN = 1;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024; // 8 MiB — drop a client that can't drain

export class EventBroadcasterService implements IBroadcastFanout {
    private readonly clients = new Set<WebSocket>();

    addClient(ws: WebSocket): void {
        this.clients.add(ws);
    }

    removeClient(ws: WebSocket): void {
        this.clients.delete(ws);
    }

    /** Connected clients (read-only) — used by the heartbeat reaper. */
    get connections(): ReadonlySet<WebSocket> {
        return this.clients;
    }

    /** Drop a client and force-close its socket (slow/dead/errored). */
    drop(ws: WebSocket): void {
        this.clients.delete(ws);
        try {
            ws.terminate();
        } catch {
            // already closed — nothing to do
        }
    }

    fanout(notification: MonitorNotification): void {
        const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
        for (const client of this.clients) {
            if (client.readyState !== WS_OPEN) continue;
            // Backpressure: a client that cannot keep up accumulates frames in
            // ws's internal send buffer. Drop it instead of growing the heap.
            if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
                this.drop(client);
                continue;
            }
            try {
                client.send(msg);
            } catch {
                // send() can throw synchronously (e.g. socket racing a close).
                // Isolate the failure so it neither aborts the fan-out loop nor
                // propagates into the ingest/transaction path that called us.
                this.drop(client);
            }
        }
    }
}
