import "reflect-metadata";
import { createDataSource, loadApplicationConfig } from "@monitor/platform";
import { LedgerEventEntity } from "~runtime-api/domain/ingest/adapter/ledger.event.entity.js";
import { RUNTIME_MIGRATIONS } from "~runtime-api/migrations/registry.js";

// 마이그레이션 CLI가 읽는 DataSource이며 원장 엔티티와 마이그레이션을 등록한다.
const runtimeDataSource = createDataSource({
    db: loadApplicationConfig().runtimeDb,
    entities: [LedgerEventEntity],
    migrations: [...RUNTIME_MIGRATIONS],
});

export default runtimeDataSource;
