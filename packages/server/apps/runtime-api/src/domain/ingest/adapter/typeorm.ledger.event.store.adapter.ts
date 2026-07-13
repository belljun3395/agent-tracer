import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm";
import type {
    LedgerEventRecord,
    LedgerEventStore,
} from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";
import { RUNTIME_DATA_SOURCE } from "~runtime-api/config/runtime.datasource.token.js";
import { LedgerEventEntity } from "./ledger.event.entity.js";

/** 원장 포트를 TypeORM 트랜잭션과 PostgreSQL 테이블에 연결한다. */
@Injectable()
export class TypeOrmLedgerEventStoreAdapter implements LedgerEventStore {
    constructor(@Inject(RUNTIME_DATA_SOURCE) private readonly dataSource: DataSource) {}

    // 시간 파티션 PK에는 occurred_at이 포함되므로 전역 키를 같은 트랜잭션에서 먼저 claim한다.
    async appendAll(rows: readonly LedgerEventRecord[]): Promise<void> {
        const uniqueRows = uniqueById(rows);
        if (uniqueRows.length === 0) return;
        await this.dataSource.transaction(async (manager) => {
            const claimed = await manager
                .createQueryBuilder()
                .insert()
                .into("event_ingest_keys")
                .values(uniqueRows.map((row) => ({ id: row.id })))
                .orIgnore()
                .returning("id")
                .execute();
            const claimedIds = new Set<string>(
                (claimed.raw as { id?: unknown }[])
                    .map((row) => (typeof row.id === "string" ? row.id : null))
                    .filter((id): id is string => id !== null),
            );
            if (claimedIds.size === 0) return;
            const accepted = uniqueRows.filter((row) => claimedIds.has(row.id));
            await manager
                .getRepository(LedgerEventEntity)
                .createQueryBuilder()
                .insert()
                .into(LedgerEventEntity)
                .values(accepted as QueryDeepPartialEntity<LedgerEventEntity>[])
                .orIgnore()
                .execute();
        });
    }
}

function uniqueById(rows: readonly LedgerEventRecord[]): LedgerEventRecord[] {
    const unique = new Map<string, LedgerEventRecord>();
    for (const row of rows) {
        if (!unique.has(row.id)) unique.set(row.id, row);
    }
    return [...unique.values()];
}
