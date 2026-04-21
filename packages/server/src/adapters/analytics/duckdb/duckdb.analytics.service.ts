import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import {
    isAnalyticsDisabled,
    resolveAnalyticsArchiveAfterDays,
    resolveAnalyticsEtlIntervalMs,
    resolveDuckDbAnalyticsPath,
    resolveDuckDbArchiveDir,
    resolveDuckDbPortableDir,
} from "./duckdb.analytics.paths.js";
import {
    buildArchiveOldDomainEventsSql,
    buildDuckDbAnalyticsSql,
    buildPortableAnalyticsExportSql,
    PORTABLE_ANALYTICS_TABLES,
    quoteDuckDbString,
    type AnalyticsSourceTable,
} from "./duckdb.analytics.sql.js";

export interface DuckDbAnalyticsRunResult {
    readonly sourceTable: AnalyticsSourceTable;
    readonly bronzeEventCount: number;
    readonly taskSummaryCount: number;
    readonly duckDbPath: string;
}

export interface DuckDbAnalyticsServiceOptions {
    readonly sqliteDatabasePath: string;
    readonly duckDbPath?: string;
    readonly archiveDir?: string;
    readonly portableDir?: string;
    readonly etlIntervalMs?: number;
    readonly archiveAfterDays?: number;
    readonly enabled?: boolean;
    readonly runOnStart?: boolean;
    readonly env?: NodeJS.ProcessEnv;
    readonly logger?: Pick<Console, "warn" | "info">;
    readonly now?: () => Date;
}

export class DuckDbAnalyticsService {
    private readonly sqliteDatabasePath: string;
    private readonly duckDbPath: string;
    private readonly archiveDir: string;
    private readonly portableDir: string;
    private readonly etlIntervalMs: number;
    private readonly archiveAfterDays: number;
    private readonly enabled: boolean;
    private readonly runOnStart: boolean;
    private readonly logger: Pick<Console, "warn" | "info">;
    private readonly now: () => Date;
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<unknown> | undefined;

    constructor(options: DuckDbAnalyticsServiceOptions) {
        const env = options.env ?? process.env;
        this.sqliteDatabasePath = options.sqliteDatabasePath;
        this.duckDbPath = options.duckDbPath ?? resolveDuckDbAnalyticsPath(env);
        this.archiveDir = options.archiveDir ?? resolveDuckDbArchiveDir(env);
        this.portableDir = options.portableDir ?? resolveDuckDbPortableDir(env);
        this.etlIntervalMs = options.etlIntervalMs ?? resolveAnalyticsEtlIntervalMs(env);
        this.archiveAfterDays = options.archiveAfterDays ?? resolveAnalyticsArchiveAfterDays(env);
        this.enabled = options.enabled ?? !isAnalyticsDisabled(env);
        this.runOnStart = options.runOnStart ?? true;
        this.logger = options.logger ?? console;
        this.now = options.now ?? (() => new Date());
    }

    start(): void {
        if (!this.enabled || this.timer) return;

        if (this.runOnStart) {
            this.queueRun();
        }

        this.timer = setInterval(() => this.queueRun(), this.etlIntervalMs);
        this.timer.unref();
    }

