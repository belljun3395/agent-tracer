import type WebSocket from "ws";
import type { MonitorNotification } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";

const WS_OPEN = 1;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

type TrackedSocket = WebSocket & { monitorUserId?: string };

export class EventBroadcasterService {
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
        // 마지막 소켓이 사라진 사용자는 전파 대상 목록에서 제거한다.
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
            // 이미 닫힌 소켓은 연결 목록에서 제거된 상태로 둔다.
        }
    }

    fanout(userId: string, notification: MonitorNotification): void {
        const clients = this.byUser.get(userId);
        if (!clients || clients.size === 0) return;
        const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
        for (const client of clients) {
            if (client.readyState !== WS_OPEN) continue;
            if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
                // 버퍼가 과도하게 쌓인 클라이언트는 전체 전파를 막기 전에 끊는다.
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
