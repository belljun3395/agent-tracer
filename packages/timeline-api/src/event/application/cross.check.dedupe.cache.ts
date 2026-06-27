import { Injectable } from "@nestjs/common";

/**
 * In-memory dedupe cache for cross-check events (hook ↔ rollout pair).
 *
 * The Codex runtime emits the same logical event twice — once from the
 * PostToolUse hook and once from the rollout file observer. Both carry the
 * same `crossCheck.dedupeKey` in metadata. When the second arrives within
 * the TTL window, server merges its metadata into the existing event row
 * instead of inserting a duplicate.
 *
 * The cache is local to a single server process. That's fine because the
 * race window is short (seconds) and the runtime always pairs hook+rollout
 * within one Codex session that is sticky to one ingest endpoint.
 *
 * If the second event arrives outside the window we get a duplicate row;
 * the web layer falls back to grouping by (sessionId, kind, dedupeKey).
 */
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
            if (now - entry.createdAt > this.ttlMs) this.entries.delete(key);
        }
    }

    /** Returns the prior eventId if the same dedupeKey was seen recently. */
    lookup(kind: string, sessionId: string | undefined, dedupeKey: string): string | undefined {
        const now = Date.now();
        this.gc(now);
        const entry = this.entries.get(this.composeKey(kind, sessionId, dedupeKey));
        return entry?.eventId;
    }

    /** Records a fresh event under the dedupeKey. */
    remember(kind: string, sessionId: string | undefined, dedupeKey: string, eventId: string): void {
        this.entries.set(this.composeKey(kind, sessionId, dedupeKey), {
            eventId,
            createdAt: Date.now(),
        });
    }
}
