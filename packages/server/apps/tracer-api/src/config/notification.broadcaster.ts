import type WebSocket from "ws";
import type { Notification } from "@monitor/kernel";

const WS_OPEN = 1;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

type TrackedSocket = WebSocket & { monitorUserId?: string };

/** 접속 소켓을 사용자별로 묶어 대상 사용자에게만 알림을 전파한다. */
export class NotificationBroadcaster {
    private readonly all = new Set<TrackedSocket>();
    private readonly byUser = new Map<string, Set<TrackedSocket>>();

    addClient(ws: WebSocket, userId: string): void {
        const tracked = ws as TrackedSocket;
        tracked.monitorUserId = userId;
        this.all.add(tracked);
        const set = this.byUser.get(userId) ?? new Set<TrackedSocket>();
        set.add(tracked);
        this.byUser.set(userId, set);
    }

    removeClient(ws: WebSocket): void {
        const tracked = ws as TrackedSocket;
        this.all.delete(tracked);
        const userId = tracked.monitorUserId;
        if (userId === undefined) return;
        const set = this.byUser.get(userId);
        if (!set) return;
        set.delete(tracked);
        if (set.size === 0) this.byUser.delete(userId);
    }

    get connections(): ReadonlySet<WebSocket> {
        return this.all;
    }

    drop(ws: WebSocket): void {
        this.removeClient(ws);
        try {
            ws.terminate();
        } catch {
            // 이미 닫힌 소켓은 그대로 둔다.
        }
    }

    fanout(userId: string, notification: Notification): void {
        const clients = this.byUser.get(userId);
        if (!clients || clients.size === 0) return;
        const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
        for (const client of clients) {
            if (client.readyState !== WS_OPEN) continue;
            if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
                this.drop(client);
                continue;
            }
            try {
                client.send(msg);
            } catch {
                this.drop(client);
            }
        }
    }
}
