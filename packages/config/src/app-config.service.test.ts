import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { APP_CONFIG_NAMESPACE, AppConfigService } from "./app-config.service.js";
import { applicationConfigSchema } from "./application-config.js";

const FIXTURE = applicationConfigSchema.parse({
    profile: "prd",
    monitor: {
        protocol: "http",
        listenHost: "127.0.0.1",
        publicHost: "example.test",
        port: 4100,
    },
    postgres: {
        host: "db.example.test",
        port: 5432,
        username: "monitor",
        password: "secret",
        database: "monitor",
    },
    opensearch: { node: "http://search.example.test:9200" },
    redis: { url: "redis://cache.example.test:6379" },
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
        expect(config.postgres.database).toBe("monitor");

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
