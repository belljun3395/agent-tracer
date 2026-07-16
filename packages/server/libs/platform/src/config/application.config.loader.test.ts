import type { PathLike } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));
const hostnameMock = vi.hoisted(() => vi.fn(() => "pod-a"));

vi.mock("node:fs", () => ({ default: fsMock }));
vi.mock("node:os", () => ({ default: { hostname: hostnameMock } }));

function provideYaml(base: Record<string, unknown>, local?: Record<string, unknown>): void {
    fsMock.existsSync.mockImplementation((filePath: PathLike) =>
        !String(filePath).endsWith("application.local.yaml") || local !== undefined);
    fsMock.readFileSync.mockImplementation((filePath: PathLike) =>
        JSON.stringify(String(filePath).endsWith("application.local.yaml") ? local : base));
}

async function loadFreshConfig() {
    vi.resetModules();
    const { loadApplicationConfig } = await import("./application.config.loader.js");
    return loadApplicationConfig;
}

describe("loadApplicationConfig", () => {
    beforeEach(() => {
        fsMock.existsSync.mockReset();
        fsMock.readFileSync.mockReset();
        hostnameMock.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("기본 YAML에 로컬 YAML과 환경변수를 순서대로 덮어쓴다", async () => {
        provideYaml(
            {
                profile: "prd",
                runtimeApi: { port: 4101 },
                kafka: { brokers: ["base:9092"] },
            },
            {
                profile: "local",
                runtimeApi: { port: 4201 },
                kafka: { brokers: ["local:9092"] },
            },
        );
        vi.stubEnv("RUNTIME_API_PORT", "4301");
        vi.stubEnv("KAFKA_BROKERS", "env-a:9092, ,env-b:9092");
        vi.stubEnv("AGENT_TOOL_CALLBACK_PORT", "9910");

        const loadApplicationConfig = await loadFreshConfig();
        const config = loadApplicationConfig();

        expect(config.profile).toBe("local");
        expect(config.runtimeApi.port).toBe(4301);
        expect(config.kafka.brokers).toEqual(["env-a:9092", "env-b:9092"]);
        expect(config.agentGraph).toMatchObject({
            toolCallbackPort: 9910,
            toolCallbackUrl: "http://pod-a:9910",
            instanceId: "pod-a",
        });
    });

    it("환경변수가 바뀌어도 최초에 검증한 설정을 재사용한다", async () => {
        provideYaml({ runtimeApi: { port: 4101 } });
        const loadApplicationConfig = await loadFreshConfig();

        const first = loadApplicationConfig();
        vi.stubEnv("RUNTIME_API_PORT", "4301");
        const second = loadApplicationConfig();

        expect(second).toBe(first);
        expect(second.runtimeApi.port).toBe(4101);
    });

    it("잘못된 환경변수 포트를 스키마 검증에서 거부한다", async () => {
        provideYaml({});
        vi.stubEnv("PROJECTOR_PORT", "not-a-port");
        const loadApplicationConfig = await loadFreshConfig();

        expect(() => loadApplicationConfig()).toThrow();
    });

    it("콜드 스토리지와 티어링 설정을 애플리케이션 설정에 노출하지 않는다", async () => {
        provideYaml({
            coldStore: { endpoint: "minio:9000" },
            tiering: { duckdbBin: "duckdb" },
        });
        vi.stubEnv("COLD_S3_ENDPOINT", "ignored:9000");
        vi.stubEnv("DUCKDB_BIN", "/usr/local/bin/duckdb");

        const loadApplicationConfig = await loadFreshConfig();
        const config = loadApplicationConfig();

        expect(config).not.toHaveProperty("coldStore");
        expect(config).not.toHaveProperty("tiering");
    });
});
