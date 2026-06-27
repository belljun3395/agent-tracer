import type WebSocket from "ws";
import type { MonitorNotification } from "~adapters/notifications/notification.publisher.port.js";

const WS_OPEN = 1;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024; // 8 MiB — 드레인 못 하는 클라이언트는 끊는다.

type TrackedSocket = WebSocket & { monitorUserId?: string };

/**
 * 이 인스턴스(파드)에 연결된 WS 클라이언트 레지스트리 + 사용자별 fan-out.
 * 클라이언트는 userId 로 그룹화되며, fanout(userId, ...) 은 해당 사용자의 소켓에만
 * 전송한다. 파드 간 라우팅은 Redis 구독자가 이 fanout 을 호출해 처리한다(무상태:
 * 이 레지스트리는 이 파드가 실제로 들고 있는 소켓만 담는다).
 */
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
        if (set.size === 0) this.byUser.delete(userId);
    }

    /** 하트비트 reaper 용 — 이 파드의 전체 연결. */
    get connections(): ReadonlySet<WebSocket> {
        return this.all;
    }

    /** 느리거나 죽은/에러난 소켓을 끊는다. */
    drop(ws: WebSocket): void {
        this.removeClient(ws);
        try {
            ws.terminate();
        } catch {
            // 이미 닫힘 — 무시
        }
    }

    /** 특정 사용자의 이 파드 소켓에만 전송한다. */
    fanout(userId: string, notification: MonitorNotification): void {
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
