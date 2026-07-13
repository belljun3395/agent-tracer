import { loadApplicationConfig } from "@monitor/platform";
import { RunColdTierUsecase } from "~runtime-api/domain/cold/application/run.cold.tier.usecase.js";
import { DuckdbPartitionArchiveAdapter } from "~runtime-api/domain/cold/adapter/duckdb.partition.archive.adapter.js";
import { PgIngestKeyRetentionAdapter } from "~runtime-api/domain/cold/adapter/pg.ingest.key.retention.adapter.js";
import { openRuntimeDb } from "~runtime-api/domain/cold/adapter/runtime.db.connection.js";
import { logInfo } from "~runtime-api/config/log.js";

const config = loadApplicationConfig();
const db = await openRuntimeDb(config);
try {
    const usecase = new RunColdTierUsecase(
        new DuckdbPartitionArchiveAdapter(config, db),
        new PgIngestKeyRetentionAdapter(db),
    );
    const { archived, prunedIngestKeys } = await usecase.execute();
    logInfo({
        msg: "cold-tier.completed",
        partitions: archived.map((entry) => entry.partition),
        prunedIngestKeys,
    });
} finally {
    await db.close();
}
