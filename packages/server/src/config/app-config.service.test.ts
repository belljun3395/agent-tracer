import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { APP_CONFIG_NAMESPACE, AppConfigService } from "./app-config.service.js";
import { applicationConfigSchema } from "./application-config.js";

const FIXTURE = applicationConfigSchema.parse({
    monitor: {
        protocol: "http",
        listenHost: "127.0.0.1",
        publicHost: "example.test",
        port: 4100,
        databasePath: "/var/lib/monitor.sqlite",
    },
    web: { apiBaseUrl: "https://api.example.test", wsBaseUrl: "wss://api.example.test" },
    externalSetup: { monitorBaseUrl: "", sourceRepo: "owner/repo" },
});

describe("AppConfigService", () => {
    it("exposes the loaded config through the @nestjs/config provider", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [() => ({ [APP_CONFIG_NAMESPACE]: FIXTURE })],
                }),
            ],
            providers: [AppConfigService],
        }).compile();

        const config = moduleRef.get(AppConfigService);

        expect(config.monitor.port).toBe(4100);
        expect(config.monitor.publicHost).toBe("example.test");
        expect(config.web.apiBaseUrl).toBe("https://api.example.test");
        expect(config.externalSetup.sourceRepo).toBe("owner/repo");
        // An absolute databasePath is returned untouched (no cwd resolution).
        expect(config.resolveDatabasePath("/ignored")).toBe("/var/lib/monitor.sqlite");

        await moduleRef.close();
    });

    it("throws a clear error when the config namespace is missing", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ConfigModule.forRoot({ isGlobal: true, load: [] })],
            providers: [AppConfigService],
        }).compile();

        const config = moduleRef.get(AppConfigService);

        expect(() => config.application).toThrow(/AppConfigModule/);

        await moduleRef.close();
    });
});
