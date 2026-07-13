import { describe, expect, it, vi } from "vitest";
import type { ApplicationConfig } from "@monitor/platform";
import { DuckdbPartitionArchiveAdapter } from "./duckdb.partition.archive.adapter.js";
import type { SqlClient } from "./runtime.db.connection.js";

function config(): ApplicationConfig {
    return {
        profile: "local",
        runtimeApi: { port: 3901 },
        tracerApi: { port: 3902 },
        projector: { port: 3903 },
        listenHost: "127.0.0.1",
        runtimeDb: {
            host: "runtime-db",
            port: 5432,
            username: "monitor",
            password: "monitor",
            database: "runtime",
        },
        tracerDb: {
            host: "tracer-db",
            port: 5432,
            username: "monitor",
            password: "monitor",
            database: "tracer",
        },
        kafka: { brokers: ["redpanda:29092"] },
        opensearch: { node: "http://opensearch:9200" },
        temporal: { address: "temporal:7233", namespace: "default" },
        agentGraph: {
            url: "http://agents:8800",
            toolCallbackPort: 8810,
            toolCallbackUrl: "http://127.0.0.1:8810",
            instanceId: "test-worker",
        },
        coldStore: {
            endpoint: "minio:9000",
            region: "us-east-1",
            bucket: "agent-tracer-cold",
            prefix: "events",
            accessKey: "monitor",
            secretKey: "monitor-secret",
            useSsl: false,
        },
        tiering: { duckdbBin: "duckdb" },
    };
}

function detachedPartitionTable(queries: string[]): SqlClient {
    return {
        query: vi.fn(async (sql: string) => {
            queries.push(sql);
            if (sql.includes("SELECT c.relname AS table_name")) {
                return { rows: [{ table_name: "events_p2026_01" }] };
            }
            return { rows: [] };
        }),
    };
}

describe("DuckdbPartitionArchiveAdapter", () => {
    it("분리 파티션을 콜드 스토어 위치로 내보내고 원장에서 드롭한다", async () => {
        const queries: string[] = [];
        const duckdb = vi.fn(async () => undefined);

        const archived = await new DuckdbPartitionArchiveAdapter(config(), detachedPartitionTable(queries), duckdb)
            .archiveExpiredPartitions();

        expect(archived).toEqual([
            { partition: "events_p2026_01", location: "s3://agent-tracer-cold/events/events_p2026_01.parquet" },
        ]);
        expect(queries.some((sql) => sql.includes("DROP TABLE IF EXISTS public.events_p2026_01"))).toBe(true);
        expect(duckdb).toHaveBeenCalledOnce();
    });

    it("내보내기가 실패하면 분리 파티션을 드롭하지 않는다", async () => {
        const queries: string[] = [];
        const duckdb = vi.fn(async () => {
            throw new Error("minio unavailable");
        });

        const archive = new DuckdbPartitionArchiveAdapter(config(), detachedPartitionTable(queries), duckdb);

        await expect(archive.archiveExpiredPartitions()).rejects.toThrow("minio unavailable");
        expect(queries.some((sql) => sql.includes("DROP TABLE"))).toBe(false);
    });
});
