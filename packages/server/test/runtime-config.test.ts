import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    loadApplicationConfig,
    resolveExternalMonitorBaseUrl,
    resolveMonitorDatabasePath,
    resolveMonitorPort,
    resolveWebApiBaseUrl,
} from "@monitor/runtime-config";

describe("runtime config loader", () => {
    it("prefers environment overrides over yaml defaults", () => {
        const env = {
            MONITOR_PORT: "4011",
            MONITOR_BASE_URL: "http://127.0.0.1:4999/",
            VITE_MONITOR_BASE_URL: "http://127.0.0.1:5777/",
            AGENT_TRACER_SOURCE_REPO: "example/agent-tracer",
        } as NodeJS.ProcessEnv;

        const config = loadApplicationConfig({ env });

        expect(resolveMonitorPort(config, env)).toBe(4011);
        expect(resolveExternalMonitorBaseUrl(config, env)).toBe("http://127.0.0.1:4999");
        expect(resolveWebApiBaseUrl(config, env)).toBe("http://127.0.0.1:5777");
        expect(config.externalSetup.sourceRepo).toBe("example/agent-tracer");
    });

    it("resolves a relative database path from the provided cwd", () => {
        const config = loadApplicationConfig({
            env: {
                MONITOR_DATABASE_PATH: ".cache/monitor.sqlite",
            } as NodeJS.ProcessEnv,
        });

        expect(
            resolveMonitorDatabasePath(config, {
                cwd: "/tmp/agent-tracer-test",
                env: {
                    MONITOR_DATABASE_PATH: ".cache/monitor.sqlite",
                } as NodeJS.ProcessEnv,
            }),
        ).toBe(path.resolve("/tmp/agent-tracer-test", ".cache/monitor.sqlite"));
    });
});
