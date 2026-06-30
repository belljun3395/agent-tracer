import { Injectable } from "@nestjs/common";

const CROSS_CHECK_TTL_MS = 60_000;

@Injectable()
export class CrossCheckDedupeCache {
    private readonly entries = new Map<string, { eventId: string; createdAt: number }>();
    private readonly ttlMs: number = CROSS_CHECK_TTL_MS;

    private composeKey(kind: string, sessionId: string | undefined, dedupeKey: string): string {
        return `${kind}:${sessionId ?? ""}:${dedupeKey}`;
    }

    private gc(now: number): void {
        for (const [key, entry] of this.entries) {
            // TTL이 지난 중복 판단 정보는 새 이벤트와 충돌하지 않도록 제거한다.
            if (now - entry.createdAt > this.ttlMs) this.entries.delete(key);
        }
    }

    lookup(kind: string, sessionId: string | undefined, dedupeKey: string): string | undefined {
        const now = Date.now();
        this.gc(now);
        const entry = this.entries.get(this.composeKey(kind, sessionId, dedupeKey));
        return entry?.eventId;
    }

    remember(kind: string, sessionId: string | undefined, dedupeKey: string, eventId: string): void {
        this.entries.set(this.composeKey(kind, sessionId, dedupeKey), {
            eventId,
            createdAt: Date.now(),
        });
    }
}