    close(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    async runOnce(): Promise<DuckDbAnalyticsRunResult> {
        if (!this.enabled) {
            return {
                sourceTable: this.detectSourceTable(),
                bronzeEventCount: 0,
                taskSummaryCount: 0,
                duckDbPath: this.duckDbPath,
            };
        }

        fs.mkdirSync(path.dirname(this.duckDbPath), { recursive: true });
        fs.mkdirSync(this.archiveDir, { recursive: true });
        fs.mkdirSync(this.portableDir, { recursive: true });

        const sourceTable = this.detectSourceTable();
        const instance = await DuckDBInstance.fromCache(this.duckDbPath);
        const connection = await instance.connect();
        try {
            await loadSqliteExtension(connection);

            if (sourceTable === "events") {
                await this.archiveOldDomainEvents(connection);
            }

            for (const statement of buildDuckDbAnalyticsSql({
                sqlitePath: this.sqliteDatabasePath,
                sourceTable,
                archiveFiles: this.listArchiveFiles(),
            })) {
                await connection.run(statement);
            }

            await this.exportPortableAnalytics(connection);

            const counts = await readSingleRow<{ bronze_event_count: number; task_summary_count: number }>(
                connection,
                "select count(*)::integer as bronze_event_count, (select count(*)::integer from fact_task_summary) as task_summary_count from bronze_events",
            );

            return {
                sourceTable,
                bronzeEventCount: counts?.bronze_event_count ?? 0,
                taskSummaryCount: counts?.task_summary_count ?? 0,
                duckDbPath: this.duckDbPath,
            };
        } finally {
            connection.closeSync();
        }
    }

    async queryRows<T extends Record<string, unknown> = Record<string, unknown>>(sql: string): Promise<readonly T[]> {
        fs.mkdirSync(path.dirname(this.duckDbPath), { recursive: true });
        const instance = await DuckDBInstance.fromCache(this.duckDbPath);
        const connection = await instance.connect();
        try {
            const reader = await connection.runAndReadAll(sql);
            return reader.getRowObjectsJson() as T[];
        } finally {
            connection.closeSync();
        }
    }

    private queueRun(): void {
        if (this.running) return;
        this.running = this.runOnce()
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`[analytics] DuckDB ETL failed: ${message}`);
            })
            .finally(() => {
                this.running = undefined;
            });
    }

    private detectSourceTable(): AnalyticsSourceTable {
        if (!fs.existsSync(this.sqliteDatabasePath)) {
            return "timeline_events_view";
        }

        const db = new BetterSqlite3(this.sqliteDatabasePath, { readonly: true, fileMustExist: true });
        try {
            const rows = db
                .prepare<[], { readonly name: string }>(
                    "select name from sqlite_master where type = 'table' and name in ('events', 'timeline_events_view')",
                )
                .all();
            if (rows.some((row) => row.name === "timeline_events_view") && countRows(db, "timeline_events_view") > 0) {
                return "timeline_events_view";
            }
            if (rows.some((row) => row.name === "events") && countRows(db, "events") > 0) return "events";
            return "timeline_events_view";
        } finally {
            db.close();
        }
    }

    private async archiveOldDomainEvents(connection: DuckDBConnection): Promise<void> {
        const archiveBeforeMs = this.now().getTime() - this.archiveAfterDays * 24 * 60 * 60 * 1000;
        const row = await readSingleRow<{ readonly event_count: number | string }>(
            connection,
            `select count(*)::bigint as event_count from sqlite_scan(${quoteDuckDbString(this.sqliteDatabasePath)}, 'events') where cast(event_time as bigint) < ${archiveBeforeMs}`,
        );
        if (Number(row?.event_count ?? 0) === 0) {
            return;
        }

        const archiveDate = new Date(archiveBeforeMs).toISOString().slice(0, 10);
        const archivePath = path.join(this.archiveDir, `${archiveDate}.parquet`);
        fs.rmSync(archivePath, { force: true });

        for (const statement of buildArchiveOldDomainEventsSql({
            sqlitePath: this.sqliteDatabasePath,
            archivePath,
            archiveBeforeMs,
        })) {
            await connection.run(statement);
        }
    }

    private listArchiveFiles(): readonly string[] {
        if (!fs.existsSync(this.archiveDir)) return [];
        return fs
            .readdirSync(this.archiveDir)
            .filter((fileName) => fileName.endsWith(".parquet"))
            .sort()
            .map((fileName) => path.join(this.archiveDir, fileName));
    }

    private async exportPortableAnalytics(connection: DuckDBConnection): Promise<void> {
        for (const table of PORTABLE_ANALYTICS_TABLES) {
            fs.rmSync(path.join(this.portableDir, `${table}.parquet`), { force: true });
        }

        for (const statement of buildPortableAnalyticsExportSql(this.portableDir)) {
            await connection.run(statement);
        }
    }
}

function countRows(db: BetterSqlite3.Database, tableName: string): number {
    const quotedName = `"${tableName.replaceAll("\"", "\"\"")}"`;
    const row = db.prepare<[], { readonly count: number }>(`select count(*) as count from ${quotedName}`).get();
    return row?.count ?? 0;
}

export function createDuckDbAnalyticsService(options: DuckDbAnalyticsServiceOptions): DuckDbAnalyticsService {
    return new DuckDbAnalyticsService(options);
}

async function loadSqliteExtension(connection: DuckDBConnection): Promise<void> {
    try {
        await connection.run("load sqlite");
    } catch {
        await connection.run("install sqlite");
        await connection.run("load sqlite");
    }
}

async function readSingleRow<T extends Record<string, unknown>>(
    connection: DuckDBConnection,
    sql: string,
): Promise<T | null> {
    const reader = await connection.runAndReadAll(sql);
    const rows = reader.getRowObjectsJson() as T[];
    return rows[0] ?? null;
}
