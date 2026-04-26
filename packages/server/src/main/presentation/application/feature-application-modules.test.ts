import "reflect-metadata";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/index.js";
import { DatabaseModule } from "../database/database.module.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "../database/database.provider.js";
import { CONFIG_APPLICATION_EXPORTS } from "./config.providers.js";
import { ConfigApplicationModule } from "./config-application.module.js";
import { EVENTS_APPLICATION_EXPORTS } from "./events.providers.js";
import { EventsApplicationModule } from "./events-application.module.js";
import { RULES_APPLICATION_EXPORTS } from "./rules.providers.js";
import { RulesApplicationModule } from "./rules-application.module.js";
import { SESSIONS_APPLICATION_EXPORTS } from "./sessions.providers.js";
import { SessionsApplicationModule } from "./sessions-application.module.js";
import { SYSTEM_APPLICATION_EXPORTS } from "./system.providers.js";
import { SystemApplicationModule } from "./system-application.module.js";
import { TASK_APPLICATION_EXPORTS } from "./tasks.providers.js";
import { TasksApplicationModule } from "./tasks-application.module.js";
import { TURN_PARTITIONS_APPLICATION_EXPORTS } from "./turn-partitions.providers.js";
import { TurnPartitionsApplicationModule } from "./turn-partitions-application.module.js";
import { TURNS_APPLICATION_EXPORTS } from "./turns.providers.js";
import { TurnsApplicationModule } from "./turns-application.module.js";
import { VERIFICATION_APPLICATION_EXPORTS } from "./verification.providers.js";
import { VerificationApplicationModule } from "./verification-application.module.js";
import { WORKFLOW_APPLICATION_EXPORTS } from "./workflow.providers.js";
import { WorkflowApplicationModule } from "./workflow-application.module.js";

type ProviderToken = Type<unknown> | string | symbol;
const SMOKE_PROVIDERS_TOKEN = Symbol("SMOKE_PROVIDERS");

class FeatureApplicationSmokeHostModule {}

const featureApplicationModules = [
    {
        module: ConfigApplicationModule,
        name: "config",
        register: (databaseModule: DynamicModule) => ConfigApplicationModule.register(databaseModule),
        exportedProviders: CONFIG_APPLICATION_EXPORTS,
    },
    {
        module: EventsApplicationModule,
        name: "events",
        register: (databaseModule: DynamicModule) => EventsApplicationModule.register(databaseModule),
        exportedProviders: EVENTS_APPLICATION_EXPORTS,
    },
    {
        module: RulesApplicationModule,
        name: "rules",
        register: (databaseModule: DynamicModule) =>
            RulesApplicationModule.register(databaseModule, VerificationApplicationModule.register(databaseModule)),
        exportedProviders: RULES_APPLICATION_EXPORTS,
    },
    {
        module: SessionsApplicationModule,
        name: "sessions",
        register: (databaseModule: DynamicModule) =>
            SessionsApplicationModule.register(databaseModule, TasksApplicationModule.register(databaseModule)),
        exportedProviders: SESSIONS_APPLICATION_EXPORTS,
    },
    {
        module: SystemApplicationModule,
        name: "system",
        register: (databaseModule: DynamicModule) => SystemApplicationModule.register(databaseModule),
        exportedProviders: SYSTEM_APPLICATION_EXPORTS,
    },
    {
        module: TasksApplicationModule,
        name: "tasks",
        register: (databaseModule: DynamicModule) => TasksApplicationModule.register(databaseModule),
        exportedProviders: TASK_APPLICATION_EXPORTS,
    },
    {
        module: TurnPartitionsApplicationModule,
        name: "turn partitions",
        register: (databaseModule: DynamicModule) => TurnPartitionsApplicationModule.register(databaseModule),
        exportedProviders: TURN_PARTITIONS_APPLICATION_EXPORTS,
    },
    {
        module: TurnsApplicationModule,
        name: "turns",
        register: (databaseModule: DynamicModule) => TurnsApplicationModule.register(databaseModule),
        exportedProviders: TURNS_APPLICATION_EXPORTS,
    },
    {
        module: VerificationApplicationModule,
        name: "verification",
        register: (databaseModule: DynamicModule) => VerificationApplicationModule.register(databaseModule),
        exportedProviders: VERIFICATION_APPLICATION_EXPORTS,
    },
    {
        module: WorkflowApplicationModule,
        name: "workflow",
        register: (databaseModule: DynamicModule) => WorkflowApplicationModule.register(databaseModule),
        exportedProviders: WORKFLOW_APPLICATION_EXPORTS,
    },
] as const;

function providerName(token: ProviderToken): string {
    if (typeof token === "function") return token.name;
    return String(token);
}

function createSmokeHostModule(
    databaseModule: DynamicModule,
    featureModule: DynamicModule,
    providers: readonly ProviderToken[],
): DynamicModule {
    return {
        module: FeatureApplicationSmokeHostModule,
        imports: [databaseModule, featureModule],
        providers: [
            {
                provide: SMOKE_PROVIDERS_TOKEN,
                useFactory: (...resolvedProviders: unknown[]) => resolvedProviders,
                inject: [...providers],
            },
        ],
    };
}

describe("feature application modules", () => {
    const contexts: INestApplicationContext[] = [];
    const tempDirs: string[] = [];

    afterEach(async () => {
        for (const context of contexts.splice(0)) {
            const databaseContext = context.get<SqliteDatabaseContext>(SQLITE_DATABASE_CONTEXT_TOKEN);
            await context.close();
            databaseContext.close();
        }

        for (const tempDir of tempDirs.splice(0)) {
            await rm(tempDir, { recursive: true, force: true });
        }

        vi.restoreAllMocks();
    });

    it("exports feature-owned providers through Nest DI", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        for (const featureModule of featureApplicationModules) {
            const tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-application-modules-"));
            tempDirs.push(tempDir);
            const databaseModule = DatabaseModule.forRoot({ databasePath: path.join(tempDir, "monitor.sqlite") });
            const context = await NestFactory.createApplicationContext(
                createSmokeHostModule(
                    databaseModule,
                    featureModule.register(databaseModule),
                    featureModule.exportedProviders,
                ),
                { logger: false, abortOnError: false },
            );
            contexts.push(context);
            const resolvedProviders = context.get<unknown[]>(SMOKE_PROVIDERS_TOKEN);

            expect(
                resolvedProviders,
                `${featureModule.name} should export ${featureModule.exportedProviders
                    .map(providerName)
                    .join(", ")}`,
            ).toHaveLength(featureModule.exportedProviders.length);
            expect(resolvedProviders.every((provider) => provider !== undefined)).toBe(true);
        }
    });
});
