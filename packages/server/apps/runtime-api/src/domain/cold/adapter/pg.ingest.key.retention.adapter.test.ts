import { describe, expect, it, vi } from "vitest";
import {
    EVENT_INGEST_KEY_PRUNE_BATCH_SIZE,
    EVENT_INGEST_KEY_RETENTION_DAYS,
    PgIngestKeyRetentionAdapter,
} from "./pg.ingest.key.retention.adapter.js";
import type { SqlClient } from "./runtime.db.connection.js";

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function fakeIngestKeyTable(rows: { id: string; firstSeenAt: Date }[]): SqlClient {
    return {
        query: vi.fn(async (sql: string) => {
            if (!sql.includes("DELETE FROM event_ingest_keys")) return { rows: [] };
            const cutoff = daysAgo(EVENT_INGEST_KEY_RETENTION_DAYS).getTime();
            const expired = rows.filter((row) => row.firstSeenAt.getTime() < cutoff);
            for (const row of expired) rows.splice(rows.indexOf(row), 1);
            return { rows: expired.map((row) => ({ id: row.id })) };
        }),
    };
}

describe("PgIngestKeyRetentionAdapter", () => {
    it("윈도 밖 멱등키만 지우고 윈도 안 멱등키는 남긴다", async () => {
        const rows = [
            { id: "expired-1", firstSeenAt: daysAgo(40) },
            { id: "fresh-1", firstSeenAt: daysAgo(10) },
        ];

        const pruned = await new PgIngestKeyRetentionAdapter(fakeIngestKeyTable(rows)).deleteExpiredIngestKeys();

        expect(pruned).toBe(1);
        expect(rows.map((row) => row.id)).toEqual(["fresh-1"]);
    });

    it("배치 크기만큼 반환되는 동안 반복 삭제하고 미만이면 멈춘다", async () => {
        let call = 0;
        const query = vi.fn(async () => {
            call += 1;
            if (call === 1) {
                return {
                    rows: Array.from({ length: EVENT_INGEST_KEY_PRUNE_BATCH_SIZE }, (_, index) => ({ id: `k${index}` })),
                };
            }
            return { rows: [{ id: "last" }] };
        });

        const pruned = await new PgIngestKeyRetentionAdapter({ query }).deleteExpiredIngestKeys();

        expect(pruned).toBe(EVENT_INGEST_KEY_PRUNE_BATCH_SIZE + 1);
        expect(query).toHaveBeenCalledTimes(2);
    });
});
