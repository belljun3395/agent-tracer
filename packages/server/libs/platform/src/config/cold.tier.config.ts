import type { ApplicationConfig } from "./application.config.schema.js";

type ColdTierConfig = Pick<ApplicationConfig, "coldStore" | "tiering">;

/** 콜드 티어 저장소와 DuckDB 실행 설정을 환경별 우선순위로 조립한다. */
export function buildColdTierConfig(
    coldStore: Record<string, unknown>,
    tiering: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
): ColdTierConfig {
    return {
        coldStore: {
            endpoint: env["COLD_S3_ENDPOINT"] ?? (coldStore["endpoint"] as string | undefined) ?? "localhost:9000",
            region: env["COLD_S3_REGION"] ?? (coldStore["region"] as string | undefined) ?? "us-east-1",
            bucket: env["COLD_S3_BUCKET"] ?? (coldStore["bucket"] as string | undefined) ?? "agent-tracer-cold",
            prefix: env["COLD_S3_PREFIX"] ?? (coldStore["prefix"] as string | undefined) ?? "events",
            accessKey: env["COLD_S3_ACCESS_KEY"] ?? (coldStore["accessKey"] as string | undefined) ?? "monitor",
            secretKey: env["COLD_S3_SECRET_KEY"] ?? (coldStore["secretKey"] as string | undefined) ?? "monitor-secret",
            useSsl: (env["COLD_S3_USE_SSL"] ?? String((coldStore["useSsl"] as boolean | undefined) ?? false)) === "true",
        },
        tiering: {
            duckdbBin: env["DUCKDB_BIN"] ?? (tiering["duckdbBin"] as string | undefined) ?? "duckdb",
        },
    };
}
