import type { ApplicationConfig } from "@monitor/platform";
import type {
    ArchivedPartition,
    PartitionArchivePort,
} from "~runtime-api/domain/cold/port/partition.archive.port.js";
import type { SqlClient } from "./runtime.db.connection.js";
import { runDuckdb, type DuckdbRunner } from "./duckdb.cli.js";

const RUN_MAINTENANCE_SQL = `SELECT partman.run_maintenance('public.events')`;

const DETACHED_PARTITIONS_SQL = `
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'events\\_p%'
      AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
    ORDER BY c.relname
`;

function safeIdent(name: string): string {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`unexpected partition name: ${name}`);
    return name;
}

function pgConnString(db: ApplicationConfig["runtimeDb"]): string {
    return `dbname=${db.database} host=${db.host} port=${db.port} user=${db.username} password=${db.password}`;
}

/** 분리된 이벤트 파티션을 DuckDB로 객체 저장소에 내보내고 원장에서 드롭한다. */
export class DuckdbPartitionArchiveAdapter implements PartitionArchivePort {
    constructor(
        private readonly config: ApplicationConfig,
        private readonly client: SqlClient,
        private readonly duckdb: DuckdbRunner = runDuckdb,
    ) {}

    async archiveExpiredPartitions(): Promise<readonly ArchivedPartition[]> {
        await this.client.query(RUN_MAINTENANCE_SQL);

        const archived: ArchivedPartition[] = [];
        const { rows } = await this.client.query(DETACHED_PARTITIONS_SQL);
        for (const row of rows) {
            const tableName = row["table_name"];
            if (typeof tableName !== "string") throw new Error("unexpected partition row");
            const partition = safeIdent(tableName);
            const location = this.locationOf(partition);
            await this.duckdb(this.config.tiering.duckdbBin, this.exportSql(partition, location));
            await this.client.query(`DROP TABLE IF EXISTS public.${partition}`);
            archived.push({ partition, location });
        }
        return archived;
    }

    private locationOf(partition: string): string {
        const s3 = this.config.coldStore;
        return `s3://${s3.bucket}/${s3.prefix}/${partition}.parquet`;
    }

    private exportSql(partition: string, location: string): string {
        const s3 = this.config.coldStore;
        return [
            "INSTALL postgres; LOAD postgres;",
            "INSTALL httpfs; LOAD httpfs;",
            `SET s3_endpoint='${s3.endpoint}';`,
            `SET s3_use_ssl=${s3.useSsl};`,
            "SET s3_url_style='path';",
            `SET s3_region='${s3.region}';`,
            `SET s3_access_key_id='${s3.accessKey}';`,
            `SET s3_secret_access_key='${s3.secretKey}';`,
            `ATTACH '${pgConnString(this.config.runtimeDb)}' AS pg (TYPE postgres, READ_ONLY);`,
            `COPY (SELECT * FROM pg.public.${partition}) TO '${location}' (FORMAT parquet);`,
        ].join("\n");
    }
}
