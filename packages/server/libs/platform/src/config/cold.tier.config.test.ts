import { describe, expect, it } from "vitest";
import { buildColdTierConfig } from "./cold.tier.config.js";

describe("buildColdTierConfig", () => {
    it("YAML 저장소와 DuckDB 설정을 조립한다", () => {
        const config = buildColdTierConfig(
            {
                endpoint: "minio.internal:9000",
                region: "ap-northeast-2",
                bucket: "archive",
                prefix: "ledger",
                accessKey: "reader",
                secretKey: "secret",
                useSsl: true,
            },
            { duckdbBin: "/opt/duckdb" },
            {},
        );

        expect(config).toEqual({
            coldStore: {
                endpoint: "minio.internal:9000",
                region: "ap-northeast-2",
                bucket: "archive",
                prefix: "ledger",
                accessKey: "reader",
                secretKey: "secret",
                useSsl: true,
            },
            tiering: { duckdbBin: "/opt/duckdb" },
        });
    });

    it("환경변수로 저장소와 DuckDB 설정을 덮어쓴다", () => {
        const config = buildColdTierConfig(
            { endpoint: "yaml:9000", useSsl: true },
            { duckdbBin: "yaml-duckdb" },
            {
                COLD_S3_ENDPOINT: "env:9000",
                COLD_S3_USE_SSL: "false",
                DUCKDB_BIN: "env-duckdb",
            },
        );

        expect(config.coldStore.endpoint).toBe("env:9000");
        expect(config.coldStore.useSsl).toBe(false);
        expect(config.tiering.duckdbBin).toBe("env-duckdb");
    });
});
