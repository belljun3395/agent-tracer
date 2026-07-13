import type { IngestKeyRetentionPort } from "~runtime-api/domain/cold/port/ingest.key.retention.port.js";
import type { SqlClient } from "./runtime.db.connection.js";

// 클라이언트 스풀 재전송 최대 체류를 근거로 못박은 멱등 보증 윈도다.
export const EVENT_INGEST_KEY_RETENTION_DAYS = 30;
export const EVENT_INGEST_KEY_PRUNE_BATCH_SIZE = 5000;

const PRUNE_EXPIRED_INGEST_KEYS_SQL = `
    DELETE FROM event_ingest_keys
    WHERE id IN (
        SELECT id FROM event_ingest_keys
        WHERE first_seen_at < now() - interval '${EVENT_INGEST_KEY_RETENTION_DAYS} days'
        LIMIT ${EVENT_INGEST_KEY_PRUNE_BATCH_SIZE}
    )
    RETURNING id
`;

/** 멱등 보증 윈도를 지난 수집 키를 제한된 배치로 지운다. */
export class PgIngestKeyRetentionAdapter implements IngestKeyRetentionPort {
    constructor(private readonly client: SqlClient) {}

    async deleteExpiredIngestKeys(): Promise<number> {
        let pruned = 0;
        for (;;) {
            const { rows } = await this.client.query(PRUNE_EXPIRED_INGEST_KEYS_SQL);
            pruned += rows.length;
            if (rows.length < EVENT_INGEST_KEY_PRUNE_BATCH_SIZE) break;
        }
        return pruned;
    }
}
